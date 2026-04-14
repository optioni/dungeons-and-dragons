import { type Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';

import { PageInfo } from './page-info.js';

export interface IEdge<T> {
    cursor: string;
    node: T;
}

export interface IConnection<T> {
    edges: Array<IEdge<T>>;
    pageInfo: PageInfo;
}

/**
 * Generates NestJS GraphQL `@ObjectType` classes for a Relay connection over
 * the given node type. Call once per entity type and export the result.
 *
 * Usage:
 *   export const SrdSpellConnection = createRelayConnection(SrdSpell);
 *   export type SrdSpellConnection = InstanceType<typeof SrdSpellConnection>;
 */
export function createRelayConnection<T>(classRef: Type<T>): Type<IConnection<T>> {
    @ObjectType(`${classRef.name}Edge`)
    class EdgeType implements IEdge<T> {
        @Field(() => String)
        cursor!: string;

        @Field(() => classRef)
        node!: T;
    }

    @ObjectType(`${classRef.name}Connection`)
    class ConnectionType implements IConnection<T> {
        @Field(() => [EdgeType])
        edges!: EdgeType[];

        @Field(() => PageInfo)
        pageInfo!: PageInfo;
    }

    return ConnectionType;
}
