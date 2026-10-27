import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { WHATSAPP_SCHEMA } from "../database.schema";

@Entity({ schema: WHATSAPP_SCHEMA, name: "users" })
@Index("uq_wa_users_email_normalized", ["emailNormalized"], { unique: true })
@Index("idx_wa_users_status_created", ["status", "createdAt"])
@Check(
  "ck_wa_users_email_normalized",
  `email_normalized = lower(btrim(email_normalized)) AND length(email_normalized) BETWEEN 3 AND 254`,
)
@Check(
  "ck_wa_users_phone_e164",
  `phone_e164 IS NULL OR phone_e164 ~ '^\\+[1-9][0-9]{1,14}$'`,
)
export class UserEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "email_normalized", type: "varchar", length: 254 })
  emailNormalized!: string;
  @Column({ name: "email_display", type: "varchar", length: 254 })
  emailDisplay!: string;
  @Column({ name: "full_name", type: "varchar", length: 150 })
  fullName!: string;
  @Column({ name: "phone_e164", type: "varchar", length: 16, nullable: true })
  phoneE164!: string | null;
  @Column({
    name: "phone_country_code",
    type: "char",
    length: 2,
    nullable: true,
  })
  phoneCountryCode!: string | null;
  @Column({ name: "phone_verified_at", type: "timestamptz", nullable: true })
  phoneVerifiedAt!: Date | null;
  @Column({
    name: "password_hash",
    type: "varchar",
    length: 255,
    nullable: true,
    select: false,
  })
  passwordHash!: string | null;
  @Column({ type: "varchar", length: 30, default: "PENDING_VERIFICATION" })
  status!: string;
  @Column({ name: "email_verified_at", type: "timestamptz", nullable: true })
  emailVerifiedAt!: Date | null;
  @Column({ name: "last_login_at", type: "timestamptz", nullable: true })
  lastLoginAt!: Date | null;
  @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
