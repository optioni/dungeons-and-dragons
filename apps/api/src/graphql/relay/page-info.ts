import { Field, ObjectType } from '@nestjs/graphql';
import * as Relay from 'graphql-relay';

@ObjectType()
export class PageInfo implements Relay.PageInfo {
    @Field(() => Boolean)
    readonly hasNextPage!: boolean;

    @Field(() => Boolean)
    readonly hasPreviousPage!: boolean;

    @Field(() => String, { nullable: true })
    readonly startCursor!: Relay.ConnectionCursor | null;

    @Field(() => String, { nullable: true })
    readonly endCursor!: Relay.ConnectionCursor | null;
}
