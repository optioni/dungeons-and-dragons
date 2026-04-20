import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { ItemType } from '../character/character.enums.js';
import { CharacterItem } from '../character/entities/character-item.entity.js';
import { Character } from '../character/entities/character.entity.js';
import { Item } from '../character/entities/item.entity.js';
import { Location } from '../world/entities/location.entity.js';
import { Npc } from '../world/entities/npc.entity.js';
import { WorldEvent } from '../world/entities/world-event.entity.js';
import { WorldEventSource, WorldEventStatus } from '../world/world.enums.js';
import { QuestEntity } from './entities/quest-entity.entity.js';
import { QuestObjective } from './entities/quest-objective.entity.js';
import { Quest } from './entities/quest.entity.js';
import { QuestEntityType, QuestObjectiveStatus, QuestObjectiveType, QuestStatus } from './quest.enums.js';

export interface QuestResult { success: true; quest: Quest }
export interface QuestObjectiveResult { success: true; objective: QuestObjective }
export interface QuestError { success: false; reason: string }
export interface AutoCheckerResult { questCompleted: { questId: number; questTitle: string } | null }

export interface NpcSpec {
    ref: string
    name: string
    description?: string | null
    profession?: string | null
    disposition?: string | null
    agenda?: string | null
    currentLocationId?: number | null
}

export interface LocationSpec {
    ref: string
    name: string
    description: string
    currentState?: string | null
    connectedLocationIds?: number[]
}

export interface ItemSpec {
    ref: string
    name: string
    description: string
    itemType?: string | null
    weight?: number | null
    value?: number | null
}

export interface WorldEventSpec {
    ref: string
    description: string
    locationId?: number | null
    deadlineInGameDate?: string | null
}

export interface ObjectiveSpec {
    description: string
    type: QuestObjectiveType
    entityRef?: string | null
    entityId?: number | null
    order?: number
}

export interface CreateQuestDto {
    campaignId: number
    title: string
    description: string
    agendaImpact?: string | null
    rewardNarrative?: string | null
    rewardXp?: number | null
    rewardGold?: number | null
    objectives: ObjectiveSpec[]
    npcs?: NpcSpec[]
    locations?: LocationSpec[]
    items?: ItemSpec[]
    worldEvents?: WorldEventSpec[]
}

/**
 * Owns quest lifecycle: atomic creation with world entity scaffolding, completion,
 * failure, objective updates, and the auto-checker that fires after state changes.
 */
@Injectable()
export class QuestService {
    constructor(
        private readonly em: EntityManager,
        @InjectRepository(Quest)
        private readonly questRepo: EntityRepository<Quest>,
        @InjectRepository(QuestObjective)
        private readonly objectiveRepo: EntityRepository<QuestObjective>,
        @InjectRepository(QuestEntity)
        private readonly questEntityRepo: EntityRepository<QuestEntity>,
        @InjectRepository(Campaign)
        private readonly campaignRepo: EntityRepository<Campaign>,
        @InjectRepository(Character)
        private readonly characterRepo: EntityRepository<Character>,
        @InjectRepository(CharacterItem)
        private readonly characterItemRepo: EntityRepository<CharacterItem>,
        @InjectRepository(Npc)
        private readonly npcRepo: EntityRepository<Npc>,
    ) {}

    /**
     * Atomically creates a quest plus all scaffolded world entities.
     * On any error the transaction rolls back and no rows are persisted.
     */
    async createQuest(dto: CreateQuestDto): Promise<QuestResult | QuestError> {
        try {
            const quest = await this.em.transactional(async (em) => {
                const refMap = new Map<string, number>();
                const pendingLinks: Array<{ entityType: QuestEntityType; entityId: number }> = [];

                await this.scaffoldQuestEntities(em, dto, refMap, pendingLinks);

                const newQuest = em.create(Quest, {
                    campaignId: dto.campaignId,
                    title: dto.title,
                    description: dto.description,
                    agendaImpact: dto.agendaImpact ?? null,
                    rewardNarrative: dto.rewardNarrative ?? null,
                    rewardXp: dto.rewardXp ?? null,
                    rewardGold: dto.rewardGold ?? null,
                });
                em.persist(newQuest);
                await em.flush();

                const questId = (newQuest as unknown as { id: number }).id;

                for (const link of pendingLinks) {
                    const qe = em.create(QuestEntity, {
                        quest: newQuest, questId, entityType: link.entityType, entityId: link.entityId,
                    });
                    em.persist(qe);
                }

                for (const [index, spec] of dto.objectives.entries()) {
                    let resolvedEntityId = spec.entityId ?? null;
                    if (spec.entityRef && refMap.has(spec.entityRef)) {
                        resolvedEntityId = refMap.get(spec.entityRef) ?? null;
                    }

                    const objective = em.create(QuestObjective, {
                        quest: newQuest,
                        questId,
                        description: spec.description,
                        type: spec.type,
                        entityId: resolvedEntityId,
                        order: spec.order ?? index,
                    });
                    em.persist(objective);
                }

                await em.flush();
                return newQuest;
            });

            await this.em.populate(quest as Quest, ['objectives', 'entities']);
            return { success: true, quest: quest as Quest };
        } catch (error) {
            return { success: false, reason: error instanceof Error ? error.message : String(error) };
        }
    }

    /** Creates NPC, Location, Item, and WorldEvent rows for a quest transaction, populating refMap and pendingLinks. */
    private async scaffoldQuestEntities(
        em: EntityManager,
        dto: CreateQuestDto,
        refMap: Map<string, number>,
        pendingLinks: Array<{ entityType: QuestEntityType; entityId: number }>,
    ): Promise<void> {
        for (const spec of dto.npcs ?? []) {
            const npc = em.create(Npc, {
                campaignId: dto.campaignId,
                name: spec.name,
                description: spec.description ?? null,
                profession: spec.profession ?? null,
                disposition: spec.disposition ?? null,
                agenda: spec.agenda ?? null,
                currentLocationId: spec.currentLocationId ?? null,
            });
            em.persist(npc);
            await em.flush();
            const npcId = (npc as unknown as { id: number }).id;
            refMap.set(spec.ref, npcId);
            pendingLinks.push({ entityType: QuestEntityType.NPC, entityId: npcId });
        }

        for (const spec of dto.locations ?? []) {
            const location = em.create(Location, {
                campaignId: dto.campaignId,
                name: spec.name,
                description: spec.description,
                currentState: spec.currentState ?? null,
                connectedLocationIds: spec.connectedLocationIds ?? [],
            });
            em.persist(location);
            await em.flush();
            const locationId = (location as unknown as { id: number }).id;
            refMap.set(spec.ref, locationId);
            pendingLinks.push({ entityType: QuestEntityType.LOCATION, entityId: locationId });
        }

        for (const spec of dto.items ?? []) {
            const item = em.create(Item, {
                name: spec.name,
                description: spec.description,
                itemType: (spec.itemType as ItemType) ?? ItemType.OTHER,
                weight: spec.weight ?? null,
                value: spec.value ?? null,
            });
            em.persist(item);
            await em.flush();
            const itemId = (item as unknown as { id: number }).id;
            refMap.set(spec.ref, itemId);
            pendingLinks.push({ entityType: QuestEntityType.ITEM, entityId: itemId });
        }

        for (const spec of dto.worldEvents ?? []) {
            const event = em.create(WorldEvent, {
                campaignId: dto.campaignId,
                description: spec.description,
                locationId: spec.locationId ?? null,
                deadlineInGameDate: spec.deadlineInGameDate ?? null,
                source: WorldEventSource.PLAYER_ACTION,
                status: WorldEventStatus.ACTIVE,
            });
            em.persist(event);
            await em.flush();
            const eventId = (event as unknown as { id: number }).id;
            refMap.set(spec.ref, eventId);
            pendingLinks.push({ entityType: QuestEntityType.WORLD_EVENT, entityId: eventId });
        }
    }

    /** Sets quest status to COMPLETED and applies agenda impact if present. */
    async completeQuest(questId: number): Promise<QuestResult | QuestError> {
        const quest = await this.questRepo.findOne(questId);
        if (!quest) {
            return { success: false, reason: 'QUEST_NOT_FOUND' };
        }

        quest.status = QuestStatus.COMPLETED;
        await this.em.flush();

        if (quest.agendaImpact) {
            await this.applyAgendaImpact(questId, quest.agendaImpact);
        }

        return { success: true, quest };
    }

    /** Sets quest status to FAILED and applies agenda impact if present. */
    async failQuest(questId: number): Promise<QuestResult | QuestError> {
        const quest = await this.questRepo.findOne(questId);
        if (!quest) {
            return { success: false, reason: 'QUEST_NOT_FOUND' };
        }

        quest.status = QuestStatus.FAILED;
        await this.em.flush();

        if (quest.agendaImpact) {
            await this.applyAgendaImpact(questId, quest.agendaImpact);
        }

        return { success: true, quest };
    }

    /**
     * Updates each linked NPC's agenda with the agendaImpact string.
     * Reuses the NPC entity directly — same as the update_npc path.
     */
    async applyAgendaImpact(questId: number, agendaImpact: string): Promise<void> {
        const linkedNpcs = await this.questEntityRepo.find({ questId, entityType: QuestEntityType.NPC });
        for (const link of linkedNpcs) {
            const npc = await this.npcRepo.findOne(link.entityId);
            if (npc) {
                npc.agenda = agendaImpact;
            }
        }

        await this.em.flush();
    }

    /** Updates a single quest objective's status. */
    async updateQuestObjective(
        objectiveId: number, status: QuestObjectiveStatus,
    ): Promise<QuestObjectiveResult | QuestError> {
        const objective = await this.objectiveRepo.findOne(objectiveId);
        if (!objective) {
            return { success: false, reason: 'OBJECTIVE_NOT_FOUND' };
        }

        objective.status = status;
        await this.em.flush();

        return { success: true, objective };
    }

    /**
     * Evaluates all INCOMPLETE objectives for ACTIVE quests in a campaign.
     * Returns questCompleted when all objectives of a quest become complete.
     * TALK_TO_NPC and MANUAL objectives are never auto-evaluated.
     */
    async runAutoChecker(campaignId: number): Promise<AutoCheckerResult> {
        const activeQuests = await this.questRepo.find({ campaignId, status: QuestStatus.ACTIVE });
        if (activeQuests.length === 0) {
            return { questCompleted: null };
        }

        const questIds = activeQuests.map((activeQuest) => (activeQuest as unknown as { id: number }).id);
        const incompleteObjectives = await this.objectiveRepo.find({
            questId: { $in: questIds },
            status: QuestObjectiveStatus.INCOMPLETE,
        });

        if (incompleteObjectives.length === 0) {
            return { questCompleted: null };
        }

        const campaign = await this.campaignRepo.findOne(campaignId);
        const character = await this.characterRepo.findOne({ campaign: { id: campaignId } } as never);

        const affectedQuestIds = new Set<number>();

        for (const objective of incompleteObjectives) {
            const met = await this.evaluateObjective(objective, campaign, character);
            if (met) {
                objective.status = QuestObjectiveStatus.COMPLETE;
                affectedQuestIds.add(objective.questId);
            }
        }

        if (affectedQuestIds.size > 0) {
            await this.em.flush();
        }

        for (const quest of activeQuests) {
            const questId = (quest as unknown as { id: number }).id;
            if (!affectedQuestIds.has(questId)) {
                continue;
            }

            const remainingIncomplete = await this.objectiveRepo.count({
                questId,
                status: QuestObjectiveStatus.INCOMPLETE,
            });

            if (remainingIncomplete === 0) {
                return { questCompleted: { questId, questTitle: quest.title } };
            }
        }

        return { questCompleted: null };
    }

    private async evaluateObjective(
        objective: QuestObjective,
        campaign: Campaign | null,
        character: Character | null,
    ): Promise<boolean> {
        switch (objective.type) {
            case QuestObjectiveType.REACH_LOCATION: {
                if (!campaign || objective.entityId === null) {
                    return false;
                }

                return campaign.currentLocationId === objective.entityId;
            }

            case QuestObjectiveType.NPC_DEAD: {
                if (objective.entityId === null) {
                    return false;
                }

                const npc = await this.npcRepo.findOne(objective.entityId);
                return npc !== null && npc.alive === false;
            }

            case QuestObjectiveType.NPC_ALIVE: {
                if (objective.entityId === null) {
                    return false;
                }

                const npc = await this.npcRepo.findOne(objective.entityId);
                return npc !== null && npc.alive === true;
            }

            case QuestObjectiveType.HAVE_ITEM: {
                if (!character || objective.entityId === null) {
                    return false;
                }

                const charId = (character as unknown as { id: number }).id;
                const charItem = await this.characterItemRepo.findOne({
                    character: charId,
                    item: objective.entityId,
                } as never);
                return charItem !== null;
            }

            case QuestObjectiveType.TALK_TO_NPC:
            case QuestObjectiveType.MANUAL:
                return false;
            default:
                return false;
        }
    }
}
