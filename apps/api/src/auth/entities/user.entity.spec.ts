import { describe, expect, it, vi } from 'vitest';

import { User } from './user.entity';

/* eslint-disable @typescript-eslint/naming-convention */
vi.mock('@mikro-orm/decorators/legacy', () => ({
    Entity: () => () => {},
    PrimaryKey: () => () => {},
    Property: () => () => {},
    Unique: () => () => {},
}));

describe('User entity', () => {
    it('can be instantiated with email, passwordHash, and createdAt', () => {
        const user = new User();
        user.email = 'test@example.com';
        user.passwordHash = '$2a$12$hashedpassword';

        expect(user.email).toBe('test@example.com');
        expect(user.passwordHash).toBe('$2a$12$hashedpassword');
        expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('has a numeric id property', () => {
        const user = new User();
        user.id = 1;
        expect(typeof user.id).toBe('number');
    });
});
/* eslint-enable @typescript-eslint/naming-convention */
