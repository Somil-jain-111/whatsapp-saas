import "reflect-metadata";
import * as argon2 from "argon2";
import { randomUUID } from "crypto";
import { AppDataSource } from "../../../default/databases/mysql/migration.config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function bootstrap(): Promise<void> {
  if (AppDataSource.options.type !== "postgres") {
    throw new Error("Phase 1 account bootstrap requires DB_TYPE=postgres");
  }
  const email = required("BOOTSTRAP_EMAIL").toLowerCase();
  const password = required("BOOTSTRAP_PASSWORD");
  if (password.length < 12) {
    throw new Error("BOOTSTRAP_PASSWORD must contain at least 12 characters");
  }
  const fullName = required("BOOTSTRAP_FULL_NAME");
  const organizationName = required("BOOTSTRAP_ORGANIZATION_NAME");
  const organizationSlug = required("BOOTSTRAP_ORGANIZATION_SLUG");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organizationSlug)) {
    throw new Error("BOOTSTRAP_ORGANIZATION_SLUG must be lowercase kebab-case");
  }
  const countryCode = (
    process.env.BOOTSTRAP_COUNTRY_CODE || "IN"
  ).toUpperCase();
  const currencyCode = (
    process.env.BOOTSTRAP_CURRENCY_CODE || "INR"
  ).toUpperCase();
  const timezone = process.env.BOOTSTRAP_TIMEZONE || "Asia/Kolkata";
  const platformAdmin = process.env.BOOTSTRAP_PLATFORM_ADMIN === "true";
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });

  await AppDataSource.initialize();
  try {
    const result = await AppDataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT set_config('app.is_platform_admin','true',true)`,
      );
      const existing = await manager.query(
        `SELECT id FROM whatsapp_core.users WHERE email_normalized=$1`,
        [email],
      );
      if (existing.length)
        throw new Error("A user with BOOTSTRAP_EMAIL already exists");
      const userId = randomUUID();
      const organizationId = randomUUID();
      await manager.query(
        `INSERT INTO whatsapp_core.users(id,email_normalized,email_display,full_name,password_hash,status,email_verified_at)
         VALUES($1,$2,$2,$3,$4,'ACTIVE',now())`,
        [userId, email, fullName, passwordHash],
      );
      await manager.query(
        `INSERT INTO whatsapp_core.organizations(id,name,slug,country_code,currency_code,timezone)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [
          organizationId,
          organizationName,
          organizationSlug,
          countryCode,
          currencyCode,
          timezone,
        ],
      );
      const [ownerRole] = await manager.query(
        `SELECT id FROM whatsapp_core.roles WHERE organization_id IS NULL AND code='owner' AND status='ACTIVE'`,
      );
      if (!ownerRole)
        throw new Error(
          "Run npm run seed:phase1 before bootstrapping an account",
        );
      await manager.query(
        `INSERT INTO whatsapp_core.organization_members(organization_id,user_id,role_id,status)
         VALUES($1,$2,$3,'ACTIVE')`,
        [organizationId, userId, ownerRole.id],
      );
      if (platformAdmin) {
        await manager.query(
          `INSERT INTO whatsapp_core.platform_admins(user_id,role,status) VALUES($1,'SUPER_ADMIN','ACTIVE')`,
          [userId],
        );
      }
      return { userId, organizationId, platformAdmin };
    });
    console.log(JSON.stringify(result));
  } finally {
    await AppDataSource.destroy();
  }
}

bootstrap().catch((error) => {
  console.error(error instanceof Error ? error.message : "Bootstrap failed");
  process.exitCode = 1;
});
