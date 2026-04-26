// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { ArgsType, Field, Int } from '@nestjs/graphql';
import { Min, Validate, ValidateIf } from 'class-validator';
import { type ConnectionArguments, type ConnectionCursor } from 'graphql-relay';

import { CannotUseWith } from './validators/cannot-use-with';
import { CannotUseWithout } from './validators/cannot-use-without';

@ArgsType()
export class ConnectionArgs implements ConnectionArguments {
    @Field(() => String, {
        nullable: true,
        description: 'Paginate before opaque cursor',
    })
    @ValidateIf((object) => object.before !== undefined)
    @Validate(CannotUseWithout, ['last'])
    @Validate(CannotUseWith, ['after', 'first'])
    readonly before?: ConnectionCursor;

    @Field(() => String, {
        nullable: true,
        description: 'Paginate after opaque cursor',
    })
    @ValidateIf((object) => object.after !== undefined)
    @Validate(CannotUseWithout, ['first'])
    @Validate(CannotUseWith, ['before', 'last'])
    readonly after?: ConnectionCursor;

    @Field(() => Int, {
        nullable: true,
        description: 'Paginate first',
    })
    @ValidateIf((object) => object.last === undefined)
    @Min(1)
    @Validate(CannotUseWith, ['before', 'last'])
    readonly first?: number;

    @Field(() => Int, {
        nullable: true,
        description: 'Paginate last',
    })
    @ValidateIf((object) => object.last !== undefined)
    @Validate(CannotUseWith, ['after', 'first'])
    @Min(1)
    readonly last?: number;
}
