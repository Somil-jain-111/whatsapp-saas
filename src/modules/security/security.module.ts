import { Module } from "@nestjs/common";
import { PasswordHasherService } from "./password-hasher.service";
import { TokenVerifierService } from "./token-verifier.service";
import { DatabaseModule } from "../database/database.module";
import { SecurityEventsRepository } from "./security-events.repository";
import {
  FIELD_ENCRYPTION_KEY_PROVIDER,
  FieldEncryptionService,
} from "./encryption/field-encryption.service";
import { EnvironmentDataKeyProvider } from "./encryption/environment-data-key.provider";
import { TotpService } from "./totp.service";

@Module({
  imports: [DatabaseModule],
  providers: [
    PasswordHasherService,
    TokenVerifierService,
    SecurityEventsRepository,
    EnvironmentDataKeyProvider,
    {
      provide: FIELD_ENCRYPTION_KEY_PROVIDER,
      useExisting: EnvironmentDataKeyProvider,
    },
    FieldEncryptionService,
    TotpService,
  ],
  exports: [
    PasswordHasherService,
    TokenVerifierService,
    SecurityEventsRepository,
    FieldEncryptionService,
    TotpService,
  ],
})
export class SecurityModule {}
