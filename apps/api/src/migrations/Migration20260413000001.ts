import { Migration } from '@mikro-orm/migrations';

export class Migration20260413000001 extends Migration {
    override async up(): Promise<void> {
        await this.execute(`
            CREATE TABLE "user" (
                "id" serial NOT NULL,
                "email" text NOT NULL,
                "password_hash" text NOT NULL,
                "created_at" date NOT NULL,
                CONSTRAINT "user_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "user_email_unique" UNIQUE ("email")
            );
        `);
    }

    override async down(): Promise<void> {
        await this.execute(`DROP TABLE IF EXISTS "user";`);
    }
}
