import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMysqlCore1792306985999 implements MigrationInterface {
  name = "CreateMysqlCore1792306985999";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE \`system_config\` (
                \`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
                \`config_key\` varchar(100) NOT NULL,
                \`config_value\` varchar(255) NOT NULL,
                \`updated_by\` bigint UNSIGNED NULL,
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`uq_system_config_key\` (\`config_key\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
    await queryRunner.query(`
            CREATE TABLE \`content_audits\` (
                \`id\` bigint NOT NULL AUTO_INCREMENT,
                \`active\` tinyint NOT NULL DEFAULT 1,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`deleted_at\` datetime(6) NULL,
                \`resource_type\` enum (
                    'CATEGORY',
                    'PRODUCT',
                    'CMS_BANNER',
                    'CMS_ANNOUNCEMENT',
                    'CMS_SECTION',
                    'COUPON'
                ) NOT NULL,
                \`resource_id\` bigint NOT NULL,
                \`actor_id\` bigint NOT NULL,
                \`actor_role\` varchar(50) NOT NULL,
                \`action\` varchar(50) NOT NULL,
                \`changes\` json NULL,
                INDEX \`IDX_268ed410fd73893b2511b069cc\` (\`resource_type\`, \`resource_id\`, \`created_at\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX \`IDX_268ed410fd73893b2511b069cc\` ON \`content_audits\`
        `);
    await queryRunner.query(`
            DROP TABLE \`content_audits\`
        `);
    await queryRunner.query(`
            DROP INDEX \`uq_system_config_key\` ON \`system_config\`
        `);
    await queryRunner.query(`
            DROP TABLE \`system_config\`
        `);
  }
}
