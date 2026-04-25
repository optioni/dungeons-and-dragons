import { Migration } from '@mikro-orm/migrations';

export class Migration20260425063522 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "character_item" drop constraint "character_item_item_id_fkey";`);
    this.addSql(`alter table "npc_item" drop constraint "npc_item_item_id_fkey";`);
    this.addSql(`alter table "room_item" drop constraint "room_item_item_id_foreign";`);

    this.addSql(`create table "location_item" ("id" serial primary key, "location_id" int not null, "item_id" int not null, "item_name" text not null, "quantity" int not null default 1, "note" text null);`);
    this.addSql(`create unique index "location_item_location_id_item_id_unique" on "location_item" ("location_id", "item_id");`);
    this.addSql(`alter table "location_item" add constraint "location_item_location_id_foreign" foreign key ("location_id") references "location" ("id") on delete cascade;`);

    this.addSql(`drop table if exists "item" cascade;`);
    this.addSql(`drop table if exists "quest_objective" cascade;`);
    this.addSql(`drop table if exists "room_encounter" cascade;`);
    this.addSql(`drop table if exists "srd_class" cascade;`);
    this.addSql(`drop table if exists "srd_condition" cascade;`);
    this.addSql(`drop table if exists "srd_monster" cascade;`);
    this.addSql(`drop table if exists "srd_spell" cascade;`);

    this.addSql(`alter table "campaign" drop constraint "campaign_antagonist_npc_id_fkey";`);
    this.addSql(`alter table "campaign" drop constraint "campaign_current_location_id_fkey";`);
    this.addSql(`alter table "campaign" drop constraint "campaign_user_id_fkey";`);

    this.addSql(`alter table "dungeon" drop constraint "dungeon_campaign_id_foreign";`);

    this.addSql(`alter table "faction" drop constraint "faction_campaign_id_fkey";`);

    this.addSql(`alter table "game_session" drop constraint "game_session_active_dungeon_id_foreign";`);
    this.addSql(`alter table "game_session" drop constraint "game_session_campaign_id_foreign";`);

    this.addSql(`alter table "game_event" drop constraint "game_event_session_id_foreign";`);

    this.addSql(`alter table "combat_session" drop constraint "combat_session_session_id_fkey";`);

    this.addSql(`alter table "location_discovery" drop constraint "location_discovery_campaign_id_fkey";`);
    this.addSql(`alter table "location_discovery" drop constraint "location_discovery_location_id_fkey";`);

    this.addSql(`alter table "map" drop constraint "map_campaign_id_fkey";`);

    this.addSql(`alter table "map_location" drop constraint "map_location_location_id_fkey";`);
    this.addSql(`alter table "map_location" drop constraint "map_location_map_id_fkey";`);

    this.addSql(`alter table "npc" drop constraint "npc_campaign_id_fkey";`);
    this.addSql(`alter table "npc" drop constraint "npc_current_location_id_fkey";`);

    this.addSql(`alter table "npc_relationship" drop constraint "npc_relationship_source_npc_id_fkey";`);
    this.addSql(`alter table "npc_relationship" drop constraint "npc_relationship_target_npc_id_fkey";`);

    this.addSql(`alter table "location" drop constraint "location_campaign_id_fkey";`);
    this.addSql(`alter table "location" drop constraint "location_dungeon_id_foreign";`);

    this.addSql(`alter table "quest_entity" drop constraint "quest_entity_quest_id_fkey";`);

    this.addSql(`alter table "diary_entry" drop constraint "diary_entry_campaign_id_fkey";`);

    this.addSql(`alter table "memory" drop constraint "memory_campaign_id_fkey";`);

    this.addSql(`alter table "npc_item" drop constraint "npc_item_npc_id_fkey";`);

    this.addSql(`alter table "character" drop constraint "character_campaign_id_fkey";`);

    this.addSql(`alter table "room_item" drop constraint "room_item_room_id_foreign";`);

    this.addSql(`alter table "character_item" drop constraint "character_item_character_id_fkey";`);

    this.addSql(`alter table "world_event" drop constraint "world_event_campaign_id_fkey";`);
    this.addSql(`alter table "world_event" drop constraint "world_event_location_id_fkey";`);

    this.addSql(`alter table "campaign" alter column "created_at" drop default;`);

    this.addSql(`alter table "dungeon" add constraint "dungeon_campaign_id_foreign" foreign key ("campaign_id") references "campaign" ("id");`);

    this.addSql(`drop index "faction_campaign_id_idx";`);

    this.addSql(`alter table "game_session" alter column "started_at" drop default;`);
    this.addSql(`alter table "game_session" add constraint "game_session_active_dungeon_id_foreign" foreign key ("active_dungeon_id") references "dungeon" ("id") on delete set null;`);
    this.addSql(`alter table "game_session" add constraint "game_session_campaign_id_foreign" foreign key ("campaign_id") references "campaign" ("id");`);

    this.addSql(`alter table "game_event" alter column "created_at" drop default;`);
    this.addSql(`alter table "game_event" add constraint "game_event_session_id_foreign" foreign key ("session_id") references "game_session" ("id");`);

    this.addSql(`alter table "combat_session" add constraint "combat_session_session_id_foreign" foreign key ("session_id") references "game_session" ("id");`);

    this.addSql(`drop index "location_discovery_campaign_location_unique";`);
    this.addSql(`alter table "location_discovery" alter column "discovered_at" drop default;`);

    this.addSql(`drop index "npc_campaign_id_idx";`);

    this.addSql(`alter table "npc_memory" alter column "created_at" drop default;`);

    this.addSql(`drop index "quest_campaign_id_status_idx";`);
    this.addSql(`alter table "quest" alter column "status" type text using ("status"::text);`);

    this.addSql(`drop index "location_campaign_id_idx";`);
    this.addSql(`alter table "location" add "parent_location_id" int null;`);
    this.addSql(`alter table "location" alter column "room_state" drop default;`);
    this.addSql(`alter table "location" add constraint "location_dungeon_id_foreign" foreign key ("dungeon_id") references "dungeon" ("id") on delete set null;`);

    this.addSql(`drop index "quest_entity_entity_type_entity_id_idx";`);
    this.addSql(`drop index "quest_entity_quest_id_idx";`);
    this.addSql(`alter table "quest_entity" alter column "entity_type" type text using ("entity_type"::text);`);
    this.addSql(`alter table "quest_entity" add constraint "quest_entity_quest_id_foreign" foreign key ("quest_id") references "quest" ("id");`);

    this.addSql(`drop index "diary_entry_embedding_idx";`);
    this.addSql(`alter table "diary_entry" drop column "search_vector";`);
    this.addSql(`alter table "diary_entry" alter column "in_game_date" type text using ("in_game_date"::text);`);
    this.addSql(`alter table "diary_entry" alter column "created_at" drop default;`);
    this.addSql(`alter table "diary_entry" add constraint "diary_entry_campaign_id_foreign" foreign key ("campaign_id") references "campaign" ("id") on delete cascade;`);

    this.addSql(`drop index "memory_embedding_idx";`);
    this.addSql(`alter table "memory" drop column "search_vector";`);
    this.addSql(`alter table "memory" alter column "subject_type" type text using ("subject_type"::text);`);
    this.addSql(`alter table "memory" alter column "created_at" drop default;`);
    this.addSql(`alter table "memory" add constraint "memory_campaign_id_foreign" foreign key ("campaign_id") references "campaign" ("id") on delete cascade;`);

    this.addSql(`alter table "srd_equipment" alter column "weight" type real using ("weight"::real);`);

    this.addSql(`alter table "character" add constraint "character_race_id_foreign" foreign key ("race_id") references "srd_race" ("id");`);
    this.addSql(`alter table "character" add constraint "character_srd_class_id_foreign" foreign key ("srd_class_id") references "srd_class" ("id");`);
    this.addSql(`alter table "character" add constraint "character_campaign_id_foreign" foreign key ("campaign_id") references "campaign" ("id");`);

    this.addSql(`alter table "room_item" add constraint "room_item_item_id_foreign" foreign key ("item_id") references "item" ("id");`);
    this.addSql(`alter table "room_item" add constraint "room_item_room_id_foreign" foreign key ("room_id") references "location" ("id");`);

    this.addSql(`drop index "character_item_character_id_slot_unique";`);
    this.addSql(`alter table "character_item" add constraint "character_item_character_id_foreign" foreign key ("character_id") references "character" ("id");`);
    this.addSql(`alter table "character_item" add constraint "character_item_item_id_foreign" foreign key ("item_id") references "item" ("id");`);

    this.addSql(`drop index "world_event_campaign_id_idx";`);
    this.addSql(`alter table "world_event" alter column "created_at" drop default;`);

    this.addSql(`drop type "memory_subject_type";`);
    this.addSql(`drop type "quest_entity_type";`);
    this.addSql(`drop type "quest_objective_status";`);
    this.addSql(`drop type "quest_objective_type";`);
    this.addSql(`drop type "quest_status";`);
  }

  override down(): void | Promise<void> {
    this.addSql(`create type "memory_subject_type" as enum ('npc', 'character', 'location', 'faction', 'item', 'general');`);
    this.addSql(`create type "quest_entity_type" as enum ('NPC', 'LOCATION', 'ITEM', 'WORLD_EVENT', 'DUNGEON');`);
    this.addSql(`create type "quest_objective_status" as enum ('INCOMPLETE', 'COMPLETE');`);
    this.addSql(`create type "quest_objective_type" as enum ('REACH_LOCATION', 'NPC_DEAD', 'NPC_ALIVE', 'HAVE_ITEM', 'TALK_TO_NPC', 'MANUAL');`);
    this.addSql(`create type "quest_status" as enum ('ACTIVE', 'COMPLETED', 'FAILED');`);
    this.addSql(`create table "item" ("id" varchar(255) primary key, "name" text not null, "description" text not null, "weight" float8 null, "value" int4 null, "item_type" text not null, "srd_equipment_id" int4 null);`);

    this.addSql(`create table "quest_objective" ("id" varchar(255) primary key, "quest_id" int4 not null, "description" text not null, "type" "quest_objective_type" not null, "status" "quest_objective_status" not null default 'INCOMPLETE', "entity_id" int4 null, "order" int4 not null default 0);`);
    this.addSql(`create index "quest_objective_quest_id_status_idx" on "quest_objective" ("quest_id", "status");`);

    this.addSql(`create table "room_encounter" ("id" varchar(255) primary key, "room_id" int4 not null, "description" text not null, "cleared" bool not null default false, "monsters" jsonb not null);`);

    this.addSql(`create table "srd_class" ("id" varchar(255) primary key, "index" text not null, "name" text not null, "hit_die" int4 not null, "proficiencies" jsonb not null, "saving_throws" jsonb not null, "spellcasting_ability" text null);`);
    this.addSql(`alter table "srd_class" add constraint "srd_class_index_unique" unique ("index");`);

    this.addSql(`create table "srd_condition" ("id" varchar(255) primary key, "index" text not null, "name" text not null, "description" text not null);`);
    this.addSql(`alter table "srd_condition" add constraint "srd_condition_index_unique" unique ("index");`);

    this.addSql(`create table "srd_monster" ("id" varchar(255) primary key, "index" text not null, "name" text not null, "size" text not null, "type" text not null, "alignment" text not null, "armor_class" int4 not null, "hit_points" int4 not null, "challenge_rating" float4 not null, "speed" jsonb not null, "ability_scores" jsonb not null, "actions" jsonb not null);`);
    this.addSql(`alter table "srd_monster" add constraint "srd_monster_index_unique" unique ("index");`);

    this.addSql(`create table "srd_spell" ("id" varchar(255) primary key, "index" text not null, "name" text not null, "level" int4 not null, "school" text not null, "casting_time" text not null, "range" text not null, "components" jsonb not null, "duration" text not null, "description" text not null, "higher_level" text null, "classes" jsonb not null);`);
    this.addSql(`alter table "srd_spell" add constraint "srd_spell_index_unique" unique ("index");`);

    this.addSql(`alter table "quest_objective" add constraint "quest_objective_quest_id_fkey" foreign key ("quest_id") references "quest" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "room_encounter" add constraint "room_encounter_room_id_foreign" foreign key ("room_id") references "location" ("id") on update cascade on delete no action;`);

    this.addSql(`drop table if exists "location_item" cascade;`);

    this.addSql(`alter table "character" drop constraint "character_race_id_foreign";`);
    this.addSql(`alter table "character" drop constraint "character_srd_class_id_foreign";`);
    this.addSql(`alter table "character" drop constraint "character_campaign_id_foreign";`);

    this.addSql(`alter table "character_item" drop constraint "character_item_character_id_foreign";`);
    this.addSql(`alter table "character_item" drop constraint "character_item_item_id_foreign";`);

    this.addSql(`alter table "combat_session" drop constraint "combat_session_session_id_foreign";`);

    this.addSql(`alter table "diary_entry" drop constraint "diary_entry_campaign_id_foreign";`);

    this.addSql(`alter table "dungeon" drop constraint "dungeon_campaign_id_foreign";`);

    this.addSql(`alter table "game_event" drop constraint "game_event_session_id_foreign";`);

    this.addSql(`alter table "game_session" drop constraint "game_session_campaign_id_foreign";`);
    this.addSql(`alter table "game_session" drop constraint "game_session_active_dungeon_id_foreign";`);

    this.addSql(`alter table "location" drop constraint "location_dungeon_id_foreign";`);

    this.addSql(`alter table "memory" drop constraint "memory_campaign_id_foreign";`);

    this.addSql(`alter table "quest_entity" drop constraint "quest_entity_quest_id_foreign";`);

    this.addSql(`alter table "room_item" drop constraint "room_item_room_id_foreign";`);
    this.addSql(`alter table "room_item" drop constraint "room_item_item_id_foreign";`);

    this.addSql(`alter table "campaign" alter column "created_at" set default now();`);
    this.addSql(`alter table "campaign" add constraint "campaign_antagonist_npc_id_fkey" foreign key ("antagonist_npc_id") references "npc" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "campaign" add constraint "campaign_current_location_id_fkey" foreign key ("current_location_id") references "location" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "campaign" add constraint "campaign_user_id_fkey" foreign key ("user_id") references "user" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "character" add constraint "character_campaign_id_fkey" foreign key ("campaign_id") references "campaign" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "character_item" add constraint "character_item_character_id_fkey" foreign key ("character_id") references "character" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "character_item" add constraint "character_item_item_id_fkey" foreign key ("item_id") references "item" ("id") on update no action on delete no action;`);
    this.addSql(`CREATE UNIQUE INDEX character_item_character_id_slot_unique ON public.character_item USING btree (character_id, slot) WHERE (slot IS NOT NULL);`);

    this.addSql(`alter table "combat_session" add constraint "combat_session_session_id_fkey" foreign key ("session_id") references "game_session" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "diary_entry" add "search_vector" tsvector null;`);
    this.addSql(`alter table "diary_entry" alter column "in_game_date" type varchar using ("in_game_date"::varchar);`);
    this.addSql(`alter table "diary_entry" alter column "created_at" set default now();`);
    this.addSql(`alter table "diary_entry" add constraint "diary_entry_campaign_id_fkey" foreign key ("campaign_id") references "campaign" ("id") on update no action on delete cascade;`);
    this.addSql(`create index "diary_entry_embedding_idx" on "diary_entry" ("embedding");`);

    this.addSql(`alter table "dungeon" add constraint "dungeon_campaign_id_foreign" foreign key ("campaign_id") references "campaign" ("id") on update cascade on delete no action;`);

    this.addSql(`alter table "faction" add constraint "faction_campaign_id_fkey" foreign key ("campaign_id") references "campaign" ("id") on update no action on delete cascade;`);
    this.addSql(`create index "faction_campaign_id_idx" on "faction" ("campaign_id");`);

    this.addSql(`alter table "game_event" alter column "created_at" set default now();`);
    this.addSql(`alter table "game_event" add constraint "game_event_session_id_foreign" foreign key ("session_id") references "game_session" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "game_session" alter column "started_at" set default now();`);
    this.addSql(`alter table "game_session" add constraint "game_session_campaign_id_foreign" foreign key ("campaign_id") references "campaign" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "game_session" add constraint "game_session_active_dungeon_id_foreign" foreign key ("active_dungeon_id") references "dungeon" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "location" drop column "parent_location_id";`);
    this.addSql(`alter table "location" alter column "room_state" set default 'UNEXPLORED';`);
    this.addSql(`alter table "location" add constraint "location_campaign_id_fkey" foreign key ("campaign_id") references "campaign" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "location" add constraint "location_dungeon_id_foreign" foreign key ("dungeon_id") references "dungeon" ("id") on update cascade on delete set null;`);
    this.addSql(`create index "location_campaign_id_idx" on "location" ("campaign_id");`);

    this.addSql(`alter table "location_discovery" alter column "discovered_at" set default now();`);
    this.addSql(`alter table "location_discovery" add constraint "location_discovery_campaign_id_fkey" foreign key ("campaign_id") references "campaign" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "location_discovery" add constraint "location_discovery_location_id_fkey" foreign key ("location_id") references "location" ("id") on update no action on delete cascade;`);
    this.addSql(`create unique index "location_discovery_campaign_location_unique" on "location_discovery" ("campaign_id", "location_id");`);

    this.addSql(`alter table "map" add constraint "map_campaign_id_fkey" foreign key ("campaign_id") references "campaign" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "map_location" add constraint "map_location_location_id_fkey" foreign key ("location_id") references "location" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "map_location" add constraint "map_location_map_id_fkey" foreign key ("map_id") references "map" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "memory" add "search_vector" tsvector null;`);
    this.addSql(`alter table "memory" alter column "subject_type" type "memory_subject_type" using ("subject_type"::"memory_subject_type");`);
    this.addSql(`alter table "memory" alter column "created_at" set default now();`);
    this.addSql(`alter table "memory" add constraint "memory_campaign_id_fkey" foreign key ("campaign_id") references "campaign" ("id") on update no action on delete cascade;`);
    this.addSql(`create index "memory_embedding_idx" on "memory" ("embedding");`);

    this.addSql(`alter table "npc" add constraint "npc_campaign_id_fkey" foreign key ("campaign_id") references "campaign" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "npc" add constraint "npc_current_location_id_fkey" foreign key ("current_location_id") references "location" ("id") on update no action on delete set null;`);
    this.addSql(`create index "npc_campaign_id_idx" on "npc" ("campaign_id");`);

    this.addSql(`alter table "npc_item" add constraint "npc_item_item_id_fkey" foreign key ("item_id") references "item" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "npc_item" add constraint "npc_item_npc_id_fkey" foreign key ("npc_id") references "npc" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "npc_memory" alter column "created_at" set default now();`);

    this.addSql(`alter table "npc_relationship" add constraint "npc_relationship_source_npc_id_fkey" foreign key ("source_npc_id") references "npc" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "npc_relationship" add constraint "npc_relationship_target_npc_id_fkey" foreign key ("target_npc_id") references "npc" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "quest" alter column "status" type "quest_status" using ("status"::"quest_status");`);
    this.addSql(`create index "quest_campaign_id_status_idx" on "quest" ("campaign_id", "status");`);

    this.addSql(`alter table "quest_entity" alter column "entity_type" type "quest_entity_type" using ("entity_type"::"quest_entity_type");`);
    this.addSql(`alter table "quest_entity" add constraint "quest_entity_quest_id_fkey" foreign key ("quest_id") references "quest" ("id") on update no action on delete cascade;`);
    this.addSql(`create index "quest_entity_entity_type_entity_id_idx" on "quest_entity" ("entity_type", "entity_id");`);
    this.addSql(`create index "quest_entity_quest_id_idx" on "quest_entity" ("quest_id");`);

    this.addSql(`alter table "room_item" add constraint "room_item_room_id_foreign" foreign key ("room_id") references "location" ("id") on update cascade on delete no action;`);
    this.addSql(`alter table "room_item" add constraint "room_item_item_id_foreign" foreign key ("item_id") references "item" ("id") on update cascade on delete no action;`);

    this.addSql(`alter table "srd_equipment" alter column "weight" type float4 using ("weight"::float4);`);

    this.addSql(`alter table "world_event" alter column "created_at" set default now();`);
    this.addSql(`alter table "world_event" add constraint "world_event_campaign_id_fkey" foreign key ("campaign_id") references "campaign" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "world_event" add constraint "world_event_location_id_fkey" foreign key ("location_id") references "location" ("id") on update no action on delete set null;`);
    this.addSql(`create index "world_event_campaign_id_idx" on "world_event" ("campaign_id");`);
  }

}
