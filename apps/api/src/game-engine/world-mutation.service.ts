import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { type AntagonistPlanState } from '../campaign/campaign.enums.js';
import { Campaign } from '../campaign/entities/campaign.entity.js';
import { GameSession } from '../session/entities/game-session.entity.js';
import { Faction } from '../world/entities/faction.entity.js';
import { Location } from '../world/entities/location.entity.js';
import { Npc } from '../world/entities/npc.entity.js';
import { WorldEvent } from '../world/entities/world-event.entity.js';
import { NpcPartyStatus, WorldEventSource, WorldEventStatus } from '../world/world.enums.js';
import { STATE_CHANGED_EVENT, StateChangedEvent } from './events/state-changed.event.js';

export interface WorldResult { success: true; data: Record<string, unknown> }
export interface WorldError { success: false; errorCode: string; message: string }
type WorldOutcome = WorldResult | WorldError;

/**
 * Handles all world-mutation LLM tool logic: NPCs, factions, world events,
 * scene type, antagonist stages, and lore.
 */
@Injectable()
export class WorldMutationService {
    constructor(
        private readonly em: EntityManager,
        private readonly events: EventEmitter2,
    ) {}

    /** Persists a new Npc row and emits NPC_CREATED. */
    async createNpc(campaignId: number, dto: {
        name: string
        description?: string | null
        profession?: string | null
        disposition?: string | null
        personalityTraits?: string[]
        speechStyle?: string | null
        coreMotivation?: string | null
        agenda?: string | null
        currentLocationId?: number | null
    }): Promise<WorldOutcome> {
        const npc = this.em.create(Npc, {
            campaignId,
            name: dto.name,
            description: dto.description ?? null,
            profession: dto.profession ?? null,
            disposition: dto.disposition ?? null,
            personalityTraits: dto.personalityTraits ?? [],
            speechStyle: dto.speechStyle ?? null,
            coreMotivation: dto.coreMotivation ?? null,
            agenda: dto.agenda ?? null,
            currentLocationId: dto.currentLocationId ?? null,
        });
        this.em.persist(npc);
        await this.em.flush();

        const npcId = (npc as unknown as { id: number }).id;
        this.events?.emit(STATE_CHANGED_EVENT, new StateChangedEvent('NPC_CREATED', String(npcId), campaignId));

        return { success: true, data: { npcId } };
    }

    /** Partially updates an NPC. Emits NPC_UPDATE or NPC_KILLED event. */
    async updateNpc(npcId: number, updates: Partial<{
        alive: boolean
        disposition: string
        currentLocationId: number | null
        agenda: string | null
        nextTickInGameDay: number | null
    }>): Promise<WorldOutcome> {
        const npc = await this.em.findOne(Npc, { id: npcId });
        if (!npc) {
            return { success: false, errorCode: 'NPC_NOT_FOUND', message: `NPC ${npcId} not found` };
        }

        Object.assign(npc, updates);
        await this.em.flush();

        const eventType = updates.alive === false ? 'NPC_KILLED' : 'NPC_UPDATE';
        this.events?.emit(STATE_CHANGED_EVENT, new StateChangedEvent(eventType, String(npcId), npc.campaignId));

        return { success: true, data: { npcId } };
    }

    /** Sets NPC partyStatus = COMPANION and clears their world tick. */
    async addToParty(npcId: number, campaignId: number): Promise<WorldOutcome> {
        void campaignId;
        const npc = await this.em.findOne(Npc, { id: npcId });
        if (!npc) {
            return { success: false, errorCode: 'NPC_NOT_FOUND', message: `NPC ${npcId} not found` };
        }

        npc.partyStatus = NpcPartyStatus.COMPANION;
        npc.nextTickInGameDay = null;
        await this.em.flush();

        return { success: true, data: { npcId, partyStatus: 'COMPANION' } };
    }

    /** Sets NPC partyStatus = NONE. */
    async removeFromParty(npcId: number): Promise<WorldOutcome> {
        const npc = await this.em.findOne(Npc, { id: npcId });
        if (!npc) {
            return { success: false, errorCode: 'NPC_NOT_FOUND', message: `NPC ${npcId} not found` };
        }

        npc.partyStatus = NpcPartyStatus.NONE;
        await this.em.flush();

        return { success: true, data: { npcId, partyStatus: 'NONE' } };
    }

    /** Updates Location.currentState. */
    async updateLocationState(locationId: number, state: string): Promise<WorldOutcome> {
        const location = await this.em.findOne(Location, { id: locationId });
        if (!location) {
            return { success: false, errorCode: 'LOCATION_NOT_FOUND', message: `Location ${locationId} not found` };
        }

        location.currentState = state;
        await this.em.flush();

        return { success: true, data: { locationId, currentState: state } };
    }

    /** Updates Faction.playerDisposition. */
    async shiftFactionDisposition(factionId: number, disposition: string): Promise<WorldOutcome> {
        const faction = await this.em.findOne(Faction, { id: factionId });
        if (!faction) {
            return { success: false, errorCode: 'FACTION_NOT_FOUND', message: `Faction ${factionId} not found` };
        }

        faction.playerDisposition = disposition;
        await this.em.flush();

        return { success: true, data: { factionId, playerDisposition: disposition } };
    }

    /** Persists a WorldEvent with status ACTIVE. */
    async triggerWorldEvent(
        campaignId: number,
        description: string,
        locationId: number | null,
        deadlineInGameDate: string | null,
        source: string,
    ): Promise<WorldOutcome> {
        const event = this.em.create(WorldEvent, {
            campaignId,
            description,
            locationId,
            deadlineInGameDate,
            source: (source as WorldEventSource) ?? WorldEventSource.PLAYER_ACTION,
            status: WorldEventStatus.ACTIVE,
        });
        this.em.persist(event);
        await this.em.flush();

        return { success: true, data: { worldEventId: (event as unknown as { id: number }).id } };
    }

    /** Sets WorldEvent.status = RESOLVED and stores outcome. */
    async resolveWorldEvent(worldEventId: number, outcome: string): Promise<WorldOutcome> {
        const event = await this.em.findOne(WorldEvent, { id: worldEventId });
        if (!event) {
            return { success: false, errorCode: 'EVENT_NOT_FOUND', message: `WorldEvent ${worldEventId} not found` };
        }

        event.status = WorldEventStatus.RESOLVED;
        event.outcome = outcome;
        await this.em.flush();

        return { success: true, data: { worldEventId, status: 'RESOLVED' } };
    }

    /** Creates a catastrophe WorldEvent. */
    async triggerCatastrophe(
        campaignId: number,
        description: string,
        locationId: number | null,
    ): Promise<WorldOutcome> {
        const event = this.em.create(WorldEvent, {
            campaignId,
            description,
            locationId,
            source: WorldEventSource.CATASTROPHE,
            status: WorldEventStatus.ACTIVE,
        });
        this.em.persist(event);
        await this.em.flush();

        return { success: true, data: { worldEventId: (event as unknown as { id: number }).id } };
    }

    /** Updates GameSession.sceneType (also handled by SetSceneTypeHandler in LlmModule). */
    async setSceneType(sessionId: number, sceneType: string): Promise<WorldOutcome> {
        const session = await this.em.findOne(GameSession, { id: sessionId });
        if (!session) {
            return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
        }

        session.sceneType = sceneType as never;
        await this.em.flush();

        return { success: true, data: { sceneType } };
    }

    /** Advances antagonist plan to the next stage. */
    async advanceAntagonistStage(campaignId: number): Promise<WorldOutcome> {
        const campaign = await this.em.findOne(Campaign, { id: campaignId });
        if (!campaign) {
            return { success: false, errorCode: 'CAMPAIGN_NOT_FOUND', message: `Campaign ${campaignId} not found` };
        }

        const plan = campaign.antagonistPlanState as AntagonistPlanState | null;
        if (!plan) {
            return { success: false, errorCode: 'NO_ANTAGONIST_PLAN', message: 'No antagonist plan state' };
        }

        const currentIndex = plan.stages.findIndex((stage) => !stage.completed);
        if (currentIndex === -1) {
            return { success: true, data: { finalStage: true } };
        }

        plan.stages[currentIndex]!.completed = true;

        const isLast = currentIndex === plan.stages.length - 1;
        if (isLast) {
            campaign.antagonistPlanState = { ...plan };
            await this.em.flush();
            return { success: true, data: { finalStage: true } };
        }

        plan.currentStage = plan.stages[currentIndex + 1]!.name;
        campaign.antagonistPlanState = { ...plan };
        await this.em.flush();

        return { success: true, data: { currentStage: plan.currentStage } };
    }

    /** Appends a lore fact to Campaign.loreDocument. */
    async recordLore(campaignId: number, fact: string): Promise<WorldOutcome> {
        const campaign = await this.em.findOne(Campaign, { id: campaignId });
        if (!campaign) {
            return { success: false, errorCode: 'CAMPAIGN_NOT_FOUND', message: `Campaign ${campaignId} not found` };
        }

        campaign.loreDocument = campaign.loreDocument ? `${campaign.loreDocument}\n${fact}` : fact;
        await this.em.flush();

        return { success: true, data: { loreDocument: campaign.loreDocument } };
    }
}
