import { Migration } from '@mikro-orm/migrations';

export class Migration20260423000000 extends Migration {
    override async up(): Promise<void> {
        await this.execute(`
            alter table "character"
            add column "personality_traits" jsonb null default '[]',
            add column "ideals" jsonb null default '[]',
            add column "bonds" jsonb null default '[]',
            add column "flaws" jsonb null default '[]';
        `);
    }

    override async down(): Promise<void> {
        await this.execute(`
            alter table "character"
            drop column if exists "personality_traits",
            drop column if exists "ideals",
            drop column if exists "bonds",
            drop column if exists "flaws";
        `);
    }
}
