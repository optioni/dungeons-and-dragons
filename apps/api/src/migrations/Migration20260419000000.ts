import { Migration } from '@mikro-orm/migrations';

export class Migration20260419000000 extends Migration {
    override async up(): Promise<void> {
        await this.execute(`
            ALTER TABLE "npc"
            ADD COLUMN "last_conversed_at" timestamptz NULL;
        `);
    }

    override async down(): Promise<void> {
        await this.execute(`
            ALTER TABLE "npc"
            DROP COLUMN IF EXISTS "last_conversed_at";
        `);
    }
}
