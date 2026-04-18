import { Migration } from '@mikro-orm/migrations';

export class Migration20260416000000 extends Migration {
    override async up(): Promise<void> {
        await this.execute(`
            CREATE TABLE "game_session" (
                "id" serial NOT NULL,
                "campaign_id" integer NOT NULL,
                "scene_type" text NOT NULL DEFAULT 'EXPLORATION',
                "started_at" timestamptz NOT NULL DEFAULT NOW(),
                "ended_at" timestamptz NULL,
                CONSTRAINT "game_session_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "game_session_campaign_id_foreign" FOREIGN KEY ("campaign_id")
                    REFERENCES "campaign"("id") ON DELETE CASCADE
            );
        `);

        await this.execute(`
            CREATE TABLE "game_event" (
                "id" serial NOT NULL,
                "session_id" integer NOT NULL,
                "event_type" text NOT NULL,
                "content" jsonb NOT NULL,
                "created_at" timestamptz NOT NULL DEFAULT NOW(),
                CONSTRAINT "game_event_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "game_event_session_id_foreign" FOREIGN KEY ("session_id")
                    REFERENCES "game_session"("id") ON DELETE CASCADE
            );
        `);
    }

    override async down(): Promise<void> {
        await this.execute(`DROP TABLE IF EXISTS "game_event" CASCADE;`);
        await this.execute(`DROP TABLE IF EXISTS "game_session" CASCADE;`);
    }
}
