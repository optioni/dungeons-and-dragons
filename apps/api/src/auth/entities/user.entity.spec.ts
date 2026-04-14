import { describe, expect, it, vi } from 'vitest';

vi.mock('@mikro-orm/decorators/legacy', () => ({
    Entity: () => () => {},
    PrimaryKey: () => () => {},
    Property: () => () => {},
    Unique: () => () => {},
}));

import { User } from './user.entity';

describe('User entity', () => {
    it('can be instantiated with email, passwordHash, and createdAt', () => {
        const user = new User();
        user.email = 'test@example.com';
        user.passwordHash = '$2a$12$hashedpassword';

        expect(user.email).toBe('test@example.com');
        expect(user.passwordHash).toBe('$2a$12$hashedpassword');
        expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('has a string id property set by default', () => {
        const user = new User();
        expect(typeof user.id).toBe('string');
        expect(user.id.length).toBeGreaterThan(0);
    });
});
