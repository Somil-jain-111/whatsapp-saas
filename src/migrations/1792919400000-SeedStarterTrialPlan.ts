import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedStarterTrialPlan1792919400000 implements MigrationInterface {
  name = "SeedStarterTrialPlan1792919400000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      INSERT INTO whatsapp_core.iso_countries(code,name)
      VALUES ('US','United States'),('IN','India')
      ON CONFLICT(code) DO NOTHING;

      INSERT INTO whatsapp_core.iso_currencies(code,name,minor_units)
      VALUES ('USD','US Dollar',2),('INR','Indian Rupee',2)
      ON CONFLICT(code) DO NOTHING;

      INSERT INTO whatsapp_core.subscription_plans
        (id,code,version,name,description,status,trial_days,display_order,effective_from)
      VALUES
        ('00000000-0000-4000-8000-000000000041','starter-trial',1,'Starter trial',
         'Evaluate the complete WhatsApp workspace before choosing a paid plan.','ACTIVE',14,0,'2026-01-01T00:00:00Z')
      ON CONFLICT DO NOTHING;

      INSERT INTO whatsapp_core.plan_prices
        (id,plan_id,country_code,currency,interval,amount_minor,status,effective_from)
      SELECT '00000000-0000-4000-8000-000000000042',id,'US','USD','MONTH',0,'ACTIVE','2026-01-01T00:00:00Z'
      FROM whatsapp_core.subscription_plans WHERE id='00000000-0000-4000-8000-000000000041'
      ON CONFLICT DO NOTHING;

      INSERT INTO whatsapp_core.plan_prices
        (id,plan_id,country_code,currency,interval,amount_minor,status,effective_from)
      SELECT '00000000-0000-4000-8000-000000000043',id,'IN','INR','MONTH',0,'ACTIVE','2026-01-01T00:00:00Z'
      FROM whatsapp_core.subscription_plans WHERE id='00000000-0000-4000-8000-000000000041'
      ON CONFLICT DO NOTHING;

      INSERT INTO whatsapp_core.plan_features(id,plan_id,code,enabled,quota)
      SELECT feature_id,'00000000-0000-4000-8000-000000000041',code,true,quota
      FROM (VALUES
        ('00000000-0000-4000-8000-000000000044'::uuid,'monthly_api_requests',10000::bigint),
        ('00000000-0000-4000-8000-000000000045'::uuid,'monthly_message_operations',1000::bigint),
        ('00000000-0000-4000-8000-000000000046'::uuid,'monthly_campaigns',25::bigint),
        ('00000000-0000-4000-8000-000000000047'::uuid,'report_exports',10::bigint)
      ) AS feature(feature_id,code,quota)
      WHERE EXISTS (
        SELECT 1 FROM whatsapp_core.subscription_plans
        WHERE id='00000000-0000-4000-8000-000000000041'
      )
      ON CONFLICT(plan_id,code) DO NOTHING;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      DELETE FROM whatsapp_core.plan_features
      WHERE plan_id='00000000-0000-4000-8000-000000000041'
        AND NOT EXISTS (
          SELECT 1 FROM whatsapp_core.subscriptions
          WHERE plan_id='00000000-0000-4000-8000-000000000041'
        );
      DELETE FROM whatsapp_core.plan_prices
      WHERE plan_id='00000000-0000-4000-8000-000000000041'
        AND NOT EXISTS (
          SELECT 1 FROM whatsapp_core.subscriptions
          WHERE plan_id='00000000-0000-4000-8000-000000000041'
        );
      DELETE FROM whatsapp_core.subscription_plans
      WHERE id='00000000-0000-4000-8000-000000000041'
        AND NOT EXISTS (
          SELECT 1 FROM whatsapp_core.subscriptions
          WHERE plan_id='00000000-0000-4000-8000-000000000041'
        );
    `);
  }
}
