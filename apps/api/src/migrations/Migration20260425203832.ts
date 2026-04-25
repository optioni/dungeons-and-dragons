import { Migration } from '@mikro-orm/migrations';
import { SrdSeeder } from '../srd/srd.seeder';

export class Migration20260425203832 extends Migration {
    override async up(): Promise<void> {
        this.addSql(
            `create table "campaign" ("id" serial primary key, "user_id" int not null, "name" text not null, "status" text not null default 'ACTIVE', "ended_at" timestamptz null, "end_reason" text null, "setup_status" text not null default 'DRAFT', "tone" text null, "death_mode" text null, "generated_concepts" jsonb null, "selected_concept" jsonb null, "opening_scene_seed" jsonb null, "antagonist_npc_id" int null, "antagonist_plan_state" jsonb null, "current_location_id" int null, "in_game_date" text null, "in_game_day" int not null default 1, "travel_encounter_enabled" boolean not null default true, "lore_document" text null, "created_at" timestamptz not null);`,
        );

        this.addSql(
            `create table "diary_entry" ("id" serial primary key, "campaign_id" int not null, "entry_type" text not null default 'DAILY', "in_game_date" text not null, "content" varchar(1000) not null, "embedding" vector(1024) null, "created_at" timestamptz not null);`,
        );

        this.addSql(
            `create table "dungeon" ("id" serial primary key, "campaign_id" int not null, "name" text not null, "description" text not null, "total_floors" int not null default 1, "encounter_table" jsonb null);`,
        );

        this.addSql(
            `create table "faction" ("id" serial primary key, "campaign_id" int not null, "name" text not null, "goals" text null, "power_level" int null, "player_disposition" text null, "territory" text null);`,
        );

        this.addSql(
            `create table "game_session" ("id" serial primary key, "campaign_id" int not null, "scene_type" text not null default 'EXPLORATION', "active_dungeon_id" int null, "started_at" timestamptz not null, "ended_at" timestamptz null, "level_up_pending" boolean not null default false);`,
        );

        this.addSql(
            `create table "game_event" ("id" serial primary key, "session_id" int not null, "event_type" text not null, "content" jsonb not null, "created_at" timestamptz not null);`,
        );

        this.addSql(
            `create table "combat_session" ("id" serial primary key, "session_id" int not null, "combatants" jsonb not null, "current_turn_index" int not null default 0, "round_number" int not null default 1);`,
        );
        this.addSql(
            `alter table "combat_session" add constraint "combat_session_session_id_unique" unique ("session_id");`,
        );

        this.addSql(
            `create table "location" ("id" serial primary key, "campaign_id" int not null, "dungeon_id" int null, "name" text not null, "description" text not null, "current_state" text null, "coordinates" jsonb null, "connected_location_ids" jsonb not null default '[]', "recent_events" jsonb not null default '[]', "floor" int null, "room_state" text null, "parent_location_id" int null);`,
        );

        this.addSql(
            `create table "location_discovery" ("id" serial primary key, "campaign_id" int not null, "location_id" int not null, "discovered_at" date not null, "source" text not null default 'PLAYER_ACTION', "source_id" int null);`,
        );

        this.addSql(
            `create table "location_item" ("id" serial primary key, "location_id" int not null, "item_id" int not null, "item_name" text not null, "quantity" int not null default 1, "note" text null);`,
        );
        this.addSql(
            `alter table "location_item" add constraint "location_item_location_id_item_id_unique" unique ("location_id", "item_id");`,
        );

        this.addSql(
            `create table "map" ("id" serial primary key, "campaign_id" int not null, "name" text not null, "description" text null, "scale" text null, "map_scale" text null);`,
        );

        this.addSql(
            `create table "map_location" ("id" serial primary key, "map_id" int not null, "location_id" int not null);`,
        );

        this.addSql(
            `create table "memory" ("id" serial primary key, "campaign_id" int not null, "subject_type" text not null, "subject_id" uuid null, "content" varchar(1000) not null, "embedding" vector(1024) null, "created_at" timestamptz not null);`,
        );

        this.addSql(
            `create table "npc" ("id" serial primary key, "campaign_id" int not null, "name" text not null, "description" text null, "profession" text null, "core_motivation" text null, "personality_traits" jsonb not null default '[]', "speech_style" text null, "disposition" text null, "current_location_id" int null, "alive" boolean not null default true, "hp" int null, "max_hp" int null, "party_status" text not null default 'NONE', "agenda" text null, "next_tick_in_game_day" int null, "last_conversed_at" timestamptz null);`,
        );

        this.addSql(
            `create table "npc_item" ("id" serial primary key, "npc_id" int not null, "item_id" int null, "name" text not null, "quantity" int not null default 1, "merchant_price" int null);`,
        );

        this.addSql(
            `create table "npc_memory" ("id" serial primary key, "npc_id" int not null, "content" varchar(1000) not null, "embedding" vector(1024) null, "in_game_date" text null, "source_npc_id" int null, "created_at" timestamptz not null);`,
        );
        this.addSql(`create index "npc_memory_npc_id_index" on "npc_memory" ("npc_id");`);

        this.addSql(
            `create table "npc_relationship" ("id" serial primary key, "source_npc_id" int not null, "target_npc_id" int not null, "type" text not null, "description" text null, "disposition" text null);`,
        );

        this.addSql(
            `create table "quest" ("id" serial primary key, "campaign_id" int not null, "title" text not null, "description" text not null, "status" text not null default 'ACTIVE', "agenda_impact" text null, "reward_narrative" text null, "reward_xp" int null, "reward_gold" int null, "created_at" timestamptz not null default now());`,
        );

        this.addSql(
            `create table "quest_entity" ("id" serial primary key, "quest_id" int not null, "entity_type" text not null, "entity_id" int not null);`,
        );

        this.addSql(
            `create table "quest_objective" ("id" serial primary key, "quest_id" int not null, "description" text not null, "type" text not null, "status" text not null default 'INCOMPLETE', "entity_id" int null, "order" int not null default 0);`,
        );

        this.addSql(
            `create table "room_encounter" ("id" serial primary key, "room_id" int not null, "description" text not null, "cleared" boolean not null default false, "monsters" jsonb not null);`,
        );

        this.addSql(
            `create table "srd_class" ("id" serial primary key, "index" text not null, "name" text not null, "hit_die" int not null, "proficiencies" jsonb not null, "saving_throws" jsonb not null, "spellcasting_ability" text null);`,
        );
        this.addSql(
            `alter table "srd_class" add constraint "srd_class_index_unique" unique ("index");`,
        );

        this.addSql(
            `create table "srd_condition" ("id" serial primary key, "index" text not null, "name" text not null, "description" text not null);`,
        );
        this.addSql(
            `alter table "srd_condition" add constraint "srd_condition_index_unique" unique ("index");`,
        );

        this.addSql(
            `create table "srd_equipment" ("id" serial primary key, "index" text not null, "name" text not null, "category" text not null, "cost" jsonb not null, "weight" real null, "properties" jsonb not null, "damage" jsonb null);`,
        );
        this.addSql(
            `alter table "srd_equipment" add constraint "srd_equipment_index_unique" unique ("index");`,
        );

        this.addSql(
            `create table "item" ("id" serial primary key, "name" text not null, "description" text not null, "weight" real null, "value" int null, "item_type" text not null, "srd_equipment_id" int null);`,
        );

        this.addSql(
            `create table "room_item" ("id" serial primary key, "room_id" int not null, "item_id" int not null, "quantity" int not null default 1, "container_name" text null);`,
        );

        this.addSql(
            `create table "srd_monster" ("id" serial primary key, "index" text not null, "name" text not null, "size" text not null, "type" text not null, "alignment" text not null, "armor_class" int not null, "hit_points" int not null, "challenge_rating" real not null, "speed" jsonb not null, "ability_scores" jsonb not null, "actions" jsonb not null);`,
        );
        this.addSql(
            `alter table "srd_monster" add constraint "srd_monster_index_unique" unique ("index");`,
        );

        this.addSql(
            `create table "srd_race" ("id" serial primary key, "index" text not null, "name" text not null, "speed" int not null, "ability_bonuses" jsonb not null, "traits" jsonb not null, "size" text not null);`,
        );
        this.addSql(
            `alter table "srd_race" add constraint "srd_race_index_unique" unique ("index");`,
        );

        this.addSql(
            `create table "character" ("id" serial primary key, "name" text not null, "level" int not null default 1, "ability_scores" jsonb not null, "hp" int not null, "max_hp" int not null, "ac" int not null, "conditions" jsonb not null default '[]', "spell_slots" jsonb not null default '[]', "prepared_spells" jsonb not null default '[]', "personality_traits" jsonb null default '[]', "ideals" jsonb null default '[]', "bonds" jsonb null default '[]', "flaws" jsonb null default '[]', "skill_proficiencies" jsonb not null, "gold_pieces" int not null default 0, "silver_pieces" int not null default 0, "copper_pieces" int not null default 0, "xp" int not null default 0, "death_save_successes" int not null default 0, "death_save_failures" int not null default 0, "is_dead" boolean not null default false, "hit_dice_remaining" int not null default 1, "race_id" int not null, "srd_class_id" int not null, "campaign_id" int not null);`,
        );

        this.addSql(
            `create table "character_item" ("id" serial primary key, "character_id" int not null, "item_id" int not null, "quantity" int not null default 1, "slot" text null, "condition" text null);`,
        );

        this.addSql(
            `create table "srd_spell" ("id" serial primary key, "index" text not null, "name" text not null, "level" int not null, "school" text not null, "casting_time" text not null, "range" text not null, "components" jsonb not null, "duration" text not null, "description" text not null, "higher_level" text null, "classes" jsonb not null);`,
        );
        this.addSql(
            `alter table "srd_spell" add constraint "srd_spell_index_unique" unique ("index");`,
        );

        this.addSql(
            `create table "user" ("id" serial primary key, "email" text not null, "password_hash" text not null, "created_at" date not null);`,
        );
        this.addSql(`alter table "user" add constraint "user_email_unique" unique ("email");`);

        this.addSql(
            `create table "world_event" ("id" serial primary key, "campaign_id" int not null, "description" text not null, "location_id" int null, "deadline_in_game_date" text null, "source" text not null default 'WORLD_TICK', "status" text not null default 'ACTIVE', "outcome" text null, "created_at" date not null);`,
        );

        this.addSql(
            `alter table "diary_entry" add constraint "diary_entry_campaign_id_foreign" foreign key ("campaign_id") references "campaign" ("id") on delete cascade;`,
        );

        this.addSql(
            `alter table "dungeon" add constraint "dungeon_campaign_id_foreign" foreign key ("campaign_id") references "campaign" ("id");`,
        );

        this.addSql(
            `alter table "game_session" add constraint "game_session_campaign_id_foreign" foreign key ("campaign_id") references "campaign" ("id");`,
        );
        this.addSql(
            `alter table "game_session" add constraint "game_session_active_dungeon_id_foreign" foreign key ("active_dungeon_id") references "dungeon" ("id") on delete set null;`,
        );

        this.addSql(
            `alter table "game_event" add constraint "game_event_session_id_foreign" foreign key ("session_id") references "game_session" ("id");`,
        );

        this.addSql(
            `alter table "combat_session" add constraint "combat_session_session_id_foreign" foreign key ("session_id") references "game_session" ("id");`,
        );

        this.addSql(
            `alter table "location" add constraint "location_dungeon_id_foreign" foreign key ("dungeon_id") references "dungeon" ("id") on delete set null;`,
        );

        this.addSql(
            `alter table "memory" add constraint "memory_campaign_id_foreign" foreign key ("campaign_id") references "campaign" ("id") on delete cascade;`,
        );

        this.addSql(
            `alter table "quest_entity" add constraint "quest_entity_quest_id_foreign" foreign key ("quest_id") references "quest" ("id");`,
        );

        this.addSql(
            `alter table "quest_objective" add constraint "quest_objective_quest_id_foreign" foreign key ("quest_id") references "quest" ("id");`,
        );

        this.addSql(
            `alter table "room_encounter" add constraint "room_encounter_room_id_foreign" foreign key ("room_id") references "location" ("id");`,
        );

        this.addSql(
            `alter table "item" add constraint "item_srd_equipment_id_foreign" foreign key ("srd_equipment_id") references "srd_equipment" ("id") on delete set null;`,
        );

        this.addSql(
            `alter table "room_item" add constraint "room_item_room_id_foreign" foreign key ("room_id") references "location" ("id");`,
        );
        this.addSql(
            `alter table "room_item" add constraint "room_item_item_id_foreign" foreign key ("item_id") references "item" ("id");`,
        );

        this.addSql(
            `alter table "character" add constraint "character_race_id_foreign" foreign key ("race_id") references "srd_race" ("id");`,
        );
        this.addSql(
            `alter table "character" add constraint "character_srd_class_id_foreign" foreign key ("srd_class_id") references "srd_class" ("id");`,
        );
        this.addSql(
            `alter table "character" add constraint "character_campaign_id_foreign" foreign key ("campaign_id") references "campaign" ("id");`,
        );

        this.addSql(
            `alter table "character_item" add constraint "character_item_character_id_foreign" foreign key ("character_id") references "character" ("id");`,
        );
        this.addSql(
            `alter table "character_item" add constraint "character_item_item_id_foreign" foreign key ("item_id") references "item" ("id");`,
        );

        const em = this.getEntityManager();
        if (!em) {
            console.warn(
                '[Migration20260425203832] No EntityManager available — SRD seeder skipped. ' +
                    'Run `mikro-orm seeder:run` manually to populate SRD tables.',
            );
            return;
        }
        const seeder = new SrdSeeder();
        await seeder.run(em);
    }
}
