import { Migration } from '@mikro-orm/migrations';

import { SrdSeeder } from '../srd/srd.seeder.js';

export class Migration20260413000002 extends Migration {
    override async up(): Promise<void> {
        await this.execute(`
            CREATE TABLE "srd_class" (
                "id" serial NOT NULL,
                "index" text NOT NULL,
                "name" text NOT NULL,
                "hit_die" int NOT NULL,
                "proficiencies" jsonb NOT NULL,
                "saving_throws" jsonb NOT NULL,
                "spellcasting_ability" text NULL,
                CONSTRAINT "srd_class_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "srd_class_index_unique" UNIQUE ("index")
            );
        `);

        await this.execute(`
            CREATE TABLE "srd_race" (
                "id" serial NOT NULL,
                "index" text NOT NULL,
                "name" text NOT NULL,
                "speed" int NOT NULL,
                "ability_bonuses" jsonb NOT NULL,
                "traits" jsonb NOT NULL,
                "size" text NOT NULL,
                CONSTRAINT "srd_race_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "srd_race_index_unique" UNIQUE ("index")
            );
        `);

        await this.execute(`
            CREATE TABLE "srd_spell" (
                "id" serial NOT NULL,
                "index" text NOT NULL,
                "name" text NOT NULL,
                "level" int NOT NULL,
                "school" text NOT NULL,
                "casting_time" text NOT NULL,
                "range" text NOT NULL,
                "components" jsonb NOT NULL,
                "duration" text NOT NULL,
                "description" text NOT NULL,
                "higher_level" text NULL,
                "classes" jsonb NOT NULL,
                CONSTRAINT "srd_spell_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "srd_spell_index_unique" UNIQUE ("index")
            );
        `);

        await this.execute(`
            CREATE TABLE "srd_monster" (
                "id" serial NOT NULL,
                "index" text NOT NULL,
                "name" text NOT NULL,
                "size" text NOT NULL,
                "type" text NOT NULL,
                "alignment" text NOT NULL,
                "armor_class" int NOT NULL,
                "hit_points" int NOT NULL,
                "challenge_rating" float NOT NULL,
                "speed" jsonb NOT NULL,
                "ability_scores" jsonb NOT NULL,
                "actions" jsonb NOT NULL,
                CONSTRAINT "srd_monster_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "srd_monster_index_unique" UNIQUE ("index")
            );
        `);

        await this.execute(`
            CREATE TABLE "srd_equipment" (
                "id" serial NOT NULL,
                "index" text NOT NULL,
                "name" text NOT NULL,
                "category" text NOT NULL,
                "cost" jsonb NOT NULL,
                "weight" float NULL,
                "properties" jsonb NOT NULL,
                "damage" jsonb NULL,
                CONSTRAINT "srd_equipment_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "srd_equipment_index_unique" UNIQUE ("index")
            );
        `);

        await this.execute(`
            CREATE TABLE "srd_condition" (
                "id" serial NOT NULL,
                "index" text NOT NULL,
                "name" text NOT NULL,
                "description" text NOT NULL,
                CONSTRAINT "srd_condition_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "srd_condition_index_unique" UNIQUE ("index")
            );
        `);

        const em = this.getEntityManager();
        if (!em) {
            console.warn(
                '[Migration20260413000002] No EntityManager available — SRD seeder skipped. ' +
                'Run `mikro-orm seeder:run` manually to populate SRD tables.',
            );
            return;
        }
        const seeder = new SrdSeeder();
        await seeder.run(em);
    }

    override async down(): Promise<void> {
        await this.execute('DROP TABLE IF EXISTS "srd_condition";');
        await this.execute('DROP TABLE IF EXISTS "srd_equipment";');
        await this.execute('DROP TABLE IF EXISTS "srd_monster";');
        await this.execute('DROP TABLE IF EXISTS "srd_spell";');
        await this.execute('DROP TABLE IF EXISTS "srd_race";');
        await this.execute('DROP TABLE IF EXISTS "srd_class";');
    }
}
