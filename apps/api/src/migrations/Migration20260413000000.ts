import { Migration } from '@mikro-orm/migrations';

export class Migration20260413000000 extends Migration {
    override async up(): Promise<void> {
        await this.execute('CREATE EXTENSION IF NOT EXISTS vector;');
    }

    override async down(): Promise<void> {
        await this.execute('DROP EXTENSION IF EXISTS vector;');
    }
}
