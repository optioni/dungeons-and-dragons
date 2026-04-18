import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Custom decorator that retrieves the connection ID from the GraphQL context.
 * Connection ID is unique per WebSocket connection and is used to filter out
 * echo events (preventing a user from receiving their own subscription events
 * in the same session while allowing cross-device sync for the same user).
 *
 * @param data - Additional data for the decorator (unused in this implementation).
 * @param context - The execution context containing the request context.
 * @returns The connection ID string, or undefined if not in a subscription context.
 */
export const CurrentConnectionId = createParamDecorator(
    (data: unknown, context: ExecutionContext): string | undefined => {
        const { connectionId } = GqlExecutionContext.create(context).getContext();

        return connectionId;
    },
);
