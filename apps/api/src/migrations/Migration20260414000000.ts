import { Migration } from '@mikro-orm/migrations';

export class Migration20260414000000 extends Migration {
    override async up(): Promise<void> {
        // Campaign stub table — minimal schema until CampaignModule is implemented
        await this.execute(`
            CREATE TABLE "campaign" (
                "id" serial NOT NULL,
                "user_id" integer NOT NULL,
                CONSTRAINT "campaign_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "campaign_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
            );
        `);

        await this.execute(`
            CREATE TABLE "character" (
                "id" serial NOT NULL,
                "name" text NOT NULL,
                "level" integer NOT NULL DEFAULT 1,
                "ability_scores" jsonb NOT NULL,
                "hp" integer NOT NULL,
                "max_hp" integer NOT NULL,
                "ac" integer NOT NULL,
                "conditions" jsonb NOT NULL DEFAULT '[]',
                "spell_slots" jsonb NOT NULL DEFAULT '[]',
                "prepared_spells" jsonb NOT NULL DEFAULT '[]',
                "skill_proficiencies" jsonb NOT NULL,
                "gold_pieces" integer NOT NULL DEFAULT 0,
                "silver_pieces" integer NOT NULL DEFAULT 0,
                "copper_pieces" integer NOT NULL DEFAULT 0,
                "xp" integer NOT NULL DEFAULT 0,
                "death_save_successes" integer NOT NULL DEFAULT 0,
                "death_save_failures" integer NOT NULL DEFAULT 0,
                "is_dead" boolean NOT NULL DEFAULT false,
                "race_id" integer NOT NULL,
                "srd_class_id" integer NOT NULL,
                "campaign_id" integer NOT NULL,
                CONSTRAINT "character_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "character_race_id_fkey" FOREIGN KEY ("race_id") REFERENCES "srd_race"("id"),
                CONSTRAINT "character_srd_class_id_fkey" FOREIGN KEY ("srd_class_id") REFERENCES "srd_class"("id"),
                CONSTRAINT "character_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaign"("id") ON DELETE CASCADE
            );
        `);

        await this.execute(`
            CREATE TABLE "item" (
                "id" serial NOT NULL,
                "name" text NOT NULL,
                "description" text NOT NULL,
                "weight" float NULL,
                "value" integer NULL,
                "item_type" text NOT NULL,
                "srd_equipment_id" integer NULL,
                CONSTRAINT "item_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "item_srd_equipment_id_fkey" FOREIGN KEY ("srd_equipment_id") REFERENCES "srd_equipment"("id")
            );
        `);

        await this.execute(`
            CREATE TABLE "character_item" (
                "id" serial NOT NULL,
                "character_id" integer NOT NULL,
                "item_id" integer NOT NULL,
                "slot" text NULL,
                "condition" text NULL,
                CONSTRAINT "character_item_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "character_item_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "character"("id") ON DELETE CASCADE,
                CONSTRAINT "character_item_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id")
            );
        `);

        // Task 1.5: Unique partial index — prevents two items equipped to the same slot
        await this.execute(`
            CREATE UNIQUE INDEX "character_item_character_id_slot_unique"
            ON "character_item" ("character_id", "slot")
            WHERE "slot" IS NOT NULL;
        `);
    }

    override async down(): Promise<void> {
        await this.execute('DROP INDEX IF EXISTS "character_item_character_id_slot_unique";');
        await this.execute('DROP TABLE IF EXISTS "character_item";');
        await this.execute('DROP TABLE IF EXISTS "item";');
        await this.execute('DROP TABLE IF EXISTS "character";');
        await this.execute('DROP TABLE IF EXISTS "campaign";');
    }
}
