import { UnauthorizedException } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import {
    describe, expect, it, vi,
} from 'vitest';

import { AuthGuard } from './auth.guard';

/* eslint-disable @typescript-eslint/naming-convention */
vi.mock('@mikro-orm/decorators/legacy', () => ({
    Entity: () => () => {},
    PrimaryKey: () => () => {},
    Property: () => () => {},
    Unique: () => () => {},
}));

vi.mock('@nestjs/graphql', () => ({
    GqlExecutionContext: {
        create: vi.fn(),
    },
}));

vi.mock('@nestjs/jwt', () => ({
    JwtService: class {
        verify(token: string) {
            if (token === 'valid-token') {
                return { sub: 'user-uuid' };
            }

            throw new Error('invalid token');
        }
    },
}));

const makeContext = (overrides: Partial<{
    isPublic: boolean
    cookieHeader: string | undefined
    dbUser: object | null
    userInRepo: object | null
}> = {}) => {
    const {
        isPublic = false,
        cookieHeader,
        userInRepo = null,
    } = overrides;

    const reflector = {
        get: vi.fn((key: string) => {
            if (key === 'isPublic') {
                return isPublic;
            }

            return undefined;
        }),
    } as unknown as Reflector;

    const request = {
        headers: { cookie: cookieHeader },
    };

    const gqlContext = { getContext: vi.fn(() => ({ req: request })) };
    vi.mocked(GqlExecutionContext.create).mockReturnValue(gqlContext as never);

    const jwtService = new JwtService();
    const em = { findOne: vi.fn().mockResolvedValue(userInRepo) };
    const userRepo = { getEntityManager: vi.fn(() => em) };

    const executionContext = {
        getHandler: vi.fn(() => ({})),
        switchToHttp: vi.fn(() => ({ getRequest: vi.fn(() => ({ url: '/graphql' })) })),
    };

    return { reflector, jwtService, userRepo, executionContext };
};

describe('AuthGuard', () => {
    it('allows public routes without JWT', async () => {
        const { reflector, jwtService, userRepo, executionContext } = makeContext({ isPublic: true });
        const guard = new AuthGuard(reflector, jwtService, userRepo as never);

        const result = await guard.canActivate(executionContext as never);

        expect(result).toBe(true);
    });

    it('throws UnauthorizedException when no JWT cookie is present', async () => {
        const { reflector, jwtService, userRepo, executionContext } = makeContext({
            isPublic: false,
            cookieHeader: undefined,
        });
        const guard = new AuthGuard(reflector, jwtService, userRepo as never);

        await expect(guard.canActivate(executionContext as never)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when JWT is invalid', async () => {
        const { reflector, jwtService, userRepo, executionContext } = makeContext({
            isPublic: false,
            cookieHeader: 'access_token=invalid-token',
        });
        const guard = new AuthGuard(reflector, jwtService, userRepo as never);

        await expect(guard.canActivate(executionContext as never)).rejects.toThrow(UnauthorizedException);
    });

    it('allows valid JWT and sets dbUser on request', async () => {
        const user = { id: 'user-uuid', email: 'test@example.com' };
        const { reflector, jwtService, userRepo, executionContext } = makeContext({
            isPublic: false,
            cookieHeader: 'access_token=valid-token',
            userInRepo: user,
        });
        const guard = new AuthGuard(reflector, jwtService, userRepo as never);
        const context = { req: { headers: { cookie: 'access_token=valid-token' } } };
        vi.mocked(GqlExecutionContext.create).mockReturnValue({ getContext: vi.fn(() => context) } as never);

        const result = await guard.canActivate(executionContext as never);

        expect(result).toBe(true);
        expect((context.req as { dbUser?: typeof user }).dbUser).toEqual(user);
    });
});
/* eslint-enable @typescript-eslint/naming-convention */
