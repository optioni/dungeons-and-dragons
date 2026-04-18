import { Migration } from '@mikro-orm/migrations';

export class Migration20260417000000 extends Migration {
    override async up(): Promise<void> {
        // ── game_session: levelUpPending ─────────────────────────────────────────
        await this.execute(`
            ALTER TABLE "game_session"
                ADD COLUMN "level_up_pending" boolean NOT NULL DEFAULT false;
        `);

        // ── character: hitDiceRemaining ──────────────────────────────────────────
        await this.execute(`
            ALTER TABLE "character"
                ADD COLUMN "hit_dice_remaining" integer NOT NULL DEFAULT 1;
        `);

        // ── character_item: quantity ─────────────────────────────────────────────
        await this.execute(`
            ALTER TABLE "character_item"
                ADD COLUMN "quantity" integer NOT NULL DEFAULT 1;
        `);

        // ── npc_item: item_id FK (nullable) ──────────────────────────────────────
        await this.execute(`
            ALTER TABLE "npc_item"
                ADD COLUMN "item_id" integer NULL,
                ADD CONSTRAINT "npc_item_item_id_fkey" FOREIGN KEY ("item_id")
                    REFERENCES "item"("id") ON DELETE SET NULL;
        `);

        // ── combat_session ────────────────────────────────────────────────────────
        await this.execute(`
            CREATE TABLE "combat_session" (
                "id" serial NOT NULL,
                "session_id" integer NOT NULL,
                "combatants" jsonb NOT NULL,
                "current_turn_index" integer NOT NULL DEFAULT 0,
                "round_number" integer NOT NULL DEFAULT 1,
                CONSTRAINT "combat_session_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "combat_session_session_id_unique" UNIQUE ("session_id"),
                CONSTRAINT "combat_session_session_id_fkey" FOREIGN KEY ("session_id")
                    REFERENCES "game_session"("id") ON DELETE CASCADE
            );
        `);
    }

    override async down(): Promise<void> {
        await this.execute(`DROP TABLE IF EXISTS "combat_session" CASCADE;`);

        await this.execute(`
            ALTER TABLE "npc_item"
                DROP CONSTRAINT IF EXISTS "npc_item_item_id_fkey",
                DROP COLUMN IF EXISTS "item_id";
        `);

        await this.execute(`
            ALTER TABLE "character_item"
                DROP COLUMN IF EXISTS "quantity";
        `);

        await this.execute(`
            ALTER TABLE "character"
                DROP COLUMN IF EXISTS "hit_dice_remaining";
        `);

        await this.execute(`
            ALTER TABLE "game_session"
                DROP COLUMN IF EXISTS "level_up_pending";
        `);
    }
}
