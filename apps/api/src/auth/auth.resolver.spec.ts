import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { AuthResolver } from './auth.resolver';
import { type AuthService } from './auth.service';

/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class */
vi.mock('@mikro-orm/decorators/legacy', () => ({
    Entity: () => () => {},
    PrimaryKey: () => () => {},
    Property: () => () => {},
    Unique: () => () => {},
}));

vi.mock('@nestjs/graphql', () => ({
    Resolver: () => () => {},
    Mutation: () => () => {},
    Args: () => () => {},
    Context: () => () => {},
    ObjectType: () => () => {},
    Field: () => () => {},
    InputType: () => () => {},
}));

vi.mock('./dto/register.input', () => ({
    RegisterInput: class {},
}));

vi.mock('./dto/login.input', () => ({
    LoginInput: class {},
}));

vi.mock('./dto/auth-payload.type', () => ({
    AuthPayload: class {},
}));

vi.mock('../graphql/decorators/public.decorator', () => ({
    Public: () => () => {},
}));

const makeAuthService = () => ({
    register: vi.fn(),
    login: vi.fn(),
});

const makeContext = () => ({
    res: { cookie: vi.fn() },
});

describe('AuthResolver', () => {
    let resolver: AuthResolver;
    let authService: ReturnType<typeof makeAuthService>;

    beforeEach(() => {
        authService = makeAuthService();
        resolver = new AuthResolver(authService as unknown as AuthService);
    });

    describe('register mutation', () => {
        it('returns accessToken on success', async () => {
            authService.register.mockResolvedValue('jwt-token');

            const result = await resolver.register(
                { email: 'test@example.com', password: 'password123' },
                makeContext(),
            );

            expect(result).toEqual({ accessToken: 'jwt-token' });
        });

        it('sets httpOnly cookie on success', async () => {
            authService.register.mockResolvedValue('jwt-token');
            const context = makeContext();

            await resolver.register({ email: 'test@example.com', password: 'password123' }, context);

            expect(context.res.cookie).toHaveBeenCalledWith(
                'access_token',
                'jwt-token',
                expect.objectContaining({ httpOnly: true }),
            );
        });

        it('propagates error on duplicate email', async () => {
            authService.register.mockRejectedValue(new Error('Email already in use'));

            await expect(
                resolver.register({ email: 'dup@example.com', password: 'password123' }, makeContext()),
            ).rejects.toThrow('Email already in use');
        });
    });

    describe('login mutation', () => {
        it('returns accessToken on valid credentials', async () => {
            authService.login.mockResolvedValue('jwt-token');

            const result = await resolver.login(
                { email: 'test@example.com', password: 'password123' },
                makeContext(),
            );

            expect(result).toEqual({ accessToken: 'jwt-token' });
        });

        it('sets httpOnly cookie on success', async () => {
            authService.login.mockResolvedValue('jwt-token');
            const context = makeContext();

            await resolver.login({ email: 'test@example.com', password: 'password123' }, context);

            expect(context.res.cookie).toHaveBeenCalledWith(
                'access_token',
                'jwt-token',
                expect.objectContaining({ httpOnly: true }),
            );
        });
    });
});
/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class */
