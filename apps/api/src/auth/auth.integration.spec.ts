// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { defineConfig } from '@mikro-orm/postgresql';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {
    afterEach, beforeEach, describe, expect, it,
} from 'vitest';

import { getRequiredIntegrationDatabaseUrl } from '../test-integration-environment.js';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

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

describe('AuthService integration', () => {
    let orm: MikroORM;
    let authService: AuthService;
    const createdEmails: string[] = [];

    beforeEach(async () => {
        orm = await createOrm();
        const em = orm.em.fork();
        const userRepo = em.getRepository(User);
        const jwtService = new JwtService({ secret: TEST_JWT_SECRET, signOptions: { expiresIn: '7d' } });
        authService = new AuthService(userRepo as never, jwtService);
    });

    afterEach(async () => {
        // Clean up created test users
        const emailsToDelete = [...createdEmails];
        createdEmails.length = 0;

        if (emailsToDelete.length > 0) {
            const em = orm.em.fork();
            await em.nativeDelete(User, { email: { $in: emailsToDelete } });
        }

        await orm.close();
    });

    describe('register → login flow', () => {
        it('registers a user, persists it, and issues a JWT', async () => {
            const email = 'integration@example.com';
            createdEmails.push(email);

            const token = await authService.register(email, 'password123');

            expect(token).toBeTruthy();
            expect(typeof token).toBe('string');

            const em = orm.em.fork();
            const user = await em.findOne(User, { email });
            expect(user).not.toBeNull();
            expect(user!.email).toBe(email);
            expect(user!.passwordHash).not.toBe('password123');

            const valid = await bcrypt.compare('password123', user!.passwordHash);
            expect(valid).toBe(true);
        });

        it('can login after registering and returns a JWT', async () => {
            const email = 'login-test@example.com';
            createdEmails.push(email);

            await authService.register(email, 'mypassword');
            const token = await authService.login(email, 'mypassword');

            expect(token).toBeTruthy();
            expect(typeof token).toBe('string');
        });

        it('enforces email uniqueness in the database', async () => {
            const email = 'dup@example.com';
            createdEmails.push(email);

            await authService.register(email, 'password123');

            await expect(authService.register(email, 'anotherpassword')).rejects.toThrow('Email already in use');
        });

        it('rejects login with wrong password', async () => {
            const email = 'pw-test@example.com';
            createdEmails.push(email);

            await authService.register(email, 'correctpassword');

            const { UnauthorizedException } = await import('@nestjs/common');
            await expect(authService.login(email, 'wrongpassword')).rejects.toThrow(UnauthorizedException);
        });
    });
});
