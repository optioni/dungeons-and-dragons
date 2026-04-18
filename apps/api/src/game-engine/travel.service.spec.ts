import {
    describe, expect, it, vi,
} from 'vitest';

vi.mock('@mikro-orm/decorators/legacy', () => ({
    Entity: () => () => {},
    PrimaryKey: () => () => {},
    Property: () => () => {},
    ManyToOne: () => () => {},
    OneToOne: () => () => {},
    OneToMany: () => () => {},
}));
vi.mock('@mikro-orm/core', () => ({ type: {}, OptionalProps: Symbol(), Collection: class {}, Type: class {} }));
vi.mock('@mikro-orm/postgresql', () => ({ BaseEntity: class {}, EntityManager: class {} }));
vi.mock('@nestjs/graphql', () => ({
    ObjectType: () => () => {},
    Field: () => () => {},
    ID: {},
    Int: {},
    Scalar: () => () => {},
    registerEnumType: () => {},
}));
vi.mock('@nestjs/common', () => ({
    Injectable: () => () => {},
}));
vi.mock('@nestjs/event-emitter', () => ({
    EventEmitter2: class EventEmitter2 { emit() {} },
    InjectEventEmitter: () => () => {},
}));

import { TravelService } from './travel.service.js';

function makeEm(entities: {
    discovery?: unknown;
    campaign?: unknown;
    location?: unknown;
    mapLocations?: unknown[];
} = {}) {
    return {
        findOne: vi.fn().mockImplementation((entity: unknown, query: Record<string, unknown>) => {
            const name = String(entity);
            if (name.includes('LocationDiscovery')) return Promise.resolve(entities.discovery ?? null);
            if (name.includes('Campaign')) return Promise.resolve(entities.campaign ?? null);
            if (name.includes('Location')) return Promise.resolve(entities.location ?? null);
            return Promise.resolve(null);
        }),
        find: vi.fn().mockResolvedValue(entities.mapLocations ?? []),
        create: vi.fn().mockImplementation((_e: unknown, data: unknown) => ({ ...data as object, id: 99 })),
        persist: vi.fn(),
        flush: vi.fn(),
    };
}

describe('TravelService', () => {
    describe('travelTo', () => {
        it('updates currentLocationId when location is discovered', async () => {
            const campaign = { id: 10, currentLocationId: 1 };
            const discovery = { id: 5, campaignId: 10, locationId: 2 };
            const em = makeEm({ discovery, campaign });
            const service = new TravelService(em as never, null as never);
            const result = await service.travelTo(10, 2);
            expect(result.success).toBe(true);
            expect(campaign.currentLocationId).toBe(2);
        });

        it('returns UNDISCOVERED_LOCATION when no discovery exists', async () => {
            const campaign = { id: 10, currentLocationId: 1 };
            const em = makeEm({ discovery: null, campaign });
            const service = new TravelService(em as never, null as never);
            const result = await service.travelTo(10, 99);
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('UNDISCOVERED_LOCATION');
        });
    });

    describe('discoverLocation', () => {
        it('creates a LocationDiscovery when not already discovered', async () => {
            const em = makeEm({ discovery: null });
            const service = new TravelService(em as never, null as never);
            const result = await service.discoverLocation(10, 5, 'EXPLORATION', null);
            expect(result.success).toBe(true);
            expect(em.create).toHaveBeenCalled();
            expect(em.persist).toHaveBeenCalled();
        });

        it('is idempotent when location already discovered', async () => {
            const discovery = { id: 1 };
            const em = makeEm({ discovery });
            const service = new TravelService(em as never, null as never);
            const result = await service.discoverLocation(10, 5, 'EXPLORATION', null);
            expect(result.success).toBe(true);
            expect(em.create).not.toHaveBeenCalled();
        });
    });

    describe('StateChangedEvent emissions', () => {
        it('travelTo emits TRAVEL event with locationId as entityId', async () => {
            const emitMock = vi.fn();
            const campaign = { id: 10, currentLocationId: 1 };
            const discovery = { id: 1, campaignId: 10, locationId: 5 };
            const em = makeEm({ campaign, discovery });
            const service = new TravelService(em as never, { emit: emitMock } as never);
            await service.travelTo(10, 5);
            expect(emitMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ type: 'TRAVEL', entityId: '5' }),
            );
        });
    });

    describe('createLocation', () => {
        it('creates a Location and auto-discovers it', async () => {
            const em = makeEm({ discovery: null });
            em.create.mockImplementation((_e: unknown, data: unknown) => ({ ...data as object, id: 42 }));
            const service = new TravelService(em as never, null as never);
            const result = await service.createLocation(10, {
                name: 'Dark Forest',
                description: 'A dense forest',
                currentState: null,
                connectedLocationIds: [],
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as { locationId: number }).locationId).toBeTruthy();
            }
            // Should have created both Location and LocationDiscovery
            expect(em.create).toHaveBeenCalledTimes(2);
        });
    });
});
