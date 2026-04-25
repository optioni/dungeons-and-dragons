import { Migration } from '@mikro-orm/migrations';

export class Migration20260424182335 extends Migration {

  override up(): void | Promise<void> {
    this.addSql(`alter table "campaign" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "campaign" alter column "created_at" type date using ("created_at"::date);`);
  }

}
