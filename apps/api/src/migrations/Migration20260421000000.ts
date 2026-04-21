import { Migration } from '@mikro-orm/migrations';

export class Migration20260421000000 extends Migration {
    override async up(): Promise<void> {
        await this.execute(`
            create table "npc_memory" (
                "id" serial primary key,
                "npc_id" integer not null,
                "content" varchar(1000) not null,
                "embedding" vector(1024) null,
                "in_game_date" text null,
                "source_npc_id" integer null,
                "created_at" timestamptz not null default now()
            );
        `);

        await this.execute(`
            create index "npc_memory_npc_id_index" on "npc_memory" ("npc_id");
        `);
    }

    override async down(): Promise<void> {
        await this.execute(`drop table if exists "npc_memory";`);
    }
}
