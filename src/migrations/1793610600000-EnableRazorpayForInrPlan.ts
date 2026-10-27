import { MigrationInterface, QueryRunner } from "typeorm";

export class EnableRazorpayForInrPlan1793610600000 implements MigrationInterface {
  name = "EnableRazorpayForInrPlan1793610600000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      UPDATE whatsapp_core.plan_prices
      SET provider='RAZORPAY', provider_price_id=NULL
      WHERE id='00000000-0000-4000-8000-000000000052'
        AND currency='INR'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      UPDATE whatsapp_core.plan_prices
      SET provider='STRIPE', provider_price_id=NULL
      WHERE id='00000000-0000-4000-8000-000000000052'
        AND currency='INR'
    `);
  }
}
