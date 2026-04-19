import { Migration } from '@mikro-orm/migrations';

export class Migration20260419110000 extends Migration {
    override async up(): Promise<void> {
        await this.execute(`
            CREATE TYPE quest_status AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED');
            CREATE TYPE quest_objective_type AS ENUM ('REACH_LOCATION', 'NPC_DEAD', 'NPC_ALIVE', 'HAVE_ITEM', 'TALK_TO_NPC', 'MANUAL');
            CREATE TYPE quest_objective_status AS ENUM ('INCOMPLETE', 'COMPLETE');
            CREATE TYPE quest_entity_type AS ENUM ('NPC', 'LOCATION', 'ITEM', 'WORLD_EVENT');

            CREATE TABLE "quest" (
                "id" serial PRIMARY KEY,
                "campaign_id" integer NOT NULL,
                "title" text NOT NULL,
                "description" text NOT NULL,
                "status" quest_status NOT NULL DEFAULT 'ACTIVE',
                "agenda_impact" text NULL,
                "reward_narrative" text NULL,
                "reward_xp" integer NULL,
                "reward_gold" integer NULL,
                "created_at" timestamptz NOT NULL DEFAULT now()
            );

            CREATE TABLE "quest_objective" (
                "id" serial PRIMARY KEY,
                "quest_id" integer NOT NULL REFERENCES "quest"("id") ON DELETE CASCADE,
                "description" text NOT NULL,
                "type" quest_objective_type NOT NULL,
                "status" quest_objective_status NOT NULL DEFAULT 'INCOMPLETE',
                "entity_id" integer NULL,
                "order" integer NOT NULL DEFAULT 0
            );

            CREATE TABLE "quest_entity" (
                "id" serial PRIMARY KEY,
                "quest_id" integer NOT NULL REFERENCES "quest"("id") ON DELETE CASCADE,
                "entity_type" quest_entity_type NOT NULL,
                "entity_id" integer NOT NULL
            );

            CREATE INDEX ON "quest" ("campaign_id", "status");
            CREATE INDEX ON "quest_objective" ("quest_id", "status");
            CREATE INDEX ON "quest_entity" ("quest_id");
            CREATE INDEX ON "quest_entity" ("entity_type", "entity_id");
        `);
    }

    override async down(): Promise<void> {
        await this.execute(`
            DROP TABLE IF EXISTS "quest_entity";
            DROP TABLE IF EXISTS "quest_objective";
            DROP TABLE IF EXISTS "quest";
            DROP TYPE IF EXISTS quest_entity_type;
            DROP TYPE IF EXISTS quest_objective_status;
            DROP TYPE IF EXISTS quest_objective_type;
            DROP TYPE IF EXISTS quest_status;
        `);
    }
}
