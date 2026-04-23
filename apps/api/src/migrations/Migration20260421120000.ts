import { Migration } from '@mikro-orm/migrations';

export class Migration20260421120000 extends Migration {
    override async up(): Promise<void> {
        await this.execute(`
            alter type "quest_entity_type"
            add value if not exists 'DUNGEON';
        `);

        await this.execute(`
            create table "dungeon" (
                "id" serial primary key,
                "campaign_id" integer not null,
                "name" text not null,
                "description" text not null,
                "total_floors" integer not null default 1,
                "encounter_table" jsonb null
            );
        `);

        await this.execute(`
            alter table "dungeon"
            add constraint "dungeon_campaign_id_foreign"
            foreign key ("campaign_id") references "campaign" ("id")
            on update cascade;
        `);

        await this.execute(`
            alter table "location"
            add column "dungeon_id" integer null,
            add column "floor" integer null,
            add column "room_state" text null default 'UNEXPLORED';
        `);

        await this.execute(`
            alter table "location"
            add constraint "location_dungeon_id_foreign"
            foreign key ("dungeon_id") references "dungeon" ("id")
            on update cascade on delete set null;
        `);

        await this.execute(`
            create table "room_encounter" (
                "id" serial primary key,
                "room_id" integer not null,
                "description" text not null,
                "cleared" boolean not null default false,
                "monsters" jsonb not null
            );
        `);

        await this.execute(`
            alter table "room_encounter"
            add constraint "room_encounter_room_id_foreign"
            foreign key ("room_id") references "location" ("id")
            on update cascade;
        `);

        await this.execute(`
            create table "room_item" (
                "id" serial primary key,
                "room_id" integer not null,
                "item_id" integer not null,
                "quantity" integer not null default 1,
                "container_name" text null
            );
        `);

        await this.execute(`
            alter table "room_item"
            add constraint "room_item_room_id_foreign"
            foreign key ("room_id") references "location" ("id")
            on update cascade;
        `);

        await this.execute(`
            alter table "room_item"
            add constraint "room_item_item_id_foreign"
            foreign key ("item_id") references "item" ("id")
            on update cascade;
        `);

        await this.execute(`
            alter table "game_session"
            add column "active_dungeon_id" integer null;
        `);

        await this.execute(`
            alter table "game_session"
            add constraint "game_session_active_dungeon_id_foreign"
            foreign key ("active_dungeon_id") references "dungeon" ("id")
            on update cascade on delete set null;
        `);
    }

    override async down(): Promise<void> {
        await this.execute('alter table "game_session" drop constraint if exists "game_session_active_dungeon_id_foreign";');
        await this.execute('alter table "game_session" drop column if exists "active_dungeon_id";');
        await this.execute('drop table if exists "room_item";');
        await this.execute('drop table if exists "room_encounter";');
        await this.execute('alter table "location" drop constraint if exists "location_dungeon_id_foreign";');
        await this.execute('alter table "location" drop column if exists "dungeon_id", drop column if exists "floor", drop column if exists "room_state";');
        await this.execute('drop table if exists "dungeon";');
        await this.execute(`
            create type "quest_entity_type_old" as enum ('NPC', 'LOCATION', 'ITEM', 'WORLD_EVENT');
        `);
        await this.execute(`
            alter table "quest_entity"
            alter column "entity_type" type "quest_entity_type_old"
            using ("entity_type"::text::"quest_entity_type_old");
        `);
        await this.execute('drop type "quest_entity_type";');
        await this.execute('alter type "quest_entity_type_old" rename to "quest_entity_type";');
    }
}
