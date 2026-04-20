import { Migration } from '@mikro-orm/migrations';

export class Migration20260420000000 extends Migration {
    override async up(): Promise<void> {
        await this.execute(`
            ALTER TABLE "campaign"
            ADD COLUMN "travel_encounter_enabled" boolean NOT NULL DEFAULT true;
        `);
    }

    override async down(): Promise<void> {
        await this.execute(`
            ALTER TABLE "campaign" DROP COLUMN "travel_encounter_enabled";
        `);
    }
}
