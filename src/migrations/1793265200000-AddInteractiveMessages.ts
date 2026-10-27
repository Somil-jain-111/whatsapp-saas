import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInteractiveMessages1793265200000 implements MigrationInterface {
  name = "AddInteractiveMessages1793265200000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      ALTER TABLE whatsapp_core.messages DROP CONSTRAINT ck_message_type;
      ALTER TABLE whatsapp_core.messages ADD CONSTRAINT ck_message_type
        CHECK(message_type IN ('TEXT','TEMPLATE','INTERACTIVE','IMAGE','DOCUMENT','VIDEO','AUDIO','STICKER','LOCATION','CONTACTS','UNSUPPORTED'));
      ALTER TABLE whatsapp_core.chatbot_rules DROP CONSTRAINT ck_chatbot_response;
      ALTER TABLE whatsapp_core.chatbot_rules ADD CONSTRAINT ck_chatbot_response
        CHECK(response_type IN ('SESSION_MESSAGE','TEMPLATE','INTERACTIVE','AGENT_HANDOFF'));
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS(SELECT 1 FROM whatsapp_core.messages WHERE message_type='INTERACTIVE') THEN
          RAISE EXCEPTION 'Cannot remove interactive messaging while interactive messages exist';
        END IF;
      END $$;
      DO $$ BEGIN
        IF EXISTS(SELECT 1 FROM whatsapp_core.chatbot_rules WHERE response_type='INTERACTIVE') THEN
          RAISE EXCEPTION 'Cannot remove interactive messaging while interactive chatbot rules exist';
        END IF;
      END $$;
      ALTER TABLE whatsapp_core.messages DROP CONSTRAINT ck_message_type;
      ALTER TABLE whatsapp_core.messages ADD CONSTRAINT ck_message_type
        CHECK(message_type IN ('TEXT','TEMPLATE','IMAGE','DOCUMENT','VIDEO','AUDIO','STICKER','LOCATION','CONTACTS','UNSUPPORTED'));
      ALTER TABLE whatsapp_core.chatbot_rules DROP CONSTRAINT ck_chatbot_response;
      ALTER TABLE whatsapp_core.chatbot_rules ADD CONSTRAINT ck_chatbot_response
        CHECK(response_type IN ('SESSION_MESSAGE','TEMPLATE','AGENT_HANDOFF'));
    `);
  }
}
