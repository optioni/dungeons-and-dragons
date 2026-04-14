import { type Opt } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from '@mikro-orm/postgresql';

@Entity()
export class User extends BaseEntity {
    @PrimaryKey({ type: 'integer', autoincrement: true })
    id!: number;

    @Unique()
    @Property({ type: 'text' })
    email!: string;

    @Property({ type: 'text' })
    passwordHash!: string;

    @Property({ type: 'date', onCreate: () => new Date() })
    createdAt: Opt<Date> = new Date();
}
