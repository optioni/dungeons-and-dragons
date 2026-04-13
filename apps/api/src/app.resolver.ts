import { Query, Resolver } from '@nestjs/graphql';

// TODO: remove this placeholder once the first real resolver is added
@Resolver()
export class AppResolver {
    @Query(() => String)
    hello(): string {
        return 'Hello from the D&D API!';
    }
}
