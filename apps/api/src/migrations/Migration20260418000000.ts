import { Migration } from '@mikro-orm/migrations';

export class Migration20260418000000 extends Migration {
    override async up(): Promise<void> {
        // ── diary_entry table ─────────────────────────────────────────────────────
        await this.execute(`
            CREATE TABLE "diary_entry" (
                "id" serial NOT NULL,
                "campaign_id" integer NOT NULL,
                "in_game_date" varchar NOT NULL,
                "content" varchar(1000) NOT NULL,
                "embedding" vector(1024) NULL,
                "search_vector" tsvector,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "diary_entry_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "diary_entry_campaign_id_fkey" FOREIGN KEY ("campaign_id")
                    REFERENCES "campaign"("id") ON DELETE CASCADE
            );
        `);

        // ── memory_subject_type enum + memory table ───────────────────────────────
        await this.execute(`
            CREATE TYPE "memory_subject_type" AS ENUM (
                'npc', 'character', 'location', 'faction', 'item', 'general'
            );
        `);

        await this.execute(`
            CREATE TABLE "memory" (
                "id" serial NOT NULL,
                "campaign_id" integer NOT NULL,
                "subject_type" "memory_subject_type" NOT NULL,
                "subject_id" uuid NULL,
                "content" varchar(1000) NOT NULL,
                "embedding" vector(1024) NULL,
                "search_vector" tsvector,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "memory_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "memory_campaign_id_fkey" FOREIGN KEY ("campaign_id")
                    REFERENCES "campaign"("id") ON DELETE CASCADE
            );
        `);

        // ── IVFFlat indices on embedding columns ──────────────────────────────────
        await this.execute(`
            CREATE INDEX "diary_entry_embedding_idx"
                ON "diary_entry" USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 4);
        `);

        await this.execute(`
            CREATE INDEX "memory_embedding_idx"
                ON "memory" USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 4);
        `);

        // ── tsvector triggers for full-text fallback ──────────────────────────────
        await this.execute(`
            CREATE FUNCTION update_diary_entry_search_vector()
            RETURNS trigger AS $$
            BEGIN
                NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        await this.execute(`
            CREATE TRIGGER diary_entry_search_vector_trigger
            BEFORE INSERT OR UPDATE ON "diary_entry"
            FOR EACH ROW EXECUTE FUNCTION update_diary_entry_search_vector();
        `);

        await this.execute(`
            CREATE FUNCTION update_memory_search_vector()
            RETURNS trigger AS $$
            BEGIN
                NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        await this.execute(`
            CREATE TRIGGER memory_search_vector_trigger
            BEFORE INSERT OR UPDATE ON "memory"
            FOR EACH ROW EXECUTE FUNCTION update_memory_search_vector();
        `);
    }

    override async down(): Promise<void> {
        await this.execute(`DROP TABLE IF EXISTS "diary_entry" CASCADE;`);
        await this.execute(`DROP TABLE IF EXISTS "memory" CASCADE;`);
        await this.execute(`DROP TYPE IF EXISTS "memory_subject_type";`);
        await this.execute(`DROP FUNCTION IF EXISTS update_diary_entry_search_vector();`);
        await this.execute(`DROP FUNCTION IF EXISTS update_memory_search_vector();`);
    }
}
