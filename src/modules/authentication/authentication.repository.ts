import { Injectable } from "@nestjs/common";
import { DataSource, EntityTarget } from "typeorm";
import {
  EmailVerificationEntity,
  PasswordResetEntity,
} from "../database/entities";

type ConsumableToken = EmailVerificationEntity | PasswordResetEntity;

@Injectable()
export class AuthenticationRepository {
  constructor(private readonly dataSource: DataSource) {}

  consumeEmailVerification(
    tokenHash: string,
  ): Promise<EmailVerificationEntity | null> {
    return this.consume(
      EmailVerificationEntity,
      "email_verifications",
      tokenHash,
    );
  }

  consumePasswordReset(tokenHash: string): Promise<PasswordResetEntity | null> {
    return this.consume(PasswordResetEntity, "password_resets", tokenHash);
  }

  private async consume<T extends ConsumableToken>(
    entity: EntityTarget<T>,
    table: string,
    tokenHash: string,
  ): Promise<T | null> {
    return this.dataSource.transaction(async (manager) => {
      const result: T[] | [T[], number] = await manager.query(
        `UPDATE whatsapp_core.${table} SET consumed_at = now()
         WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
         RETURNING *`,
        [tokenHash],
      );
      const rows = Array.isArray(result[0]) ? result[0] : (result as T[]);
      return rows[0] ? manager.create(entity, rows[0]) : null;
    });
  }
}
