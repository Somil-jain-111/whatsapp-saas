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

@Entity({ schema: WHATSAPP_SCHEMA, name: "organizations" })
@Index("uq_wa_organizations_slug", ["slug"], { unique: true })
@Index("idx_wa_organizations_status_created", ["status", "createdAt"])
@Check("ck_wa_organizations_slug", `slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`)
export class OrganizationEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "varchar", length: 200 }) name!: string;
  @Column({ type: "varchar", length: 100 }) slug!: string;
  @Column({ name: "country_code", type: "char", length: 2 })
  countryCode!: string;
  @Column({ name: "currency_code", type: "char", length: 3 })
  currencyCode!: string;
  @Column({ type: "varchar", length: 64 }) timezone!: string;
  @Column({
    name: "data_region",
    type: "varchar",
    length: 30,
    default: "GLOBAL",
  })
  dataRegion!: string;
  @Column({ type: "varchar", length: 30, default: "ACTIVE" }) status!: string;
  @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
