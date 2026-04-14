import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mikro-orm/decorators/legacy', () => ({
    Entity: () => () => {},
    PrimaryKey: () => () => {},
    Property: () => () => {},
    Unique: () => () => {},
}));

vi.mock('bcryptjs', () => ({
    hash: vi.fn(async (password: string) => `hashed:${password}`),
    compare: vi.fn(async (password: string, hash: string) => hash === `hashed:${password}`),
}));

vi.mock('@nestjs/jwt', () => ({
    JwtService: class {
        sign() { return 'signed-jwt-token'; }
    },
}));

import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AuthService } from './auth.service';

const makeRepo = () => {
    const flush = vi.fn(async () => {});
    const persist = vi.fn(() => {});
    const findOne = vi.fn(async () => null as unknown);
    const em = {
        create: vi.fn((_: unknown, data: object) => ({ id: 'user-uuid', ...data })),
        persist,
        flush,
        findOne,
    };
    return {
        getEntityManager: vi.fn(() => em),
    };
};

describe('AuthService', () => {
    let service: AuthService;
    let userRepo: ReturnType<typeof makeRepo>;
    let jwtService: JwtService;

    beforeEach(() => {
        userRepo = makeRepo();
        jwtService = new JwtService();
        service = new AuthService(userRepo as never, jwtService);
    });

    describe('register', () => {
        it('hashes the password and persists the user', async () => {
            userRepo.getEntityManager().findOne.mockResolvedValue(null);

            await service.register('test@example.com', 'password123');

            const em = userRepo.getEntityManager();
            const [, created] = em.create.mock.calls[0] as [unknown, { email: string; passwordHash: string }];
            expect(created.email).toBe('test@example.com');
            expect(created.passwordHash).toBe('hashed:password123');
        });

        it('returns a signed JWT', async () => {
            userRepo.getEntityManager().findOne.mockResolvedValue(null);

            const token = await service.register('test@example.com', 'password123');

            expect(token).toBe('signed-jwt-token');
        });

        it('throws if email is already in use', async () => {
            userRepo.getEntityManager().findOne.mockResolvedValue({ id: 'existing', email: 'test@example.com' });

            await expect(service.register('test@example.com', 'password123')).rejects.toThrow('Email already in use');
        });
    });

    describe('login', () => {
        it('returns a signed JWT on valid credentials', async () => {
            userRepo.getEntityManager().findOne.mockResolvedValue({
                id: 'user-uuid',
                email: 'test@example.com',
                passwordHash: 'hashed:correctpassword',
            });

            const token = await service.login('test@example.com', 'correctpassword');

            expect(token).toBe('signed-jwt-token');
        });

        it('throws UnauthorizedException on wrong password', async () => {
            userRepo.getEntityManager().findOne.mockResolvedValue({
                id: 'user-uuid',
                email: 'test@example.com',
                passwordHash: 'hashed:correctpassword',
            });

            await expect(service.login('test@example.com', 'wrongpassword')).rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException when email is not found', async () => {
            userRepo.getEntityManager().findOne.mockResolvedValue(null);

            await expect(service.login('unknown@example.com', 'password123')).rejects.toThrow(UnauthorizedException);
        });
    });
});
