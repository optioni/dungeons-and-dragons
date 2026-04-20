import { Migration } from '@mikro-orm/migrations';

export class Migration20260420103919PermadeathCampaignEnd extends Migration {

    override up(): void | Promise<void> {
        this.addSql(`alter table "campaign" add column "status" text not null default 'ACTIVE', add column "ended_at" timestamptz null, add column "end_reason" text null;`);
        this.addSql(`alter table "diary_entry" add column "entry_type" text not null default 'DAILY';`);
    }

    override down(): void | Promise<void> {
        this.addSql(`alter table "campaign" drop column "status", drop column "ended_at", drop column "end_reason";`);
        this.addSql(`alter table "diary_entry" drop column "entry_type";`);
    }

}
