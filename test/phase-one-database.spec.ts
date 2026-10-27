import { randomBytes, randomUUID } from "crypto";
import { DataSource, QueryRunner } from "typeorm";
import { AuthenticationRepository } from "../src/modules/authentication/authentication.repository";
import { SessionsRepository } from "../src/modules/sessions/sessions.repository";
import { SessionEntity } from "../src/modules/database/entities";
import { PHASE_ONE_ENTITIES } from "../src/modules/database/database.constants";
import { TenantContextService } from "../src/modules/database/tenant-context.service";
import { BillingRepository } from "../src/modules/billing/repositories/billing.repository";
import { EntitlementService } from "../src/modules/billing/services/entitlement.service";
import { join } from "path";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Phase 1 PostgreSQL integrity", () => {
  let dataSource: DataSource;
  let runner: QueryRunner;
  const hash = () => randomBytes(32).toString("hex");

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      url: databaseUrl,
      entities: [...PHASE_ONE_ENTITIES],
      migrations: [join(__dirname, "../src/migrations/*.{ts,js}")],
      dropSchema: true,
    });
    await dataSource.initialize();
    await dataSource.runMigrations({ transaction: "all" });
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.query(
      `SELECT set_config('app.is_platform_admin', 'true', false)`,
    );
    await runner.query(
      `INSERT INTO whatsapp_core.iso_countries(code,name) VALUES ('US','United States'),('IN','India') ON CONFLICT(code) DO NOTHING`,
    );
    await runner.query(
      `INSERT INTO whatsapp_core.iso_currencies(code,name,minor_units) VALUES ('USD','US Dollar',2),('INR','Indian Rupee',2) ON CONFLICT(code) DO NOTHING`,
    );
    await runner.query(
      `INSERT INTO whatsapp_core.permissions(code,name) VALUES ('organization.read','Read organization')`,
    );
    await runner.query(
      `INSERT INTO whatsapp_core.roles(code,name,scope,is_system) VALUES ('owner','Owner','ORGANIZATION',true),('member','Member','ORGANIZATION',true),('platform.super_admin','Super Admin','PLATFORM',true)`,
    );
    await runner.query(
      `DO $$ BEGIN CREATE ROLE wa_phase1_test_app NOLOGIN NOSUPERUSER NOBYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    );
    await runner.query(
      `GRANT USAGE ON SCHEMA whatsapp_core TO wa_phase1_test_app`,
    );
    await runner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA whatsapp_core TO wa_phase1_test_app`,
    );
  });

  afterAll(async () => {
    await runner?.release();
    await dataSource?.destroy();
  });

  async function createUser(
    email = `${randomUUID()}@example.com`,
  ): Promise<string> {
    const rows = await runner.query(
      `INSERT INTO whatsapp_core.users(email_normalized,email_display,full_name,status)
       VALUES ($1,$1,'Test User','ACTIVE') RETURNING id`,
      [email],
    );
    return rows[0].id;
  }

  async function createOrganization(
    ownerUserId: string,
    slug = `org-${randomUUID()}`,
  ): Promise<string> {
    await runner.startTransaction();
    try {
      await runner.query(`SET CONSTRAINTS ALL DEFERRED`);
      const organizations = await runner.query(
        `INSERT INTO whatsapp_core.organizations(name,slug,country_code,currency_code,timezone)
         VALUES ('Test Org',$1,'US','USD','America/New_York') RETURNING id`,
        [slug],
      );
      const roles = await runner.query(
        `SELECT id FROM whatsapp_core.roles WHERE code = 'owner' AND organization_id IS NULL`,
      );
      await runner.query(
        `INSERT INTO whatsapp_core.organization_members(organization_id,user_id,role_id) VALUES ($1,$2,$3)`,
        [organizations[0].id, ownerUserId, roles[0].id],
      );
      await runner.commitTransaction();
      return organizations[0].id;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    }
  }

  it("rejects duplicate emails, duplicate slugs, invalid phones, reference codes and statuses", async () => {
    const email = `${randomUUID()}@example.com`;
    await createUser(email);
    await expect(createUser(email)).rejects.toMatchObject({ code: "23505" });
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.users(email_normalized,email_display,full_name,phone_e164,phone_country_code) VALUES ($1,$1,'X','9876543210','US')`,
        [`${randomUUID()}@example.com`],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.users(email_normalized,email_display,full_name,status) VALUES ($1,$1,'X','UNKNOWN')`,
        [`${randomUUID()}@example.com`],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    const owner = await createUser();
    const slug = `same-${randomUUID()}`;
    await createOrganization(owner, slug);
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.organizations(name,slug,country_code,currency_code,timezone) VALUES ('X',$1,'ZZ','ZZZ','UTC')`,
        [slug],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.organizations(name,slug,country_code,currency_code,timezone) VALUES ('X',$1,'ZZ','ZZZ','UTC')`,
        [`bad-${randomUUID()}`],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("rejects duplicate memberships and invalid or cross-tenant role assignments", async () => {
    const owner1 = await createUser();
    const owner2 = await createUser();
    const org1 = await createOrganization(owner1);
    const org2 = await createOrganization(owner2);
    const memberRole = (
      await runner.query(
        `SELECT id FROM whatsapp_core.roles WHERE code='member' AND organization_id IS NULL`,
      )
    )[0].id;
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.organization_members(organization_id,user_id,role_id) VALUES ($1,$2,$3)`,
        [org1, owner1, memberRole],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    const customRole = (
      await runner.query(
        `INSERT INTO whatsapp_core.roles(organization_id,name,code,scope) VALUES ($1,'Custom','custom','ORGANIZATION') RETURNING id`,
        [org1],
      )
    )[0].id;
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.organization_members(organization_id,user_id,role_id) VALUES ($1,$2,$3)`,
        [org2, await createUser(), customRole],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    const platformRole = (
      await runner.query(
        `SELECT id FROM whatsapp_core.roles WHERE code='platform.super_admin'`,
      )
    )[0].id;
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.organization_members(organization_id,user_id,role_id) VALUES ($1,$2,$3)`,
        [org1, await createUser(), platformRole],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("enforces RLS tenant isolation", async () => {
    const org1 = await createOrganization(await createUser());
    await createOrganization(await createUser());
    await runner.query(
      `SELECT set_config('app.is_platform_admin', 'false', false)`,
    );
    await runner.query(`SELECT set_config('app.organization_id', $1, false)`, [
      org1,
    ]);
    await runner.query(`SET ROLE wa_phase1_test_app`);
    const rows = await runner.query(
      `SELECT organization_id FROM whatsapp_core.organization_members`,
    );
    expect(rows).not.toHaveLength(0);
    expect(
      new Set(
        rows.map((row: { organization_id: string }) => row.organization_id),
      ),
    ).toEqual(new Set([org1]));
    await runner.query(`RESET ROLE`);
    await runner.query(
      `SELECT set_config('app.is_platform_admin', 'true', false)`,
    );
  });

  it("prevents last-owner removal and restricts member user deletion", async () => {
    const user = await createUser();
    const org = await createOrganization(user);
    await expect(
      runner.query(
        `DELETE FROM whatsapp_core.organization_members WHERE organization_id=$1 AND user_id=$2`,
        [org, user],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      runner.query(`DELETE FROM whatsapp_core.users WHERE id=$1`, [user]),
    ).rejects.toMatchObject({ code: expect.stringMatching(/^(23503|23001)$/) });
  });

  it("consumes verification tokens once and rejects expired tokens", async () => {
    const user = await createUser();
    const valid = hash();
    const expired = hash();
    await runner.query(
      `INSERT INTO whatsapp_core.email_verifications(user_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '10 minutes')`,
      [user, valid],
    );
    await runner.query(
      `INSERT INTO whatsapp_core.email_verifications(user_id,token_hash,created_at,expires_at) VALUES ($1,$2,now()-interval '20 minutes',now()-interval '10 minutes')`,
      [user, expired],
    );
    const repository = new AuthenticationRepository(dataSource);
    await expect(
      repository.consumeEmailVerification(valid),
    ).resolves.toBeTruthy();
    await expect(
      repository.consumeEmailVerification(valid),
    ).resolves.toBeNull();
    await expect(
      repository.consumeEmailVerification(expired),
    ).resolves.toBeNull();
  });

  it("revokes sessions atomically and cascades ephemeral sessions on user deletion", async () => {
    const user = await createUser();
    const repository = new SessionsRepository(
      dataSource.getRepository(SessionEntity),
    );
    const session = await repository.create({
      userId: user,
      tokenHash: hash(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(repository.revoke(session.id, "logout")).resolves.toBe(true);
    await expect(repository.revoke(session.id, "again")).resolves.toBe(false);
    await runner.query(`DELETE FROM whatsapp_core.users WHERE id=$1`, [user]);
    expect(
      await runner.query(`SELECT id FROM whatsapp_core.sessions WHERE id=$1`, [
        session.id,
      ]),
    ).toHaveLength(0);
  });

  it("keeps audit rows immutable and metadata bounded", async () => {
    const id = (
      await runner.query(
        `INSERT INTO whatsapp_core.audit_logs(action,resource_type) VALUES ('created','organization') RETURNING id`,
      )
    )[0].id;
    await expect(
      runner.query(
        `UPDATE whatsapp_core.audit_logs SET action='changed' WHERE id=$1`,
        [id],
      ),
    ).rejects.toMatchObject({ code: "55000" });
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.security_events(event_type,severity,metadata) VALUES ('login','NOPE','{}')`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("enforces Phase 2 provider ownership and tenant foreign keys", async () => {
    const org1 = await createOrganization(await createUser());
    const org2 = await createOrganization(await createUser());
    const connection = (
      await runner.query(
        `INSERT INTO whatsapp_core.meta_connections(organization_id,status) VALUES ($1,'CONNECTING') RETURNING id`,
        [org1],
      )
    )[0].id;
    const providerAccountId = `${Date.now()}`;
    const account = (
      await runner.query(
        `INSERT INTO whatsapp_core.whatsapp_accounts(organization_id,connection_id,provider_account_id)
         VALUES ($1,$2,$3) RETURNING id`,
        [org1, connection, providerAccountId],
      )
    )[0].id;
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.message_templates(organization_id,account_id,name,language,category)
         VALUES ($1,$2,'cross_tenant','en_US','UTILITY')`,
        [org2, account],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.whatsapp_accounts(organization_id,connection_id,provider_account_id)
         VALUES ($1,$2,$3)`,
        [org1, connection, providerAccountId],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("keeps billing money exact and subscriptions tenant-scoped", async () => {
    const org1 = await createOrganization(await createUser());
    const org2 = await createOrganization(await createUser());
    const plan = (
      await runner.query(
        `INSERT INTO whatsapp_core.subscription_plans(code,version,name,effective_from) VALUES('starter',1,'Starter',now()) RETURNING id`,
      )
    )[0].id;
    const price = (
      await runner.query(
        `INSERT INTO whatsapp_core.plan_prices(plan_id,currency,interval,amount_minor,effective_from) VALUES($1,'USD','MONTH',5900,now()) RETURNING id`,
        [plan],
      )
    )[0].id;
    await runner.query(
      `INSERT INTO whatsapp_core.billing_customers(organization_id,provider,provider_customer_id) VALUES($1,'STRIPE','cus_test')`,
      [org1],
    );
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.plan_prices(plan_id,currency,interval,amount_minor,effective_from) VALUES($1,'USD','MONTH',-1,now())`,
        [plan],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    const customer = (
      await runner.query(
        `SELECT id FROM whatsapp_core.billing_customers WHERE organization_id=$1`,
        [org1],
      )
    )[0].id;
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.subscriptions(organization_id,plan_id,price_id,billing_customer_id,status) VALUES($1,$2,$3,$4,'ACTIVE')`,
        [org2, plan, price, customer],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("enforces Phase 3 contact and campaign tenant integrity", async () => {
    const user1 = await createUser();
    const user2 = await createUser();
    const org1 = await createOrganization(user1);
    const org2 = await createOrganization(user2);
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.contacts(organization_id,full_name,country_code,phone_e164,created_by_user_id)
         VALUES($1,'Invalid','US','4155552671',$2)`,
        [org1, user1],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    const contact = (
      await runner.query(
        `INSERT INTO whatsapp_core.contacts(organization_id,full_name,country_code,phone_e164,created_by_user_id)
         VALUES($1,'Valid','US','+14155552671',$2) RETURNING id`,
        [org1, user1],
      )
    )[0].id;
    const connection = (
      await runner.query(
        `INSERT INTO whatsapp_core.meta_connections(organization_id,status) VALUES($1,'CONNECTING') RETURNING id`,
        [org2],
      )
    )[0].id;
    const account = (
      await runner.query(
        `INSERT INTO whatsapp_core.whatsapp_accounts(organization_id,connection_id,provider_account_id) VALUES($1,$2,$3) RETURNING id`,
        [org2, connection, randomUUID()],
      )
    )[0].id;
    const phone = (
      await runner.query(
        `INSERT INTO whatsapp_core.whatsapp_phone_numbers(organization_id,account_id,provider_phone_number_id,display_phone_number,phone_e164)
         VALUES($1,$2,$3,'+1 415 555 0000','+14155550000') RETURNING id`,
        [org2, account, randomUUID()],
      )
    )[0].id;
    const template = (
      await runner.query(
        `INSERT INTO whatsapp_core.message_templates(organization_id,account_id,name,language,category)
         VALUES($1,$2,'test_template','en_US','UTILITY') RETURNING id`,
        [org2, account],
      )
    )[0].id;
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.campaigns(organization_id,name,sender_id,template_id,created_by_user_id)
         VALUES($1,'Cross tenant',$2,$3,$4)`,
        [org1, phone, template, user1],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    expect(contact).toBeTruthy();
  });

  it("enforces report types and unique quota notifications", async () => {
    const user = await createUser();
    const org = await createOrganization(user);
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.report_exports(organization_id,requested_by_user_id,type,format)
         VALUES($1,$2,'INVENTED','CSV')`,
        [org, user],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    const payload = {
      metricCode: "messages",
      periodEnd: new Date().toISOString(),
    };
    await runner.query(
      `INSERT INTO whatsapp_core.billing_notifications(organization_id,type,payload) VALUES($1,'QUOTA_WARNING',$2::jsonb)`,
      [org, JSON.stringify(payload)],
    );
    await expect(
      runner.query(
        `INSERT INTO whatsapp_core.billing_notifications(organization_id,type,payload) VALUES($1,'QUOTA_WARNING',$2::jsonb)`,
        [org, JSON.stringify(payload)],
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("reserves and commits quota atomically into raw and aggregate usage", async () => {
    const user = await createUser();
    const org = await createOrganization(user);
    const plan = (
      await runner.query(
        `INSERT INTO whatsapp_core.subscription_plans(code,version,name,effective_from)
         VALUES($1,1,'Quota Plan',now()) RETURNING id`,
        [`quota-${randomUUID()}`],
      )
    )[0].id;
    const price = (
      await runner.query(
        `INSERT INTO whatsapp_core.plan_prices(plan_id,currency,interval,amount_minor,effective_from)
         VALUES($1,'USD','MONTH',0,now()) RETURNING id`,
        [plan],
      )
    )[0].id;
    await runner.query(
      `INSERT INTO whatsapp_core.plan_features(plan_id,code,enabled,quota) VALUES($1,'monthly_message_operations',true,2)`,
      [plan],
    );
    await runner.query(
      `INSERT INTO whatsapp_core.subscriptions(organization_id,plan_id,price_id,status,current_period_start,current_period_end)
       VALUES($1,$2,$3,'ACTIVE',date_trunc('month',now()),date_trunc('month',now())+interval '1 month')`,
      [org, plan, price],
    );
    const tenants = new TenantContextService(dataSource);
    const entitlements = new EntitlementService(tenants);
    const reservation = await entitlements.reserveQuota(
      org,
      "monthly_message_operations",
      2,
      "integration-usage",
    );
    await entitlements.commitQuota(org, reservation.id);
    await expect(
      entitlements.reserveQuota(
        org,
        "monthly_message_operations",
        1,
        "over-limit",
      ),
    ).rejects.toThrow("Quota exceeded");
    const billing = new BillingRepository(tenants);
    const usage = await billing.usage(org);
    expect(Number(usage[0].quantity)).toBe(2);
    const reportRows = await billing.reportRows(org, "USAGE", {}, null, 100);
    expect(reportRows).toHaveLength(1);
  });

  it("upgrades a trial from an idempotent Razorpay webhook", async () => {
    const org = await createOrganization(await createUser());
    const trialPlan = (
      await runner.query(
        `INSERT INTO whatsapp_core.subscription_plans(code,version,name,trial_days,effective_from)
         VALUES($1,1,'Trial',7,now()) RETURNING id`,
        [`trial-${randomUUID()}`],
      )
    )[0].id;
    const trialPrice = (
      await runner.query(
        `INSERT INTO whatsapp_core.plan_prices(plan_id,currency,interval,amount_minor,effective_from)
         VALUES($1,'INR','MONTH',0,now()) RETURNING id`,
        [trialPlan],
      )
    )[0].id;
    const paidPlan = (
      await runner.query(
        `INSERT INTO whatsapp_core.subscription_plans(code,version,name,effective_from)
         VALUES($1,1,'Paid',now()) RETURNING id`,
        [`paid-${randomUUID()}`],
      )
    )[0].id;
    const paidPrice = (
      await runner.query(
        `INSERT INTO whatsapp_core.plan_prices(plan_id,currency,interval,amount_minor,provider,effective_from)
         VALUES($1,'INR','MONTH',99900,'RAZORPAY',now()) RETURNING id`,
        [paidPlan],
      )
    )[0].id;
    await runner.query(
      `INSERT INTO whatsapp_core.subscriptions
         (organization_id,plan_id,price_id,status,current_period_start,current_period_end,trial_end)
       VALUES($1,$2,$3,'TRIALING',now(),now()+interval '7 days',now()+interval '7 days')`,
      [org, trialPlan, trialPrice],
    );
    const billing = new BillingRepository(new TenantContextService(dataSource));
    const eventId = `event-${randomUUID()}`;
    await billing.storeWebhook("RAZORPAY", eventId, "subscription.charged", {});
    await billing.applyRazorpayEvent(eventId, "subscription.charged", {
      subscription: {
        id: `sub_${randomUUID()}`,
        customer_id: `cust_${randomUUID()}`,
        status: "active",
        current_start: Math.floor(Date.now() / 1000),
        current_end: Math.floor(Date.now() / 1000) + 2_592_000,
        notes: { organization_id: org, price_id: paidPrice },
      },
      payment: {
        id: `pay_${randomUUID()}`,
        status: "captured",
        amount: 99900,
        amount_refunded: 0,
        currency: "INR",
        created_at: Math.floor(Date.now() / 1000),
      },
    });
    const [subscription] = await runner.query(
      `SELECT provider,status,price_id FROM whatsapp_core.subscriptions WHERE organization_id=$1`,
      [org],
    );
    const [payment] = await runner.query(
      `SELECT provider,status,amount_minor FROM whatsapp_core.payments WHERE organization_id=$1`,
      [org],
    );
    expect(subscription).toMatchObject({
      provider: "RAZORPAY",
      status: "ACTIVE",
      price_id: paidPrice,
    });
    expect(payment).toMatchObject({
      provider: "RAZORPAY",
      status: "PAID",
      amount_minor: "99900",
    });
  });
});
