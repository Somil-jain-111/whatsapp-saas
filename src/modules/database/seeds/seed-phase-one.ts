import { AppDataSource } from "../../../default/databases/mysql/migration.config";
import countries from "./iso-countries.json";

const currencyCodes =
  `AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES VND VUV WST XAF XAG XAU XBA XBB XBC XBD XCD XDR XOF XPD XPF XPT XSU XTS XUA XXX YER ZAR ZMW ZWG`.split(
    " ",
  );
const zeroMinorUnits = new Set(
  "BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX VND VUV XAF XOF XPF".split(" "),
);
const threeMinorUnits = new Set("BHD IQD JOD KWD LYD OMR TND".split(" "));
const fourMinorUnits = new Set(["CLF", "UYW"]);

const permissions = [
  ["organization.read", "Read organization"],
  ["organization.update", "Update organization"],
  ["member.read", "Read members"],
  ["member.invite", "Invite members"],
  ["member.manage", "Manage members"],
  ["role.read", "Read roles"],
  ["role.manage", "Manage roles"],
  ["audit.read", "Read audit logs"],
  ["security.read", "Read security events"],
  ["platform.admin.manage", "Manage platform administrators"],
  ["platform.tenant.read", "Read tenant support data"],
  ["platform.security.read", "Read platform security events"],
  ["platform.audit.read", "Read platform audit logs"],
  ["meta.integration.read", "Read Meta integrations"],
  ["meta.integration.manage", "Manage Meta integrations"],
  ["whatsapp.account.read", "Read WhatsApp accounts and phone numbers"],
  ["whatsapp.account.manage", "Manage WhatsApp accounts and phone numbers"],
  ["whatsapp.template.read", "Read WhatsApp templates"],
  ["whatsapp.template.manage", "Manage WhatsApp templates"],
  ["whatsapp.template.submit", "Submit WhatsApp templates"],
  ["whatsapp.integration.health.read", "Read WhatsApp integration health"],
  ["contacts.read", "Read contacts and segments"],
  ["contacts.manage", "Manage contacts, consent, imports, tags, and segments"],
  ["messages.read", "Read message logs and delivery status"],
  ["messages.send", "Send individual and bulk WhatsApp messages"],
  ["campaigns.read", "Read campaigns and campaign metrics"],
  ["campaigns.manage", "Create, schedule, pause, resume, and cancel campaigns"],
  ["messaging.monitor", "Monitor messaging queues and failures"],
  ["analytics.read", "Read campaign, template, message, and cost analytics"],
  ["billing.read", "Read billing data"],
  ["billing.manage", "Manage subscriptions and checkout"],
  ["usage.read", "Read usage and quotas"],
  ["reports.manage", "Create and read report exports"],
  ["developer.api_key.read", "Read developer API credentials"],
  ["developer.api_key.manage", "Manage developer API credentials"],
  ["developer.usage.read", "Read public API usage and logs"],
  ["developer.webhook.manage", "Manage developer webhooks"],
  ["platform.api.manage", "Manage tenant public API access"],
] as const;

const rolePermissions: Record<string, string[]> = {
  owner: permissions.map(([code]) => code),
  admin: permissions
    .filter(([code]) => code !== "role.manage")
    .map(([code]) => code),
  member: [
    "organization.read",
    "member.read",
    "role.read",
    "meta.integration.read",
    "whatsapp.account.read",
    "whatsapp.template.read",
    "whatsapp.integration.health.read",
    "contacts.read",
    "messages.read",
    "campaigns.read",
    "analytics.read",
  ],
  viewer: ["organization.read", "member.read", "role.read"],
  "platform.super_admin": permissions.map(([code]) => code),
  "platform.security_admin": [
    "platform.security.read",
    "platform.audit.read",
    "security.read",
  ],
  "platform.support_readonly": ["platform.tenant.read"],
  "platform.auditor": ["platform.audit.read", "platform.tenant.read"],
};

async function seed(): Promise<void> {
  if (AppDataSource.options.type !== "postgres")
    throw new Error("Phase 1 seed requires DB_TYPE=postgres");
  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT set_config('app.is_platform_admin', 'true', true)`,
      );

      for (const country of countries) {
        await manager.query(
          `INSERT INTO whatsapp_core.iso_countries(code, name) VALUES ($1, $2)
           ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`,
          [country.code, country.name],
        );
      }

      const displayNames = new Intl.DisplayNames(["en"], { type: "currency" });
      for (const code of currencyCodes) {
        const minorUnits = zeroMinorUnits.has(code)
          ? 0
          : threeMinorUnits.has(code)
            ? 3
            : fourMinorUnits.has(code)
              ? 4
              : 2;
        await manager.query(
          `INSERT INTO whatsapp_core.iso_currencies(code, name, minor_units) VALUES ($1, $2, $3)
           ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, minor_units = EXCLUDED.minor_units`,
          [code, displayNames.of(code) ?? code, minorUnits],
        );
      }

      for (const [code, name] of permissions) {
        await manager.query(
          `INSERT INTO whatsapp_core.permissions(code, name) VALUES ($1, $2)
           ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE'`,
          [code, name],
        );
      }

      for (const [code, name] of [
        ["owner", "Owner"],
        ["admin", "Administrator"],
        ["member", "Member"],
        ["viewer", "Viewer"],
      ]) {
        await manager.query(
          `INSERT INTO whatsapp_core.roles(code, name, scope, is_system) VALUES ($1, $2, 'ORGANIZATION', true)
           ON CONFLICT (code) WHERE organization_id IS NULL DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE'`,
          [code, name],
        );
      }

      for (const [code, name] of [
        ["platform.super_admin", "Platform Super Administrator"],
        ["platform.security_admin", "Platform Security Administrator"],
        ["platform.support_readonly", "Platform Read-only Support"],
        ["platform.auditor", "Platform Auditor"],
      ]) {
        await manager.query(
          `INSERT INTO whatsapp_core.roles(code, name, scope, is_system) VALUES ($1, $2, 'PLATFORM', true)
           ON CONFLICT (code) WHERE organization_id IS NULL DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE'`,
          [code, name],
        );
      }

      for (const [roleCode, codes] of Object.entries(rolePermissions)) {
        await manager.query(
          `INSERT INTO whatsapp_core.role_permissions(role_id, permission_id)
           SELECT r.id, p.id FROM whatsapp_core.roles r JOIN whatsapp_core.permissions p ON p.code = ANY($2::varchar[])
           WHERE r.organization_id IS NULL AND r.code = $1
           ON CONFLICT (role_id, permission_id) DO NOTHING`,
          [roleCode, codes],
        );
      }
    });
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((error) => {
  console.error(
    "Phase 1 database seed failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
