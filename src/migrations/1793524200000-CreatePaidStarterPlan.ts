import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePaidStarterPlan1793524200000 implements MigrationInterface {
  name = "CreatePaidStarterPlan1793524200000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      UPDATE whatsapp_core.subscription_plans
      SET description='Try Relay with up to 10 WhatsApp message operations.',updated_at=now()
      WHERE id='00000000-0000-4000-8000-000000000041';
      UPDATE whatsapp_core.plan_features SET quota=10
      WHERE plan_id='00000000-0000-4000-8000-000000000041' AND code='monthly_message_operations';
      INSERT INTO whatsapp_core.plan_features(id,plan_id,code,enabled,quota)
      VALUES('00000000-0000-4000-8000-000000000048','00000000-0000-4000-8000-000000000041','meta_integration',false,NULL)
      ON CONFLICT(plan_id,code) DO UPDATE SET enabled=false,quota=NULL;

      INSERT INTO whatsapp_core.subscription_plans
        (id,code,version,name,description,status,trial_days,display_order,effective_from)
      VALUES('00000000-0000-4000-8000-000000000051','starter-monthly',1,'Starter monthly',
        'Connect your own Meta business, manage templates, and send WhatsApp messages.','ACTIVE',0,10,'2026-01-01T00:00:00Z')
      ON CONFLICT(code,version) DO NOTHING;

      INSERT INTO whatsapp_core.plan_prices
        (id,plan_id,country_code,currency,interval,amount_minor,provider,provider_price_id,status,effective_from)
      VALUES
        ('00000000-0000-4000-8000-000000000052','00000000-0000-4000-8000-000000000051','IN','INR','MONTH',99900,'STRIPE',NULL,'ACTIVE','2026-01-01T00:00:00Z'),
        ('00000000-0000-4000-8000-000000000053','00000000-0000-4000-8000-000000000051','US','USD','MONTH',1900,'STRIPE',NULL,'ACTIVE','2026-01-01T00:00:00Z')
      ON CONFLICT(plan_id,country_code,currency,interval,effective_from) DO NOTHING;

      INSERT INTO whatsapp_core.plan_features(id,plan_id,code,enabled,quota)
      VALUES
        ('00000000-0000-4000-8000-000000000054','00000000-0000-4000-8000-000000000051','meta_integration',true,NULL),
        ('00000000-0000-4000-8000-000000000055','00000000-0000-4000-8000-000000000051','monthly_api_requests',true,10000),
        ('00000000-0000-4000-8000-000000000056','00000000-0000-4000-8000-000000000051','monthly_message_operations',true,1000),
        ('00000000-0000-4000-8000-000000000057','00000000-0000-4000-8000-000000000051','monthly_campaigns',true,25),
        ('00000000-0000-4000-8000-000000000058','00000000-0000-4000-8000-000000000051','report_exports',true,10)
      ON CONFLICT(plan_id,code) DO UPDATE SET enabled=excluded.enabled,quota=excluded.quota;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      UPDATE whatsapp_core.plan_features SET quota=1000
      WHERE plan_id='00000000-0000-4000-8000-000000000041' AND code='monthly_message_operations';
      UPDATE whatsapp_core.subscription_plans
      SET description='Evaluate the complete WhatsApp workspace before choosing a paid plan.',updated_at=now()
      WHERE id='00000000-0000-4000-8000-000000000041';
      DELETE FROM whatsapp_core.plan_features
      WHERE plan_id='00000000-0000-4000-8000-000000000041' AND code='meta_integration';
      DELETE FROM whatsapp_core.plan_features
      WHERE plan_id='00000000-0000-4000-8000-000000000051'
        AND NOT EXISTS(SELECT 1 FROM whatsapp_core.subscriptions WHERE plan_id='00000000-0000-4000-8000-000000000051');
      DELETE FROM whatsapp_core.plan_prices
      WHERE plan_id='00000000-0000-4000-8000-000000000051'
        AND NOT EXISTS(SELECT 1 FROM whatsapp_core.subscriptions WHERE plan_id='00000000-0000-4000-8000-000000000051');
      DELETE FROM whatsapp_core.subscription_plans
      WHERE id='00000000-0000-4000-8000-000000000051'
        AND NOT EXISTS(SELECT 1 FROM whatsapp_core.subscriptions WHERE plan_id='00000000-0000-4000-8000-000000000051');
    `);
  }
}
