import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { type User } from '../../auth/entities/user.entity';

/**
 * Custom decorator that retrieves the authenticated database User entity from the context.
 * This is the User entity fetched/created during authentication.
 * Throws an error if the user is not found in the context.
 * @param data - Additional data for the decorator (unused in this implementation).
 * @param context - The execution context containing the request context.
 * @returns The authenticated User entity from the database.
 * @throws Error if the user is not found in the context.
 */
export const CurrentUser = createParamDecorator((data: unknown, context: ExecutionContext): User => {
    const { dbUser } = GqlExecutionContext.create(context).getContext();

    if (!dbUser) {
        throw new Error('Database user not found in context');
    }

    return dbUser;
});
