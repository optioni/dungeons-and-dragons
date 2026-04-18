import { Migration } from '@mikro-orm/migrations';

export class Migration20260415000000 extends Migration {
    override async up(): Promise<void> {
        // ── Extend existing campaign table with full setup-state fields ──────────
        await this.execute(`
            ALTER TABLE "campaign"
                ADD COLUMN "name" text NOT NULL DEFAULT 'My Campaign',
                ADD COLUMN "setup_status" text NOT NULL DEFAULT 'DRAFT',
                ADD COLUMN "tone" text NULL,
                ADD COLUMN "death_mode" text NULL,
                ADD COLUMN "generated_concepts" jsonb NULL,
                ADD COLUMN "selected_concept" jsonb NULL,
                ADD COLUMN "opening_scene_seed" jsonb NULL,
                ADD COLUMN "antagonist_npc_id" integer NULL,
                ADD COLUMN "antagonist_plan_state" jsonb NULL,
                ADD COLUMN "current_location_id" integer NULL,
                ADD COLUMN "in_game_date" text NULL,
                ADD COLUMN "lore_document" text NULL,
                ADD COLUMN "created_at" date NOT NULL DEFAULT NOW();
        `);

        // Drop the temporary default so new campaigns must supply a name
        await this.execute(`ALTER TABLE "campaign" ALTER COLUMN "name" DROP DEFAULT;`);

        // ── Location ─────────────────────────────────────────────────────────────
        await this.execute(`
            CREATE TABLE "location" (
                "id" serial NOT NULL,
                "campaign_id" integer NOT NULL,
                "name" text NOT NULL,
                "description" text NOT NULL,
                "current_state" text NULL,
                "coordinates" jsonb NULL,
                "connected_location_ids" jsonb NOT NULL DEFAULT '[]',
                "recent_events" jsonb NOT NULL DEFAULT '[]',
                CONSTRAINT "location_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "location_campaign_id_fkey" FOREIGN KEY ("campaign_id")
                    REFERENCES "campaign"("id") ON DELETE CASCADE
            );
        `);

        await this.execute(`
            CREATE INDEX "location_campaign_id_idx" ON "location" ("campaign_id");
        `);

        // ── Map ───────────────────────────────────────────────────────────────────
        await this.execute(`
            CREATE TABLE "map" (
                "id" serial NOT NULL,
                "campaign_id" integer NOT NULL,
                "name" text NOT NULL,
                "description" text NULL,
                "scale" text NULL,
                CONSTRAINT "map_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "map_campaign_id_fkey" FOREIGN KEY ("campaign_id")
                    REFERENCES "campaign"("id") ON DELETE CASCADE
            );
        `);

        // ── MapLocation ───────────────────────────────────────────────────────────
        await this.execute(`
            CREATE TABLE "map_location" (
                "id" serial NOT NULL,
                "map_id" integer NOT NULL,
                "location_id" integer NOT NULL,
                CONSTRAINT "map_location_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "map_location_map_id_fkey" FOREIGN KEY ("map_id")
                    REFERENCES "map"("id") ON DELETE CASCADE,
                CONSTRAINT "map_location_location_id_fkey" FOREIGN KEY ("location_id")
                    REFERENCES "location"("id") ON DELETE CASCADE
            );
        `);

        // ── LocationDiscovery ─────────────────────────────────────────────────────
        await this.execute(`
            CREATE TABLE "location_discovery" (
                "id" serial NOT NULL,
                "campaign_id" integer NOT NULL,
                "location_id" integer NOT NULL,
                "discovered_at" date NOT NULL DEFAULT NOW(),
                "source" text NOT NULL DEFAULT 'PLAYER_ACTION',
                "source_id" integer NULL,
                CONSTRAINT "location_discovery_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "location_discovery_campaign_id_fkey" FOREIGN KEY ("campaign_id")
                    REFERENCES "campaign"("id") ON DELETE CASCADE,
                CONSTRAINT "location_discovery_location_id_fkey" FOREIGN KEY ("location_id")
                    REFERENCES "location"("id") ON DELETE CASCADE
            );
        `);

        await this.execute(`
            CREATE UNIQUE INDEX "location_discovery_campaign_location_unique"
            ON "location_discovery" ("campaign_id", "location_id");
        `);

        // ── Faction ───────────────────────────────────────────────────────────────
        await this.execute(`
            CREATE TABLE "faction" (
                "id" serial NOT NULL,
                "campaign_id" integer NOT NULL,
                "name" text NOT NULL,
                "goals" text NULL,
                "power_level" integer NULL,
                "player_disposition" text NULL,
                "territory" text NULL,
                CONSTRAINT "faction_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "faction_campaign_id_fkey" FOREIGN KEY ("campaign_id")
                    REFERENCES "campaign"("id") ON DELETE CASCADE
            );
        `);

        await this.execute(`
            CREATE INDEX "faction_campaign_id_idx" ON "faction" ("campaign_id");
        `);

        // ── WorldEvent ────────────────────────────────────────────────────────────
        await this.execute(`
            CREATE TABLE "world_event" (
                "id" serial NOT NULL,
                "campaign_id" integer NOT NULL,
                "description" text NOT NULL,
                "location_id" integer NULL,
                "deadline_in_game_date" text NULL,
                "source" text NOT NULL DEFAULT 'WORLD_TICK',
                "status" text NOT NULL DEFAULT 'ACTIVE',
                "outcome" text NULL,
                "created_at" date NOT NULL DEFAULT NOW(),
                CONSTRAINT "world_event_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "world_event_campaign_id_fkey" FOREIGN KEY ("campaign_id")
                    REFERENCES "campaign"("id") ON DELETE CASCADE,
                CONSTRAINT "world_event_location_id_fkey" FOREIGN KEY ("location_id")
                    REFERENCES "location"("id") ON DELETE SET NULL
            );
        `);

        await this.execute(`
            CREATE INDEX "world_event_campaign_id_idx" ON "world_event" ("campaign_id");
        `);

        // ── Npc ───────────────────────────────────────────────────────────────────
        await this.execute(`
            CREATE TABLE "npc" (
                "id" serial NOT NULL,
                "campaign_id" integer NOT NULL,
                "name" text NOT NULL,
                "description" text NULL,
                "profession" text NULL,
                "core_motivation" text NULL,
                "personality_traits" jsonb NOT NULL DEFAULT '[]',
                "speech_style" text NULL,
                "disposition" text NULL,
                "current_location_id" integer NULL,
                "alive" boolean NOT NULL DEFAULT true,
                "hp" integer NULL,
                "max_hp" integer NULL,
                "party_status" text NOT NULL DEFAULT 'NONE',
                "agenda" text NULL,
                "next_tick_in_game_date" text NULL,
                CONSTRAINT "npc_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "npc_campaign_id_fkey" FOREIGN KEY ("campaign_id")
                    REFERENCES "campaign"("id") ON DELETE CASCADE,
                CONSTRAINT "npc_current_location_id_fkey" FOREIGN KEY ("current_location_id")
                    REFERENCES "location"("id") ON DELETE SET NULL
            );
        `);

        await this.execute(`
            CREATE INDEX "npc_campaign_id_idx" ON "npc" ("campaign_id");
        `);

        // ── NpcRelationship ───────────────────────────────────────────────────────
        await this.execute(`
            CREATE TABLE "npc_relationship" (
                "id" serial NOT NULL,
                "source_npc_id" integer NOT NULL,
                "target_npc_id" integer NOT NULL,
                "type" text NOT NULL,
                "description" text NULL,
                "disposition" text NULL,
                CONSTRAINT "npc_relationship_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "npc_relationship_source_npc_id_fkey" FOREIGN KEY ("source_npc_id")
                    REFERENCES "npc"("id") ON DELETE CASCADE,
                CONSTRAINT "npc_relationship_target_npc_id_fkey" FOREIGN KEY ("target_npc_id")
                    REFERENCES "npc"("id") ON DELETE CASCADE
            );
        `);

        // ── NpcItem ───────────────────────────────────────────────────────────────
        await this.execute(`
            CREATE TABLE "npc_item" (
                "id" serial NOT NULL,
                "npc_id" integer NOT NULL,
                "name" text NOT NULL,
                "quantity" integer NOT NULL DEFAULT 1,
                "merchant_price" integer NULL,
                CONSTRAINT "npc_item_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "npc_item_npc_id_fkey" FOREIGN KEY ("npc_id")
                    REFERENCES "npc"("id") ON DELETE CASCADE
            );
        `);

        // ── Back-reference FK constraints on campaign ─────────────────────────────
        // Added after npc and location tables exist
        await this.execute(`
            ALTER TABLE "campaign"
                ADD CONSTRAINT "campaign_antagonist_npc_id_fkey"
                    FOREIGN KEY ("antagonist_npc_id") REFERENCES "npc"("id") ON DELETE SET NULL,
                ADD CONSTRAINT "campaign_current_location_id_fkey"
                    FOREIGN KEY ("current_location_id") REFERENCES "location"("id") ON DELETE SET NULL;
        `);
    }

    override async down(): Promise<void> {
        await this.execute(`
            ALTER TABLE "campaign"
                DROP CONSTRAINT IF EXISTS "campaign_antagonist_npc_id_fkey",
                DROP CONSTRAINT IF EXISTS "campaign_current_location_id_fkey";
        `);

        await this.execute('DROP TABLE IF EXISTS "npc_item";');
        await this.execute('DROP TABLE IF EXISTS "npc_relationship";');
        await this.execute('DROP TABLE IF EXISTS "npc";');
        await this.execute('DROP TABLE IF EXISTS "world_event";');
        await this.execute('DROP TABLE IF EXISTS "faction";');
        await this.execute('DROP TABLE IF EXISTS "location_discovery";');
        await this.execute('DROP TABLE IF EXISTS "map_location";');
        await this.execute('DROP TABLE IF EXISTS "map";');
        await this.execute('DROP TABLE IF EXISTS "location";');

        await this.execute(`
            ALTER TABLE "campaign"
                DROP COLUMN IF EXISTS "name",
                DROP COLUMN IF EXISTS "setup_status",
                DROP COLUMN IF EXISTS "tone",
                DROP COLUMN IF EXISTS "death_mode",
                DROP COLUMN IF EXISTS "generated_concepts",
                DROP COLUMN IF EXISTS "selected_concept",
                DROP COLUMN IF EXISTS "opening_scene_seed",
                DROP COLUMN IF EXISTS "antagonist_npc_id",
                DROP COLUMN IF EXISTS "antagonist_plan_state",
                DROP COLUMN IF EXISTS "current_location_id",
                DROP COLUMN IF EXISTS "in_game_date",
                DROP COLUMN IF EXISTS "lore_document",
                DROP COLUMN IF EXISTS "created_at";
        `);
    }
}
