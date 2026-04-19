import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

vi.mock('@mikro-orm/decorators/legacy', () => ({
    Entity: () => () => {},
    PrimaryKey: () => () => {},
    Property: () => () => {},
    ManyToOne: () => () => {},
    OneToMany: () => () => {},
}));
vi.mock('@mikro-orm/core', () => ({ type: {}, OptionalProps: Symbol(), Collection: class {}, Type: class {} }));
vi.mock('@mikro-orm/postgresql', () => ({ BaseEntity: class {}, EntityManager: class {}, EntityRepository: class {} }));
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
    InjectRepository: () => () => {},
}));
vi.mock('@mikro-orm/nestjs', () => ({ InjectRepository: () => () => {} }));

import { QuestService } from './quest.service.js';
import { QuestObjectiveStatus, QuestObjectiveType, QuestStatus } from './quest.enums.js';

function makeEm(overrides: Record<string, unknown> = {}) {
    const transactional = vi.fn().mockImplementation(async (cb: (em: unknown) => unknown) => {
        return cb(makeInnerEm(overrides));
    });

    return {
        findOne: vi.fn().mockResolvedValue(null),
        find: vi.fn().mockResolvedValue([]),
        flush: vi.fn(),
        populate: vi.fn(),
        transactional,
        ...overrides,
    };
}

function makeInnerEm(overrides: Record<string, unknown> = {}) {
    let idCounter = 1;
    return {
        create: vi.fn().mockImplementation((_e: unknown, data: unknown) => ({ ...data as object, id: idCounter++ })),
        persist: vi.fn(),
        flush: vi.fn(),
        findOne: vi.fn().mockResolvedValue(null),
        find: vi.fn().mockResolvedValue([]),
        ...overrides,
    };
}

function makeRepo(items: unknown[] = []) {
    return {
        findOne: vi.fn().mockImplementation((id: unknown) => {
            if (typeof id === 'number') return Promise.resolve(items.find((i) => (i as { id: number }).id === id) ?? null);
            return Promise.resolve(items[0] ?? null);
        }),
        find: vi.fn().mockResolvedValue(items),
        count: vi.fn().mockResolvedValue(0),
        createQueryBuilder: vi.fn(),
        getEntityManager: vi.fn().mockReturnValue(makeEm()),
    };
}

function makeService(opts: {
    quests?: unknown[];
    objectives?: unknown[];
    questEntities?: unknown[];
    campaigns?: unknown[];
    characters?: unknown[];
    characterItems?: unknown[];
    npcs?: unknown[];
    emOverrides?: Record<string, unknown>;
} = {}) {
    const em = makeEm(opts.emOverrides ?? {});
    return new QuestService(
        em as never,
        makeRepo(opts.quests ?? []) as never,
        makeRepo(opts.objectives ?? []) as never,
        makeRepo(opts.questEntities ?? []) as never,
        makeRepo(opts.campaigns ?? []) as never,
        makeRepo(opts.characters ?? []) as never,
        makeRepo(opts.characterItems ?? []) as never,
        makeRepo(opts.npcs ?? []) as never,
    );
}

describe('QuestService.createQuest', () => {
    it('creates quest and returns success', async () => {
        const service = makeService();
        const result = await service.createQuest({
            campaignId: 1,
            title: 'Test Quest',
            description: 'Desc',
            objectives: [{ description: 'Kill the dragon', type: QuestObjectiveType.NPC_DEAD }],
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.quest.title).toBe('Test Quest');
        }
    });

    it('returns failure when transaction throws', async () => {
        const em = makeEm({
            transactional: vi.fn().mockRejectedValue(new Error('DB error')),
        });
        const service = new QuestService(
            em as never,
            makeRepo() as never,
            makeRepo() as never,
            makeRepo() as never,
            makeRepo() as never,
            makeRepo() as never,
            makeRepo() as never,
            makeRepo() as never,
        );
        const result = await service.createQuest({
            campaignId: 1,
            title: 'Bad Quest',
            description: 'Desc',
            objectives: [],
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.reason).toBe('DB error');
        }
    });

    it('resolves entityRef to created entity id in objectives', async () => {
        let idCounter = 1;
        const createdObjectives: unknown[] = [];
        const innerEm = {
            create: vi.fn().mockImplementation((_e: { name?: string }, data: Record<string, unknown>) => {
                const obj = { ...data, id: idCounter++ };
                const name = String(_e);
                if (name.includes('QuestObjective')) createdObjectives.push(obj);
                return obj;
            }),
            persist: vi.fn(),
            flush: vi.fn(),
            findOne: vi.fn().mockResolvedValue(null),
            find: vi.fn().mockResolvedValue([]),
        };
        const em = makeEm({
            transactional: vi.fn().mockImplementation(async (cb: (em: unknown) => unknown) => cb(innerEm)),
        });
        const service = new QuestService(
            em as never,
            makeRepo() as never,
            makeRepo() as never,
            makeRepo() as never,
            makeRepo() as never,
            makeRepo() as never,
            makeRepo() as never,
            makeRepo() as never,
        );

        await service.createQuest({
            campaignId: 1,
            title: 'Quest',
            description: 'Desc',
            objectives: [{ description: 'Kill boss', type: QuestObjectiveType.NPC_DEAD, entityRef: 'boss' }],
            npcs: [{ ref: 'boss', name: 'The Boss' }],
        });

        // The objective should have entityId set to the id of the created NPC
        const objective = createdObjectives[0] as { entityId: number };
        expect(objective).toBeDefined();
        expect(objective.entityId).toBeGreaterThan(0);
    });
});

describe('QuestService.completeQuest', () => {
    it('sets status to COMPLETED and returns quest', async () => {
        const quest = { id: 1, status: QuestStatus.ACTIVE, agendaImpact: null, title: 'Q' };
        const service = makeService({ quests: [quest] });
        const result = await service.completeQuest(1);
        expect(result.success).toBe(true);
        expect(quest.status).toBe(QuestStatus.COMPLETED);
    });

    it('returns QUEST_NOT_FOUND when quest missing', async () => {
        const service = makeService();
        const result = await service.completeQuest(99);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.reason).toBe('QUEST_NOT_FOUND');
        }
    });

    it('calls applyAgendaImpact when agendaImpact is set', async () => {
        const quest = { id: 1, status: QuestStatus.ACTIVE, agendaImpact: 'Update agendas' };
        const npc = { id: 10, agenda: 'Old agenda' };
        const questEntity = { id: 1, questId: 1, entityType: 'NPC', entityId: 10 };
        const service = makeService({
            quests: [quest],
            questEntities: [questEntity],
            npcs: [npc],
        });
        await service.completeQuest(1);
        expect(npc.agenda).toBe('Update agendas');
    });
});

describe('QuestService.failQuest', () => {
    it('sets status to FAILED', async () => {
        const quest = { id: 1, status: QuestStatus.ACTIVE, agendaImpact: null };
        const service = makeService({ quests: [quest] });
        await service.failQuest(1);
        expect(quest.status).toBe(QuestStatus.FAILED);
    });

    it('returns QUEST_NOT_FOUND when quest missing', async () => {
        const service = makeService();
        const result = await service.failQuest(99);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.reason).toBe('QUEST_NOT_FOUND');
        }
    });
});

describe('QuestService.runAutoChecker', () => {
    it('returns questCompleted: null when no active quests', async () => {
        const questRepo = makeRepo([]);
        const em = makeEm();
        const service = new QuestService(
            em as never,
            questRepo as never,
            makeRepo() as never,
            makeRepo() as never,
            makeRepo() as never,
            makeRepo() as never,
            makeRepo() as never,
            makeRepo() as never,
        );
        const result = await service.runAutoChecker(1);
        expect(result.questCompleted).toBeNull();
    });

    it('marks NPC_DEAD objective complete when NPC is dead', async () => {
        const quest = { id: 1, status: QuestStatus.ACTIVE, title: 'Kill quest', campaignId: 1 };
        const objective = { id: 1, questId: 1, type: QuestObjectiveType.NPC_DEAD, status: QuestObjectiveStatus.INCOMPLETE, entityId: 5 };
        const npc = { id: 5, alive: false };
        const campaign = { id: 1, currentLocationId: null };

        const questRepo = { find: vi.fn().mockResolvedValue([quest]), count: vi.fn().mockResolvedValue(0), findOne: vi.fn() };
        const objectiveRepo = {
            find: vi.fn().mockResolvedValue([objective]),
            count: vi.fn().mockResolvedValue(0),
        };
        const campaignRepo = { findOne: vi.fn().mockResolvedValue(campaign) };
        const characterRepo = { findOne: vi.fn().mockResolvedValue(null) };
        const npcRepo = { findOne: vi.fn().mockResolvedValue(npc) };

        const em = makeEm({ flush: vi.fn() });
        const service = new QuestService(
            em as never,
            questRepo as never,
            objectiveRepo as never,
            makeRepo() as never,
            campaignRepo as never,
            characterRepo as never,
            makeRepo() as never,
            npcRepo as never,
        );

        const result = await service.runAutoChecker(1);
        expect(objective.status).toBe(QuestObjectiveStatus.COMPLETE);
        expect(result.questCompleted).not.toBeNull();
        expect(result.questCompleted?.questId).toBe(1);
    });

    it('does not auto-check MANUAL objectives', async () => {
        const quest = { id: 1, status: QuestStatus.ACTIVE, title: 'Manual quest', campaignId: 1 };
        const objective = { id: 1, questId: 1, type: QuestObjectiveType.MANUAL, status: QuestObjectiveStatus.INCOMPLETE, entityId: null };
        const campaign = { id: 1, currentLocationId: null };

        const questRepo = { find: vi.fn().mockResolvedValue([quest]), count: vi.fn(), findOne: vi.fn() };
        const objectiveRepo = {
            find: vi.fn().mockResolvedValue([objective]),
            count: vi.fn().mockResolvedValue(1),
        };
        const campaignRepo = { findOne: vi.fn().mockResolvedValue(campaign) };
        const characterRepo = { findOne: vi.fn().mockResolvedValue(null) };

        const em = makeEm();
        const service = new QuestService(
            em as never,
            questRepo as never,
            objectiveRepo as never,
            makeRepo() as never,
            campaignRepo as never,
            characterRepo as never,
            makeRepo() as never,
            makeRepo() as never,
        );

        const result = await service.runAutoChecker(1);
        expect(objective.status).toBe(QuestObjectiveStatus.INCOMPLETE);
        expect(result.questCompleted).toBeNull();
    });

    it('does not return questCompleted when some objectives remain incomplete', async () => {
        const quest = { id: 1, status: QuestStatus.ACTIVE, title: 'Q', campaignId: 1 };
        const deadObjective = { id: 1, questId: 1, type: QuestObjectiveType.NPC_DEAD, status: QuestObjectiveStatus.INCOMPLETE, entityId: 5 };
        const manualObjective = { id: 2, questId: 1, type: QuestObjectiveType.MANUAL, status: QuestObjectiveStatus.INCOMPLETE, entityId: null };
        const npc = { id: 5, alive: false };
        const campaign = { id: 1, currentLocationId: null };

        const questRepo = { find: vi.fn().mockResolvedValue([quest]), count: vi.fn(), findOne: vi.fn() };
        const objectiveRepo = {
            find: vi.fn().mockResolvedValue([deadObjective, manualObjective]),
            count: vi.fn().mockResolvedValue(1), // still 1 INCOMPLETE (MANUAL one)
        };
        const campaignRepo = { findOne: vi.fn().mockResolvedValue(campaign) };
        const characterRepo = { findOne: vi.fn().mockResolvedValue(null) };
        const npcRepo = { findOne: vi.fn().mockResolvedValue(npc) };

        const em = makeEm({ flush: vi.fn() });
        const service = new QuestService(
            em as never,
            questRepo as never,
            objectiveRepo as never,
            makeRepo() as never,
            campaignRepo as never,
            characterRepo as never,
            makeRepo() as never,
            npcRepo as never,
        );

        const result = await service.runAutoChecker(1);
        expect(result.questCompleted).toBeNull();
    });

    it('marks REACH_LOCATION complete when campaign currentLocationId matches', async () => {
        const quest = { id: 1, status: QuestStatus.ACTIVE, title: 'Travel Q', campaignId: 1 };
        const objective = { id: 1, questId: 1, type: QuestObjectiveType.REACH_LOCATION, status: QuestObjectiveStatus.INCOMPLETE, entityId: 42 };
        const campaign = { id: 1, currentLocationId: 42 };

        const questRepo = { find: vi.fn().mockResolvedValue([quest]), count: vi.fn().mockResolvedValue(0), findOne: vi.fn() };
        const objectiveRepo = {
            find: vi.fn().mockResolvedValue([objective]),
            count: vi.fn().mockResolvedValue(0),
        };
        const campaignRepo = { findOne: vi.fn().mockResolvedValue(campaign) };
        const characterRepo = { findOne: vi.fn().mockResolvedValue({ id: 7, campaign: { id: 1 } }) };

        const em = makeEm({ flush: vi.fn() });
        const service = new QuestService(
            em as never,
            questRepo as never,
            objectiveRepo as never,
            makeRepo() as never,
            campaignRepo as never,
            characterRepo as never,
            makeRepo() as never,
            makeRepo() as never,
        );

        const result = await service.runAutoChecker(1);
        expect(objective.status).toBe(QuestObjectiveStatus.COMPLETE);
        expect(result.questCompleted).not.toBeNull();
    });
});
