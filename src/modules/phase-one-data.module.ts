import { Module } from "@nestjs/common";
import { AuditModule } from "./audit/audit.module";
import { AuthenticationModule } from "./authentication/authentication.module";
import { DatabaseModule } from "./database/database.module";
import { InvitationsModule } from "./invitations/invitations.module";
import { MembershipsModule } from "./memberships/memberships.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { PlatformAdminModule } from "./platform-admin/platform-admin.module";
import { RolesModule } from "./roles/roles.module";
import { SecurityModule } from "./security/security.module";
import { SessionsModule } from "./sessions/sessions.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    OrganizationsModule,
    MembershipsModule,
    RolesModule,
    PermissionsModule,
    InvitationsModule,
    SessionsModule,
    AuthenticationModule,
    AuditModule,
    SecurityModule,
    PlatformAdminModule,
  ],
})
export class PhaseOneDataModule {}
