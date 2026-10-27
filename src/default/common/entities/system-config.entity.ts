import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("system_config")
@Index("uq_system_config_key", ["configKey"], { unique: true })
export class SystemConfigEntity {
  @PrimaryGeneratedColumn({
    type: "bigint",
    unsigned: true,
  })
  id: string;

  @Column({
    name: "config_key",
    type: "varchar",
    length: 100,
  })
  configKey: string;

  @Column({
    name: "config_value",
    type: "varchar",
    length: 255,
  })
  configValue: string;

  @Column({
    name: "updated_by",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  updatedBy?: string;

  @UpdateDateColumn({
    name: "updated_at",
  })
  updatedAt: Date;
}

export enum SystemConfigKey {
  DEFAULT_SCAN_AGE_DAYS = "DEFAULT_SCAN_AGE_DAYS",
  POINTS_EXPIRY_DAYS = "POINTS_EXPIRY_DAYS",
  MAINTENANCE_MODE = "MAINTENANCE_MODE",
  MAINTENANCE_MESSAGE = "MAINTENANCE_MESSAGE",
}
