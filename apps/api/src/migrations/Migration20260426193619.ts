import { Migration } from '@mikro-orm/migrations';

export class Migration20260426193619 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "game_session" add "last_inner_voice" text null;`);

    this.addSql(`alter table "srd_equipment" alter column "weight" type real using ("weight"::real);`);

    this.addSql(`alter table "item" alter column "weight" type real using ("weight"::real);`);

    this.addSql(`alter table "srd_monster" alter column "challenge_rating" type real using ("challenge_rating"::real);`);

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
    this.addSql(`alter table "game_session" drop column "last_inner_voice";`);

    this.addSql(`alter table "item" alter column "weight" type float4 using ("weight"::float4);`);

    this.addSql(`alter table "srd_equipment" alter column "weight" type float4 using ("weight"::float4);`);

    this.addSql(`alter table "srd_monster" alter column "challenge_rating" type float4 using ("challenge_rating"::float4);`);
  }

}
