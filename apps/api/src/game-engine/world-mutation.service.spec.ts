import {
    describe, expect, it, vi,
} from 'vitest';

import { WorldMutationService } from './world-mutation.service.js';

/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, symbol-description */
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
    Float: {},
    Scalar: () => () => {},
    registerEnumType: () => {},
}));
vi.mock('@nestjs/common', () => ({
    Injectable: () => () => {},
}));
vi.mock('@nestjs/event-emitter', () => ({
    EventEmitter2: class EventEmitter2 {
        emit() {}
    },
    InjectEventEmitter: () => () => {},
}));
/* eslint-enable @typescript-eslint/naming-convention, @typescript-eslint/no-extraneous-class, symbol-description */

function makeNpc(overrides: Record<string, unknown> = {}) {
    return {
        id: 1, alive: true, disposition: 'neutral', partyStatus: 'NONE', nextTickInGameDate: '3', ...overrides,
    };
}

function makeWorldEvent(overrides: Record<string, unknown> = {}) {
    return { id: 5, status: 'ACTIVE', outcome: null, ...overrides };
}

function makeCampaign(overrides: Record<string, unknown> = {}) {
    return {
        id: 10,
        loreDocument: null,
        antagonistPlanState: {
            currentStage: 'Phase 1',
            stages: [
                { name: 'Phase 1', description: 'First stage', completed: false },
                { name: 'Phase 2', description: 'Second stage', completed: false },
            ],
        },
        ...overrides,
    };
}

function makeEm(entities: {
    npc?: unknown
    worldEvent?: unknown
    campaign?: unknown
    location?: unknown
    faction?: unknown
    session?: unknown
} = {}) {
    return {
        findOne: vi.fn().mockImplementation((entity: { name?: string }) => {
            const entityName = entity?.name ?? '';
            if (entityName === 'Npc') {
                return Promise.resolve(entities.npc ?? null);
            }

            if (entityName === 'WorldEvent') {
                return Promise.resolve(entities.worldEvent ?? null);
            }

            if (entityName === 'Campaign') {
                return Promise.resolve(entities.campaign ?? null);
            }

            if (entityName === 'Location') {
                return Promise.resolve(entities.location ?? null);
            }

            if (entityName === 'Faction') {
                return Promise.resolve(entities.faction ?? null);
            }

            if (entityName === 'GameSession') {
                return Promise.resolve(entities.session ?? null);
            }

            return Promise.resolve(null);
        }),
        create: vi.fn().mockImplementation((_error: unknown, data: unknown) => ({ ...data as object, id: 99 })),
        persist: vi.fn(),
        flush: vi.fn(),
    };
}

describe('WorldMutationService', () => {
    describe('updateNpc', () => {
        it('applies partial updates to NPC fields', async () => {
            const npc = makeNpc();
            const em = makeEm({ npc });
            const service = new WorldMutationService(em as never, null as never);
            await service.updateNpc(1, { disposition: 'HOSTILE' });
            expect(npc.disposition).toBe('HOSTILE');
        });

        it('emits NPC_KILLED event when alive is set to false', async () => {
            const npc = makeNpc();
            const emitMock = vi.fn();
            const em = makeEm({ npc });
            const service = new WorldMutationService(em as never, { emit: emitMock } as never);
            await service.updateNpc(1, { alive: false });
            expect(npc.alive).toBe(false);
            expect(emitMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ type: 'NPC_KILLED' }),
            );
        });
    });

    describe('addToParty / removeFromParty', () => {
        it('sets partyStatus=COMPANION and clears nextTickInGameDate', async () => {
            const npc = makeNpc({ nextTickInGameDate: 'Day 5' });
            const em = makeEm({ npc });
            const service = new WorldMutationService(em as never, null as never);
            await service.addToParty(1, 10);
            expect(npc.partyStatus).toBe('COMPANION');
            expect(npc.nextTickInGameDate).toBeNull();
        });

        it('sets partyStatus=NONE on remove', async () => {
            const npc = makeNpc({ partyStatus: 'COMPANION' });
            const em = makeEm({ npc });
            const service = new WorldMutationService(em as never, null as never);
            await service.removeFromParty(1);
            expect(npc.partyStatus).toBe('NONE');
        });
    });

    describe('triggerWorldEvent / resolveWorldEvent', () => {
        it('creates a WorldEvent with status ACTIVE', async () => {
            const em = makeEm();
            const service = new WorldMutationService(em as never, null as never);
            const result = await service.triggerWorldEvent(10, 'Orc raid', null, null, 'PLAYER_ACTION');
            expect(result.success).toBe(true);
            expect(em.create).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ status: 'ACTIVE', source: 'PLAYER_ACTION' }),
            );
        });

        it('resolves a WorldEvent and stores outcome', async () => {
            const event = makeWorldEvent();
            const em = makeEm({ worldEvent: event });
            const service = new WorldMutationService(em as never, null as never);
            await service.resolveWorldEvent(5, 'Orcs defeated');
            expect(event.status).toBe('RESOLVED');
            expect(event.outcome).toBe('Orcs defeated');
        });
    });

    describe('recordLore', () => {
        it('appends a fact to the campaign lore document', async () => {
            const campaign = makeCampaign({ loreDocument: 'Old lore.' });
            const em = makeEm({ campaign });
            const service = new WorldMutationService(em as never, null as never);
            await service.recordLore(10, 'New fact!');
            expect(campaign.loreDocument as unknown as string).toContain('New fact!');
        });

        it('initializes loreDocument when null', async () => {
            const campaign = makeCampaign({ loreDocument: null });
            const em = makeEm({ campaign });
            const service = new WorldMutationService(em as never, null as never);
            await service.recordLore(10, 'First fact');
            expect(campaign.loreDocument).toBe('First fact');
        });
    });

    describe('advanceAntagonistStage', () => {
        it('marks current stage completed and advances next', async () => {
            const campaign = makeCampaign();
            const em = makeEm({ campaign });
            const service = new WorldMutationService(em as never, null as never);
            const result = await service.advanceAntagonistStage(10);
            expect(result.success).toBe(true);
            interface PlanState { stages: Array<{ completed: boolean }> }
            expect((campaign.antagonistPlanState as PlanState).stages[0]!.completed).toBe(true);
        });
    });
});
