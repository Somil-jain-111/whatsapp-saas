import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { DataSource } from "typeorm";
import { ConsoleLogger } from "../../default/logger/console/console.service";
import { AppConfigService } from "../../default/config/config.service";
import { isStrongPassword } from "../../default/common/validators/is-strong-password.validator";
import { TenantContextService } from "../database/tenant-context.service";
import { PasswordHasherService } from "../security/password-hasher.service";
import {
  AcceptInvitationDto,
  CreateInvitationDto,
  CreateOrganizationDto,
  ForgotPasswordDto,
  LoginDto,
  MfaRevokeDto,
  MfaSetupDto,
  MfaVerifyDto,
  RegisterDto,
  RefreshDto,
  ResendVerificationDto,
  ResetPasswordDto,
  UpdateMemberDto,
  VerifyEmailDto,
} from "./dto/identity.dto";
import { IdentityEmailService } from "./identity-email.service";
import { FieldEncryptionService } from "../security/encryption/field-encryption.service";
import { TotpService } from "../security/totp.service";

interface TokenClaims {
  sub: string;
  sid: string;
  type: "access" | "refresh";
  jti?: string;
}

interface AuthUser {
  id: string;
  email_normalized: string;
  email_display: string;
  full_name: string;
  password_hash: string;
  status: string;
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenants: TenantContextService,
    private readonly passwords: PasswordHasherService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly identityEmail: IdentityEmailService,
    private readonly encryption: FieldEncryptionService,
    private readonly totp: TotpService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const email = dto.email.trim().toLowerCase();
    const [user] = (await this.dataSource.query(
      `SELECT id,email_normalized,email_display,full_name,password_hash,status
       FROM whatsapp_core.users WHERE email_normalized=$1 AND deleted_at IS NULL`,
      [email],
    )) as AuthUser[];
    if (
      !user?.password_hash ||
      !(await this.passwords.verify(user.password_hash, dto.password))
    ) {
      throw new UnauthorizedException("Invalid email or password");
    }
    if (user.status !== "ACTIVE") {
      throw new ForbiddenException("Account is not active");
    }

    const context = await this.accountContext(user.id);
    if (dto.audience === "PLATFORM_ADMIN" && !context.platformAdmin) {
      throw new ForbiddenException("Platform administrator access required");
    }
    if (dto.audience === "CUSTOMER" && !context.organizations.length) {
      throw new ForbiddenException("No active organization membership");
    }

    const mfa = await this.verifyLoginMfa(user.id, dto.mfaCode);
    const tokens = await this.createSession(
      user.id,
      ipAddress,
      userAgent,
      mfa.verified,
    );
    await this.dataSource.query(
      `UPDATE whatsapp_core.users SET last_login_at=now(),updated_at=now() WHERE id=$1`,
      [user.id],
    );
    return {
      ...this.authResponse(user, tokens, context),
      mfaSetupRequired: mfa.setupRequired,
    };
  }

  async register(dto: RegisterDto, ipAddress?: string) {
    const email = dto.email.trim().toLowerCase();
    const userId = randomUUID();
    const organizationId = randomUUID();
    const verificationToken = randomBytes(32).toString("base64url");
    const passwordHash = await this.passwords.hash(dto.password);

    try {
      await this.tenants.runAsPlatformAdmin(async (manager) => {
        const [ownerRole] = await manager.query(
          `SELECT id FROM whatsapp_core.roles WHERE organization_id IS NULL AND code='owner' AND status='ACTIVE'`,
        );
        if (!ownerRole) throw new Error("Seeded owner role is missing");

        const [user] = await manager.query(
          `INSERT INTO whatsapp_core.users(id,email_normalized,email_display,full_name,password_hash,status)
           VALUES($1,$2,$3,$4,$5,'PENDING_VERIFICATION') RETURNING id`,
          [userId, email, dto.email.trim(), dto.fullName.trim(), passwordHash],
        );
        await manager.query(
          `INSERT INTO whatsapp_core.organizations(id,name,slug,country_code,currency_code,timezone)
           VALUES($1,$2,$3,$4,$5,$6)`,
          [
            organizationId,
            dto.name.trim(),
            dto.slug,
            dto.countryCode,
            dto.currencyCode,
            dto.timezone,
          ],
        );
        await manager.query(
          `INSERT INTO whatsapp_core.organization_members(organization_id,user_id,role_id,status)
           VALUES($1,$2,$3,'ACTIVE')`,
          [organizationId, user.id, ownerRole.id],
        );
        await manager.query(
          `INSERT INTO whatsapp_core.email_verifications(user_id,token_hash,expires_at)
           VALUES($1,$2,now()+($3 || ' seconds')::interval)`,
          [
            user.id,
            this.digest(verificationToken),
            this.config.get("EMAIL_VERIFICATION_TTL_SECONDS", 86400),
          ],
        );
        await manager.query(
          `INSERT INTO whatsapp_core.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,ip_address)
           VALUES($1,$2,'account.registered','user',$2,$3)`,
          [organizationId, user.id, ipAddress ?? null],
        );
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        const message = String(error.constraint).includes("organizations_slug")
          ? "Organization URL is already in use"
          : "An account with this email already exists";
        throw new ConflictException(message);
      }
      throw error;
    }

    await this.queueVerification(email, dto.fullName, verificationToken);
    return {
      email,
      requiresEmailVerification: true,
      ...(this.config.isLocalOnly() && !this.identityEmail.isConfigured()
        ? { verificationToken }
        : {}),
    };
  }

  async verifyEmail(
    dto: VerifyEmailDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.tenants.runAsPlatformAdmin(async (manager) => {
      const [record] = await manager.query(
        `SELECT v.id,u.id AS user_id,u.email_normalized,u.email_display,u.full_name,u.password_hash,u.status
         FROM whatsapp_core.email_verifications v
         JOIN whatsapp_core.users u ON u.id=v.user_id
         WHERE v.token_hash=$1 AND v.consumed_at IS NULL AND v.expires_at>now() AND u.deleted_at IS NULL
         FOR UPDATE OF v,u`,
        [this.digest(dto.token)],
      );
      if (!record || record.status !== "PENDING_VERIFICATION") {
        throw new UnauthorizedException("Invalid or expired verification link");
      }
      if (
        !record.password_hash ||
        !(await this.passwords.verify(record.password_hash, dto.password))
      ) {
        throw new UnauthorizedException("Invalid verification credentials");
      }
      await manager.query(
        `UPDATE whatsapp_core.email_verifications SET consumed_at=now() WHERE id=$1`,
        [record.id],
      );
      await manager.query(
        `UPDATE whatsapp_core.users SET status='ACTIVE',email_verified_at=now(),updated_at=now() WHERE id=$1`,
        [record.user_id],
      );
      await manager.query(
        `INSERT INTO whatsapp_core.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,ip_address)
         SELECT organization_id,$1,'account.email_verified','user',$1,$2
         FROM whatsapp_core.organization_members WHERE user_id=$1 ORDER BY created_at LIMIT 1`,
        [record.user_id, ipAddress ?? null],
      );
      return {
        id: record.user_id,
        email_normalized: record.email_normalized,
        email_display: record.email_display,
        full_name: record.full_name,
        status: "ACTIVE",
      } as AuthUser;
    });

    const tokens = await this.createSession(user.id, ipAddress, userAgent);
    return this.authResponse(user, tokens, await this.accountContext(user.id));
  }

  async resendVerification(dto: ResendVerificationDto) {
    const email = dto.email.trim().toLowerCase();
    const token = randomBytes(32).toString("base64url");
    const user = await this.tenants.runAsPlatformAdmin(async (manager) => {
      const [record] = await manager.query(
        `SELECT id,email_display,full_name,status FROM whatsapp_core.users
         WHERE email_normalized=$1 AND deleted_at IS NULL FOR UPDATE`,
        [email],
      );
      if (!record || record.status !== "PENDING_VERIFICATION") return null;
      await manager.query(
        `UPDATE whatsapp_core.email_verifications SET consumed_at=now()
         WHERE user_id=$1 AND consumed_at IS NULL`,
        [record.id],
      );
      await manager.query(
        `INSERT INTO whatsapp_core.email_verifications(user_id,token_hash,expires_at)
         VALUES($1,$2,now()+($3 || ' seconds')::interval)`,
        [
          record.id,
          this.digest(token),
          this.config.get("EMAIL_VERIFICATION_TTL_SECONDS", 86400),
        ],
      );
      return record;
    });
    if (user) await this.queueVerification(email, user.full_name, token);
    return {
      message:
        "If the account is awaiting verification, a new link has been issued.",
      ...(user &&
      this.config.isLocalOnly() &&
      !this.identityEmail.isConfigured()
        ? { verificationToken: token }
        : {}),
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const token = randomBytes(32).toString("base64url");
    const user = await this.tenants.runAsPlatformAdmin(async (manager) => {
      const [record] = await manager.query(
        `SELECT id,email_display,full_name FROM whatsapp_core.users
         WHERE email_normalized=$1 AND status='ACTIVE' AND deleted_at IS NULL FOR UPDATE`,
        [email],
      );
      if (!record) return null;
      await manager.query(
        `UPDATE whatsapp_core.password_resets SET consumed_at=now()
         WHERE user_id=$1 AND consumed_at IS NULL`,
        [record.id],
      );
      await manager.query(
        `INSERT INTO whatsapp_core.password_resets(user_id,token_hash,expires_at)
         VALUES($1,$2,now()+($3 || ' seconds')::interval)`,
        [
          record.id,
          this.digest(token),
          this.config.get("PASSWORD_RESET_TTL_SECONDS", 3600),
        ],
      );
      return record;
    });
    if (user)
      await this.identityEmail.queuePasswordReset({
        email,
        fullName: user.full_name,
        token,
      });
    return {
      message:
        "If an active account exists, a password reset link has been issued.",
      ...(user &&
      this.config.isLocalOnly() &&
      !this.identityEmail.isConfigured()
        ? { resetToken: token }
        : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto, ipAddress?: string) {
    const passwordHash = await this.passwords.hash(dto.password);
    await this.tenants.runAsPlatformAdmin(async (manager) => {
      const [record] = await manager.query(
        `SELECT r.id,r.user_id
         FROM whatsapp_core.password_resets r
         JOIN whatsapp_core.users u ON u.id=r.user_id
         WHERE r.token_hash=$1 AND r.consumed_at IS NULL AND r.expires_at>now()
           AND u.status='ACTIVE' AND u.deleted_at IS NULL
         FOR UPDATE OF r,u`,
        [this.digest(dto.token)],
      );
      if (!record) {
        throw new UnauthorizedException(
          "Invalid or expired password reset link",
        );
      }
      await manager.query(
        `UPDATE whatsapp_core.password_resets SET consumed_at=now() WHERE id=$1`,
        [record.id],
      );
      await manager.query(
        `UPDATE whatsapp_core.users SET password_hash=$2,updated_at=now() WHERE id=$1`,
        [record.user_id, passwordHash],
      );
      await manager.query(
        `UPDATE whatsapp_core.sessions
         SET revoked_at=COALESCE(revoked_at,now()),revocation_reason=COALESCE(revocation_reason,'Password reset')
         WHERE user_id=$1 AND revoked_at IS NULL`,
        [record.user_id],
      );
      await manager.query(
        `INSERT INTO whatsapp_core.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,ip_address)
         SELECT organization_id,$1,'account.password_reset','user',$1,$2
         FROM whatsapp_core.organization_members WHERE user_id=$1 ORDER BY created_at LIMIT 1`,
        [record.user_id, ipAddress ?? null],
      );
    });
    return { message: "Password updated. Sign in with your new password." };
  }

  async acceptInvitation(
    dto: AcceptInvitationDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.tenants.runAsPlatformAdmin(async (manager) => {
      const [invitation] = await manager.query(
        `SELECT i.id,i.organization_id,i.email_normalized,i.role_id,i.invited_by_user_id
         FROM whatsapp_core.invitations i
         WHERE i.token_hash=$1 AND i.status='PENDING' AND i.expires_at>now()
         FOR UPDATE`,
        [this.digest(dto.token)],
      );
      if (!invitation) {
        throw new UnauthorizedException("Invalid or expired invitation");
      }

      let [record] = await manager.query(
        `SELECT id,email_normalized,email_display,full_name,password_hash,status
         FROM whatsapp_core.users WHERE email_normalized=$1 AND deleted_at IS NULL FOR UPDATE`,
        [invitation.email_normalized],
      );
      if (record?.status === "ACTIVE") {
        if (
          !record.password_hash ||
          !(await this.passwords.verify(record.password_hash, dto.password))
        ) {
          throw new UnauthorizedException("Invalid invitation credentials");
        }
      } else if (record?.status === "PENDING_VERIFICATION") {
        if (!isStrongPassword(dto.password)) {
          throw new BadRequestException(
            "Password must include uppercase, lowercase, number, and special character",
          );
        }
        await manager.query(
          `UPDATE whatsapp_core.users SET full_name=$2,password_hash=$3,status='ACTIVE',email_verified_at=now(),updated_at=now()
           WHERE id=$1`,
          [record.id, dto.fullName.trim(), passwordHash],
        );
        record = {
          ...record,
          full_name: dto.fullName.trim(),
          status: "ACTIVE",
        };
      } else if (record) {
        throw new ForbiddenException("Account is not active");
      } else {
        if (!isStrongPassword(dto.password)) {
          throw new BadRequestException(
            "Password must include uppercase, lowercase, number, and special character",
          );
        }
        [record] = await manager.query(
          `INSERT INTO whatsapp_core.users(email_normalized,email_display,full_name,password_hash,status,email_verified_at)
           VALUES($1,$1,$2,$3,'ACTIVE',now())
           RETURNING id,email_normalized,email_display,full_name,password_hash,status`,
          [invitation.email_normalized, dto.fullName.trim(), passwordHash],
        );
      }

      try {
        await manager.query(
          `INSERT INTO whatsapp_core.organization_members(organization_id,user_id,role_id,status,invited_by_user_id)
           VALUES($1,$2,$3,'ACTIVE',$4)`,
          [
            invitation.organization_id,
            record.id,
            invitation.role_id,
            invitation.invited_by_user_id,
          ],
        );
      } catch (error: any) {
        if (error?.code === "23505") {
          throw new ConflictException(
            "This account already belongs to the workspace",
          );
        }
        throw error;
      }
      await manager.query(
        `UPDATE whatsapp_core.invitations SET status='ACCEPTED',accepted_at=now(),updated_at=now() WHERE id=$1`,
        [invitation.id],
      );
      await manager.query(
        `INSERT INTO whatsapp_core.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,ip_address)
         VALUES($1,$2,'invitation.accepted','invitation',$3,$4)`,
        [
          invitation.organization_id,
          record.id,
          invitation.id,
          ipAddress ?? null,
        ],
      );
      return record as AuthUser;
    });

    const tokens = await this.createSession(user.id, ipAddress, userAgent);
    return this.authResponse(user, tokens, await this.accountContext(user.id));
  }

  async refresh(dto: RefreshDto) {
    if (!dto.refreshToken)
      throw new UnauthorizedException("Refresh cookie is missing");
    let claims: TokenClaims;
    try {
      claims = await this.jwt.verifyAsync<TokenClaims>(dto.refreshToken, {
        secret: this.config.getJwtRefreshSecret(),
        algorithms: ["HS256"],
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (claims.type !== "refresh" || !claims.sub || !claims.sid) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const [session] = await this.dataSource.query(
      `SELECT id,user_id,token_hash,expires_at,revoked_at FROM whatsapp_core.sessions WHERE id=$1 AND user_id=$2`,
      [claims.sid, claims.sub],
    );
    if (
      !session ||
      session.revoked_at ||
      new Date(session.expires_at) <= new Date()
    ) {
      throw new UnauthorizedException("Session has expired");
    }
    const actual = Buffer.from(this.digest(dto.refreshToken), "hex");
    const expected = Buffer.from(session.token_hash, "hex");
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw new UnauthorizedException("Refresh token has already been rotated");
    }
    const [user] = await this.dataSource.query(
      `SELECT id,email_normalized,email_display,full_name,status FROM whatsapp_core.users WHERE id=$1 AND deleted_at IS NULL`,
      [claims.sub],
    );
    if (!user || user.status !== "ACTIVE") throw new UnauthorizedException();
    const tokens = await this.rotateSession(claims.sub, claims.sid);
    return this.authResponse(user, tokens, await this.accountContext(user.id));
  }

  async me(userId: string) {
    const [user] = await this.dataSource.query(
      `SELECT id,email_display AS email,"full_name" AS "fullName",phone_e164 AS "phoneE164",status,
              email_verified_at AS "emailVerifiedAt",last_login_at AS "lastLoginAt",created_at AS "createdAt"
       FROM whatsapp_core.users WHERE id=$1 AND deleted_at IS NULL`,
      [userId],
    );
    if (!user) throw new NotFoundException("User not found");
    return { user, ...(await this.accountContext(userId)) };
  }

  async logout(sessionId: string) {
    await this.dataSource.query(
      `UPDATE whatsapp_core.sessions SET revoked_at=now(),revocation_reason='USER_LOGOUT' WHERE id=$1 AND revoked_at IS NULL`,
      [sessionId],
    );
  }

  sessions(userId: string) {
    return this.dataSource.query(
      `SELECT id,ip_address AS "ipAddress",user_agent AS "userAgent",expires_at AS "expiresAt",
              revoked_at AS "revokedAt",revocation_reason AS "revocationReason",last_seen_at AS "lastSeenAt",created_at AS "createdAt"
       FROM whatsapp_core.sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [userId],
    );
  }

  async revokeSession(userId: string, sessionId: string, reason: string) {
    const result = await this.dataSource.query(
      `UPDATE whatsapp_core.sessions SET revoked_at=now(),revocation_reason=$3
       WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id`,
      [sessionId, userId, reason],
    );
    const rows = Array.isArray(result[0]) ? result[0] : result;
    if (!rows.length) throw new NotFoundException("Active session not found");
    return { id: sessionId, revoked: true };
  }

  workspace(organizationId: string) {
    return this.tenants.run(organizationId, async (manager) => {
      const [organization] = await manager.query(
        `SELECT id,name,slug,country_code AS "countryCode",currency_code AS "currencyCode",timezone,data_region AS "dataRegion",status,created_at AS "createdAt"
         FROM whatsapp_core.organizations WHERE id=$1`,
        [organizationId],
      );
      return organization;
    });
  }

  members(organizationId: string, limit: number) {
    return this.tenants.run(organizationId, (manager) =>
      manager.query(
        `SELECT m.id,m.user_id AS "userId",u.full_name AS "fullName",u.email_display AS email,
              m.role_id AS "roleId",r.name AS role,m.status,m.joined_at AS "joinedAt",m.created_at AS "createdAt"
       FROM whatsapp_core.organization_members m JOIN whatsapp_core.users u ON u.id=m.user_id
       JOIN whatsapp_core.roles r ON r.id=m.role_id WHERE m.organization_id=$1
       ORDER BY m.created_at DESC LIMIT $2`,
        [organizationId, limit],
      ),
    );
  }

  roles(organizationId: string) {
    return this.tenants.run(organizationId, (manager) =>
      manager.query(
        `SELECT id,name,code,scope,status,is_system AS "isSystem" FROM whatsapp_core.roles
       WHERE (organization_id IS NULL OR organization_id=$1) AND scope='ORGANIZATION' AND status='ACTIVE' ORDER BY name`,
        [organizationId],
      ),
    );
  }

  invitations(organizationId: string, limit: number) {
    return this.tenants.run(organizationId, (manager) =>
      manager.query(
        `SELECT i.id,i.email_normalized AS email,i.role_id AS "roleId",r.name AS role,i.status,
              i.expires_at AS "expiresAt",i.accepted_at AS "acceptedAt",i.created_at AS "createdAt"
       FROM whatsapp_core.invitations i JOIN whatsapp_core.roles r ON r.id=i.role_id
       WHERE i.organization_id=$1 ORDER BY i.created_at DESC LIMIT $2`,
        [organizationId, limit],
      ),
    );
  }

  async invite(
    organizationId: string,
    actorId: string,
    dto: CreateInvitationDto,
  ) {
    const token = randomBytes(32).toString("base64url");
    try {
      const invitation = await this.tenants.run(
        organizationId,
        async (manager) => {
          const role = await manager.query(
            `SELECT id FROM whatsapp_core.roles WHERE id=$1 AND scope='ORGANIZATION' AND status='ACTIVE' AND (organization_id IS NULL OR organization_id=$2)`,
            [dto.roleId, organizationId],
          );
          if (!role.length) throw new NotFoundException("Role not found");
          const [row] = await manager.query(
            `INSERT INTO whatsapp_core.invitations(organization_id,email_normalized,role_id,token_hash,invited_by_user_id,expires_at)
           VALUES($1,$2,$3,$4,$5,now()+($6 || ' days')::interval)
           RETURNING id,email_normalized AS email,role_id AS "roleId",status,expires_at AS "expiresAt",created_at AS "createdAt"`,
            [
              organizationId,
              dto.email.trim().toLowerCase(),
              dto.roleId,
              this.digest(token),
              actorId,
              dto.expiresInDays,
            ],
          );
          return row;
        },
      );
      return { ...invitation, token };
    } catch (error: any) {
      if (error?.code === "23505")
        throw new ConflictException("An active invitation already exists");
      throw error;
    }
  }

  async updateMember(
    organizationId: string,
    memberId: string,
    dto: UpdateMemberDto,
  ) {
    return this.tenants.run(organizationId, async (manager) => {
      if (dto.roleId) {
        const roles = await manager.query(
          `SELECT id FROM whatsapp_core.roles WHERE id=$1 AND scope='ORGANIZATION' AND status='ACTIVE' AND (organization_id IS NULL OR organization_id=$2)`,
          [dto.roleId, organizationId],
        );
        if (!roles.length) throw new NotFoundException("Role not found");
      }
      const [row] = await manager.query(
        `UPDATE whatsapp_core.organization_members SET role_id=coalesce($3,role_id),status=coalesce($4,status),
          suspended_at=CASE WHEN $4='SUSPENDED' THEN now() WHEN $4='ACTIVE' THEN NULL ELSE suspended_at END,updated_at=now()
         WHERE id=$1 AND organization_id=$2 RETURNING id,user_id AS "userId",role_id AS "roleId",status,updated_at AS "updatedAt"`,
        [memberId, organizationId, dto.roleId ?? null, dto.status ?? null],
      );
      if (!row) throw new NotFoundException("Member not found");
      return row;
    });
  }

  securityEvents(organizationId: string, limit: number) {
    return this.tenantList(
      organizationId,
      `SELECT id,user_id AS "userId",event_type AS "eventType",severity,ip_address AS "ipAddress",metadata,resolved_at AS "resolvedAt",created_at AS "createdAt" FROM whatsapp_core.security_events WHERE organization_id=$1 ORDER BY created_at DESC LIMIT $2`,
      limit,
    );
  }

  auditLogs(organizationId: string, limit: number) {
    return this.tenantList(
      organizationId,
      `SELECT id,actor_user_id AS "actorUserId",action,resource_type AS "resourceType",resource_id AS "resourceId",ip_address AS "ipAddress",request_id AS "requestId",metadata,created_at AS "createdAt" FROM whatsapp_core.audit_logs WHERE organization_id=$1 ORDER BY created_at DESC LIMIT $2`,
      limit,
    );
  }

  mfaFactors(userId: string) {
    return this.dataSource.query(
      `SELECT id,type,name,status,verified_at AS "verifiedAt",created_at AS "createdAt"
       FROM whatsapp_core.user_mfa_factors WHERE user_id=$1 AND status<>'REVOKED' ORDER BY created_at DESC`,
      [userId],
    );
  }

  async setupMfa(userId: string, dto: MfaSetupDto) {
    const id = randomUUID();
    const secret = this.totp.secret();
    const encrypted = await this.encryption.encrypt(
      Buffer.from(secret),
      `mfa:${userId}:${id}`,
    );
    try {
      await this.dataSource.query(
        `INSERT INTO whatsapp_core.user_mfa_factors(id,user_id,type,name,secret_ciphertext,secret_nonce,secret_auth_tag,key_version)
         VALUES($1,$2,'TOTP',$3,$4,$5,$6,$7)`,
        [
          id,
          userId,
          dto.name.trim(),
          encrypted.ciphertext,
          encrypted.nonce,
          encrypted.authTag,
          encrypted.keyVersion,
        ],
      );
    } catch (error: any) {
      if (error?.code === "23505")
        throw new ConflictException("An MFA factor with this name exists");
      throw error;
    }
    const [user] = await this.dataSource.query(
      `SELECT email_display FROM whatsapp_core.users WHERE id=$1`,
      [userId],
    );
    return {
      id,
      secret,
      provisioningUri: this.totp.uri(secret, user.email_display, "Relay"),
    };
  }

  async verifyMfa(userId: string, sessionId: string, dto: MfaVerifyDto) {
    const [factor] = await this.dataSource.query(
      `SELECT id,secret_ciphertext,secret_nonce,secret_auth_tag,key_version,status
       FROM whatsapp_core.user_mfa_factors WHERE id=$1 AND user_id=$2 AND status='PENDING'`,
      [dto.factorId, userId],
    );
    if (!factor) throw new NotFoundException("Pending MFA factor not found");
    const secret = (
      await this.encryption.decrypt(
        {
          ciphertext: factor.secret_ciphertext,
          nonce: factor.secret_nonce,
          authTag: factor.secret_auth_tag,
          keyVersion: factor.key_version,
        },
        `mfa:${userId}:${factor.id}`,
      )
    ).toString("utf8");
    if (!this.totp.verify(secret, dto.code))
      throw new UnauthorizedException("Invalid MFA code");
    await this.dataSource.transaction(async (m) => {
      await m.query(
        `UPDATE whatsapp_core.user_mfa_factors SET status='ACTIVE',verified_at=now(),updated_at=now() WHERE id=$1 AND user_id=$2`,
        [factor.id, userId],
      );
      await m.query(
        `UPDATE whatsapp_core.sessions SET mfa_verified_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL`,
        [sessionId, userId],
      );
      await m.query(
        `INSERT INTO whatsapp_core.security_events(user_id,event_type,severity,metadata) VALUES($1,'MFA_ENROLLED','MEDIUM',jsonb_build_object('factorId',$2))`,
        [userId, factor.id],
      );
    });
    return { id: factor.id, status: "ACTIVE" };
  }

  async revokeMfa(userId: string, factorId: string, dto: MfaRevokeDto) {
    const [user] = await this.dataSource.query(
      `SELECT password_hash FROM whatsapp_core.users WHERE id=$1 AND status='ACTIVE'`,
      [userId],
    );
    if (
      !user?.password_hash ||
      !(await this.passwords.verify(user.password_hash, dto.password))
    )
      throw new UnauthorizedException("Reauthentication failed");
    const [factor] = await this.dataSource.query(
      `SELECT id,secret_ciphertext,secret_nonce,secret_auth_tag,key_version FROM whatsapp_core.user_mfa_factors
       WHERE id=$1 AND user_id=$2 AND status='ACTIVE'`,
      [factorId, userId],
    );
    if (!factor) throw new NotFoundException("Active MFA factor not found");
    const [required] = await this.dataSource.query(
      `SELECT 1 FROM whatsapp_core.organization_members m JOIN whatsapp_core.organization_security_policies p
       ON p.organization_id=m.organization_id WHERE m.user_id=$1 AND m.status='ACTIVE' AND p.require_mfa LIMIT 1`,
      [userId],
    );
    const [count] = await this.dataSource.query(
      `SELECT count(*)::integer count FROM whatsapp_core.user_mfa_factors WHERE user_id=$1 AND status='ACTIVE'`,
      [userId],
    );
    if (required && count.count <= 1)
      throw new ConflictException(
        "The last MFA factor cannot be removed while an organization requires MFA",
      );
    const secret = (
      await this.encryption.decrypt(
        {
          ciphertext: factor.secret_ciphertext,
          nonce: factor.secret_nonce,
          authTag: factor.secret_auth_tag,
          keyVersion: factor.key_version,
        },
        `mfa:${userId}:${factor.id}`,
      )
    ).toString("utf8");
    if (!dto.code || !this.totp.verify(secret, dto.code))
      throw new UnauthorizedException("A valid MFA code is required");
    await this.dataSource.transaction(async (m) => {
      await m.query(
        `UPDATE whatsapp_core.user_mfa_factors SET status='REVOKED',updated_at=now(),secret_ciphertext='\\x'::bytea,
         secret_nonce=decode(repeat('00',12),'hex'),secret_auth_tag=decode(repeat('00',16),'hex') WHERE id=$1 AND user_id=$2`,
        [factorId, userId],
      );
      await m.query(
        `UPDATE whatsapp_core.sessions SET revoked_at=now(),revocation_reason='MFA factor revoked' WHERE user_id=$1 AND revoked_at IS NULL`,
        [userId],
      );
    });
    return { id: factorId, status: "REVOKED", sessionsRevoked: true };
  }

  async createOrganization(userId: string, dto: CreateOrganizationDto) {
    try {
      return await this.tenants.runAsPlatformAdmin(async (manager) => {
        const ownerRole = (
          await manager.query(
            `SELECT id FROM whatsapp_core.roles WHERE organization_id IS NULL AND code='owner' AND status='ACTIVE'`,
          )
        )[0];
        if (!ownerRole) throw new Error("Seeded owner role is missing");
        const id = randomUUID();
        const [organization] = await manager.query(
          `INSERT INTO whatsapp_core.organizations(id,name,slug,country_code,currency_code,timezone) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
          [
            id,
            dto.name.trim(),
            dto.slug,
            dto.countryCode,
            dto.currencyCode,
            dto.timezone,
          ],
        );
        await manager.query(
          `INSERT INTO whatsapp_core.organization_members(organization_id,user_id,role_id,status) VALUES($1,$2,$3,'ACTIVE')`,
          [id, userId, ownerRole.id],
        );
        return organization;
      });
    } catch (error: any) {
      if (error?.code === "23505")
        throw new ConflictException("Organization slug already exists");
      throw error;
    }
  }

  private tenantList(organizationId: string, sql: string, limit: number) {
    return this.tenants.run(organizationId, (manager) =>
      manager.query(sql, [organizationId, limit]),
    );
  }

  private async queueVerification(
    email: string,
    fullName: string,
    token: string,
  ): Promise<void> {
    try {
      await this.identityEmail.queueVerification({ email, fullName, token });
    } catch (error: any) {
      ConsoleLogger.error(
        "Unable to queue account verification email",
        error?.stack,
        "IdentityService",
      );
    }
  }

  private async accountContext(userId: string) {
    return this.tenants.runAsPlatformAdmin(async (manager) => {
      const organizations = await manager.query(
        `SELECT o.id,o.name,o.slug,m.role_id AS "roleId",r.code AS role
         FROM whatsapp_core.organization_members m JOIN whatsapp_core.organizations o ON o.id=m.organization_id
         JOIN whatsapp_core.roles r ON r.id=m.role_id
         WHERE m.user_id=$1 AND m.status='ACTIVE' AND o.status='ACTIVE' ORDER BY o.name`,
        [userId],
      );
      const [platformAdmin] = await manager.query(
        `SELECT id,role FROM whatsapp_core.platform_admins WHERE user_id=$1 AND status='ACTIVE'`,
        [userId],
      );
      return { organizations, platformAdmin: platformAdmin ?? null };
    });
  }

  private async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    mfaVerified = false,
  ) {
    const sessionId = randomUUID();
    const [policy] = await this.dataSource.query(
      `SELECT min(p.session_lifetime_minutes)::integer minutes
       FROM whatsapp_core.organization_members m JOIN whatsapp_core.organization_security_policies p ON p.organization_id=m.organization_id
       WHERE m.user_id=$1 AND m.status='ACTIVE'`,
      [userId],
    );
    const configuredMs = this.durationMs(
      this.config.get("JWT_REFRESH_EXPIRES_IN", "7d"),
    );
    const policyMs = policy?.minutes
      ? Number(policy.minutes) * 60_000
      : configuredMs;
    const expiresAt = new Date(Date.now() + Math.min(configuredMs, policyMs));
    await this.dataSource.query(
      `INSERT INTO whatsapp_core.sessions(id,user_id,token_hash,ip_address,user_agent,expires_at,last_seen_at,mfa_verified_at)
       VALUES($1,$2,$3,$4,$5,$6,now(),CASE WHEN $7 THEN now() ELSE NULL END)`,
      [
        sessionId,
        userId,
        randomBytes(32).toString("hex"),
        ipAddress ?? null,
        userAgent?.slice(0, 1024) ?? null,
        expiresAt,
        mfaVerified,
      ],
    );
    return this.rotateSession(userId, sessionId);
  }

  private async verifyLoginMfa(userId: string, code?: string) {
    const [factor] = await this.dataSource.query(
      `SELECT id,secret_ciphertext,secret_nonce,secret_auth_tag,key_version FROM whatsapp_core.user_mfa_factors
       WHERE user_id=$1 AND status='ACTIVE' ORDER BY verified_at LIMIT 1`,
      [userId],
    );
    const [required] = await this.dataSource.query(
      `SELECT 1 FROM whatsapp_core.organization_members m JOIN whatsapp_core.organization_security_policies p
       ON p.organization_id=m.organization_id WHERE m.user_id=$1 AND m.status='ACTIVE' AND p.require_mfa LIMIT 1`,
      [userId],
    );
    if (!factor) return { verified: false, setupRequired: Boolean(required) };
    if (!code) throw new UnauthorizedException("Multi-factor code required");
    const secret = (
      await this.encryption.decrypt(
        {
          ciphertext: factor.secret_ciphertext,
          nonce: factor.secret_nonce,
          authTag: factor.secret_auth_tag,
          keyVersion: factor.key_version,
        },
        `mfa:${userId}:${factor.id}`,
      )
    ).toString("utf8");
    if (!this.totp.verify(secret, code))
      throw new UnauthorizedException("Invalid email, password, or MFA code");
    return { verified: true, setupRequired: false };
  }

  private async rotateSession(userId: string, sessionId: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId, type: "access" },
      {
        secret: this.config.getJwtAccessSecret(),
        algorithm: "HS256",
        expiresIn: this.config.get("JWT_ACCESS_EXPIRES_IN", "15m") as any,
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId, type: "refresh", jti: randomUUID() },
      {
        secret: this.config.getJwtRefreshSecret(),
        algorithm: "HS256",
        expiresIn: this.config.get("JWT_REFRESH_EXPIRES_IN", "7d") as any,
      },
    );
    await this.dataSource.query(
      `UPDATE whatsapp_core.sessions SET token_hash=$2,last_seen_at=now() WHERE id=$1`,
      [sessionId, this.digest(refreshToken)],
    );
    return { accessToken, refreshToken };
  }

  private authResponse(
    user: AuthUser,
    tokens: { accessToken: string; refreshToken: string },
    context: any,
  ) {
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email_display,
        fullName: user.full_name,
      },
      organizations: context.organizations,
      platformAdmin: context.platformAdmin,
    };
  }

  private digest(token: string) {
    return createHmac("sha256", this.config.getJwtRefreshSecret())
      .update(token)
      .digest("hex");
  }

  private durationMs(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match)
      throw new Error("JWT_REFRESH_EXPIRES_IN must use s, m, h, or d");
    return (
      Number(match[1]) *
      ({ s: 1000, m: 60000, h: 3600000, d: 86400000 } as const)[
        match[2] as "s" | "m" | "h" | "d"
      ]
    );
  }
}
