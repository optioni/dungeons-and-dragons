// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { defineConfig } from '@mikro-orm/postgresql';
import { UnauthorizedException } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {
    afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

import { User } from '../../auth/entities/user.entity';
import { getRequiredIntegrationDatabaseUrl } from '../../test-integration-environment.js';
import { AuthGuard } from './auth.guard';

const DB_URL = getRequiredIntegrationDatabaseUrl();
const TEST_JWT_SECRET = 'integration-test-secret-min-16-chars';

async function createOrm(): Promise<MikroORM> {
    return MikroORM.init(
        defineConfig({
            clientUrl: DB_URL,
            entities: [User],
        }),
    );
}

function makeGuard(userRepo: object, jwtService: JwtService): AuthGuard {
    const reflector = {
        get: vi.fn((key: string) => {
            if (key === 'isPublic') {
                return false;
            }

            return undefined;
        }),
    } as unknown as Reflector;
    return new AuthGuard(reflector, jwtService, userRepo as never);
}

function makeExecutionContext(gqlContextObject: object) {
    vi.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => gqlContextObject,
    } as never);

    return {
        getHandler: vi.fn(() => ({})),
        switchToHttp: vi.fn(() => ({
            getRequest: vi.fn(() => ({ url: '/graphql' })),
        })),
    };
}

describe('AuthGuard integration', () => {
    let orm: MikroORM;
    let testUser: User;
    let jwtService: JwtService;
    let userRepo: { getEntityManager: () => ReturnType<MikroORM['em']['fork']> };

    beforeEach(async () => {
        orm = await createOrm();
        jwtService = new JwtService({ secret: TEST_JWT_SECRET, signOptions: { expiresIn: '7d' } });

        const em = orm.em.fork();
        userRepo = { getEntityManager: () => em };

        testUser = em.create(User, {
            email: 'guard-test@example.com',
            passwordHash: await bcrypt.hash('password123', 12),
        });
        em.persist(testUser);
        await em.flush();
    });

    afterEach(async () => {
        const em = orm.em.fork();
        await em.nativeDelete(User, { email: 'guard-test@example.com' });
        await orm.close();
    });

    it('rejects unauthenticated request (no cookie)', async () => {
        const guard = makeGuard(userRepo, jwtService);
        const request = { headers: {} };
        const executionContext = makeExecutionContext({ req: request });

        await expect(guard.canActivate(executionContext as never)).rejects.toThrow(UnauthorizedException);
    });

    it('accepts request with valid JWT cookie and sets dbUser', async () => {
        const guard = makeGuard(userRepo, jwtService);
        const token = jwtService.sign({ sub: testUser.id });
        const request = { headers: { cookie: `access_token=${token}` }, dbUser: undefined as User | undefined };
        const executionContext = makeExecutionContext({ req: request });

        const result = await guard.canActivate(executionContext as never);

        expect(result).toBe(true);
        expect(request.dbUser).toBeDefined();
        expect(request.dbUser!.id).toBe(testUser.id);
    });

    it('rejects request with invalid JWT token', async () => {
        const guard = makeGuard(userRepo, jwtService);
        const request = { headers: { cookie: 'access_token=invalid-token' } };
        const executionContext = makeExecutionContext({ req: request });

        await expect(guard.canActivate(executionContext as never)).rejects.toThrow(UnauthorizedException);
    });
});
