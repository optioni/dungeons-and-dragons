import { Migration } from '@mikro-orm/migrations';

export class Migration20260424000000 extends Migration {
    override async up(): Promise<void> {
        await this.execute(`
            alter table "map"
            add column "map_scale" text null;
        `);
    }

    override async down(): Promise<void> {
        await this.execute(`
            alter table "map"
            drop column if exists "map_scale";
        `);
    }
}
