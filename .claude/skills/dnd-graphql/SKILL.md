---
name: dnd-graphql
description: Use when implementing GraphQL resolvers, queries, mutations, or subscriptions in apps/api — covers relay pagination, connection types, decorators, guards, filter inputs, and the GraphqlService
---

# D&D API — GraphQL Patterns

All shared GraphQL infrastructure lives in `apps/api/src/graphql/`. Always reach for these before writing new types or utilities.

## Quick Reference

| Need | What to use |
|---|---|
| List query return type | `createRelayConnection(Entity)` from `relay/` |
| Paginate a list | `GraphqlService.findAndPaginate()` |
| Single item query | `GraphqlService.findOne()` |
| Current user in resolver | `@CurrentUser() user: User` decorator |
| Connection ID (subscriptions) | `@CurrentConnectionId() connId?: string` decorator |
| Skip auth on a resolver | `@Public()` decorator |
| JSON/JSONB column | `JsonScalar` (`() => GraphQLJSON` in `@Field`) |
| Filter input → MikroORM where | `WhereService.getWhere()` |

## Relay Connection Pattern

Call `createRelayConnection` once per entity — never hand-write Edge/Connection types:

```ts
// my-entity.connection.ts
import { type Connection } from 'graphql-relay';

export const MyEntityConnection = createRelayConnection(MyEntity);
export type MyEntityConnection = Connection<MyEntity>;
```

Define a dedicated `@ArgsType()` class that extends `ConnectionArgs` and adds `where` and `orderBy`:

```ts
// my-entity-connection.args.ts
@ArgsType()
export class MyEntitiesConnectionArgs extends ConnectionArgs {
  @Field(() => MyEntityWhereInput, { nullable: true })
  where?: MyEntityWhereInput;

  @Field(() => [MyEntityOrderByInput], { nullable: true })
  orderBy?: MyEntityOrderByInput[];
}
```

Then destructure in the resolver. Import `Connection` from `graphql-relay` for the return type:

```ts
import { type Connection } from 'graphql-relay';

@Query(() => MyEntityConnection)
async myEntities(
  @Args() { where, orderBy, ...args }: MyEntitiesConnectionArgs,
): Promise<Connection<MyEntity>> {
  return this.graphqlService.findAndPaginate(
    this.myEntityRepository,
    where,
    orderBy,
    args,
  );
}
```

## Filter Input Convention

Where inputs implement `RelayWhere` from `where.service.ts`. Field names use `{field}_{operator}` suffix naming — no suffix defaults to `=`.

```ts
// my-entity-where.input.ts
@InputType()
export class MyEntityWhereInput implements RelayWhere {
  // Equality (default — no suffix needed)
  @Field(() => String, { nullable: true })
  name?: string;

  // Case-insensitive substring match (auto-wraps with %)
  @Field(() => String, { nullable: true })
  name_ilike?: string;

  // Numeric / date comparisons
  @Field(() => Int, { nullable: true })
  level_gte?: number;

  @Field(() => Int, { nullable: true })
  level_lte?: number;

  // Array membership
  @Field(() => [String], { nullable: true })
  id_in?: string[];

  // Logical combinators (recursive)
  @Field(() => [MyEntityWhereInput], { nullable: true })
  AND?: MyEntityWhereInput[];

  @Field(() => [MyEntityWhereInput], { nullable: true })
  OR?: MyEntityWhereInput[];
}
```

Supported operator suffixes:

| Suffix | SQL op |
|---|---|
| (none) / `_eq` | `=` |
| `_ne` | `!=` |
| `_ilike` | `ILIKE %…%` |
| `_gt`, `_gte`, `_lt`, `_lte` | comparisons |
| `_in`, `_notin` | `IN`, `NOT IN` |

`id` and any field ending in `Id` are automatically decoded from Relay global IDs — pass the encoded global ID from the client, no manual `fromGlobalId` call needed.

Custom field resolvers go in `FindOptions.resolvers` when a field needs non-standard mapping (e.g. a generic `search` across multiple columns). **Limitation:** custom resolver fields only work reliably at the top level of the where input. Placing them inside `AND`/`OR` subtrees is unreliable — the resolver returns its own complex `FilterQuery` (e.g. a nested `$or`) which can produce incorrect SQL when composed inside another `$or`/`$and` by MikroORM. Design your API so custom/search filters are always top-level, not nestable.

## OrderBy Input Convention

`OrderBy<T>` is a generic interface where `T` is an enum of the sortable fields. Define one enum + one input class per entity:

```ts
// my-entity-order-by.input.ts
export enum MyEntityOrderByField {
  NAME = 'name',
  CREATED_AT = 'createdAt',
  LEVEL = 'level',
}

registerEnumType(MyEntityOrderByField, { name: 'MyEntityOrderByField' });

@InputType()
export class MyEntityOrderByInput implements OrderBy<MyEntityOrderByField> {
  @Field(() => MyEntityOrderByField)
  field!: MyEntityOrderByField;

  @Field(() => OrderByDirection)
  direction!: OrderByDirection;
}
```

`OrderByDirection` (`ASC` / `DESC`) and `registerEnumType` are exported from `relay/`. Pass `MyEntityOrderByInput[]` as the `orderBy` field in the connection args class.

## Auth Patterns

`AuthGuard` is applied globally — all resolvers require a valid JWT by default.

```ts
// Opt out of auth
@Public()
@Query(() => String)
healthCheck(): string { ... }

// Access authenticated user
@Query(() => MyEntityConnection)
async myEntities(@CurrentUser() user: User, ...) { ... }

// Echo filtering in subscriptions
@Subscription(...)
async onEvent(@CurrentConnectionId() connId?: string) { ... }
```

Token is read from the `access_token` httpOnly cookie first, then `Authorization: Bearer` header.

## Common Mistakes

- **Hand-writing Edge/Connection types** — always use `createRelayConnection(Entity)`
- **Skipping `ConnectionArgs`** on list queries — every list must support relay pagination
- **Separate `@Args()` per field** — bundle `where`, `orderBy`, and cursor args into a single `@ArgsType()` class that extends `ConnectionArgs`, then destructure with `@Args() { where, orderBy, ...args }: MyConnectionArgs`
- **Using `WhereService` directly in resolvers** — use `GraphqlService.findAndPaginate()` instead; it calls `WhereService` internally
- **Hardcoding JWT checks** — use `@Public()` to opt out; never duplicate guard logic
- **Forgetting to decode global IDs** — `WhereService` handles `id` and `*Id` fields automatically; don't call `fromGlobalId` yourself
