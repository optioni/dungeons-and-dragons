import { Migration } from '@mikro-orm/migrations';

export class Migration20260419092811 extends Migration {

    override async up(): Promise<void> {
        await this.execute(`ALTER TABLE "campaign" ADD COLUMN "in_game_day" int NOT NULL DEFAULT 1;`);
        await this.execute(`ALTER TABLE "npc" DROP COLUMN IF EXISTS "next_tick_in_game_date";`);
        await this.execute(`ALTER TABLE "npc" ADD COLUMN "next_tick_in_game_day" int NULL;`);
    }

    override async down(): Promise<void> {
        await this.execute(`ALTER TABLE "campaign" DROP COLUMN "in_game_day";`);
        await this.execute(`ALTER TABLE "npc" DROP COLUMN "next_tick_in_game_day";`);
        await this.execute(`ALTER TABLE "npc" ADD COLUMN "next_tick_in_game_date" text NULL;`);
    }

}
