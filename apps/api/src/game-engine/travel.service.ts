import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { Character } from '../character/entities/character.entity.js';
import { LocationDiscovery } from '../world/entities/location-discovery.entity.js';
import { Location } from '../world/entities/location.entity.js';
import { Npc } from '../world/entities/npc.entity.js';
import { LocationDiscoverySource } from '../world/world.enums.js';
import { CombatService } from './combat.service.js';
import { DiceService } from './dice.service.js';
import { STATE_CHANGED_EVENT, StateChangedEvent } from './events/state-changed.event.js';

export interface EncounterResult {
    triggered: true
    monsters: string[]
    description?: string
    reason?: string
}

export interface TravelResultData {
    locationId?: number
    encounter?: EncounterResult | null
    [key: string]: unknown
}

export interface TravelResult { success: true; data: TravelResultData }
export interface TravelError { success: false; errorCode: string; message: string }
type TravelOutcome = TravelResult | TravelError;

/** Maps LocationState string values to danger roll modifiers. */
/* eslint-disable @typescript-eslint/naming-convention */
const DANGER_MODIFIERS: Record<string, number> = {
    SAFE: 0,
    TENSE: 2,
    THREATENED: 4,
    HOSTILE: 6,
    RUINED: 3,
};

interface MonsterRow { id: number; name: string; hit_points: number; challenge_rating: number }
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Handles travel_to, discover_location, create_location, and update_campaign_settings tool logic.
 */
@Injectable()
export class TravelService {
    constructor(
        private readonly em: EntityManager,
        private readonly events: EventEmitter2,
        private readonly dice?: DiceService,
        private readonly combat?: CombatService,
    ) {}

    /** Returns the danger roll modifier for the given location state string. */
    dangerModifier(state: string | null): number {
        if (!state) {
            return 0;
        }

        return DANGER_MODIFIERS[state] ?? 0;
    }

    /**
     * Queries SrdMonster for 1–3 random entries within the CR bracket
     * [floor(level/2)-1, floor(level/2)+1] clamped to [0, 30].
     */
    async drawEncounterMonsters(
        characterLevel: number,
    ): Promise<Array<{ id: number; name: string; hitPoints: number; challengeRating: number }>> {
        const half = Math.floor(characterLevel / 2);
        const minCR = Math.max(0, half - 1);
        const maxCR = Math.min(30, half + 1);
        const count = Math.floor(Math.random() * 3) + 1;

        const conn = this.em.getConnection();
        const rows = await conn.execute<MonsterRow[]>(
            'SELECT id, name, hit_points, challenge_rating FROM srd_monster WHERE challenge_rating >= ? AND challenge_rating <= ? ORDER BY RANDOM() LIMIT ?',
            [minCR, maxCR, count],
            'all',
        );

        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            hitPoints: row.hit_points,
            challengeRating: row.challenge_rating,
        }));
    }

    /** Moves the player to a discovered location, rolling for a random encounter after the move. */
    async travelTo(campaignId: number, locationId: number, sessionId?: number): Promise<TravelOutcome> {
        const discovery = await this.em.findOne(LocationDiscovery, { campaignId, locationId });
        if (!discovery) {
            return { success: false, errorCode: 'UNDISCOVERED_LOCATION', message: `Location ${locationId} not discovered` };
        }

        const campaign = await this.em.findOne(Campaign, { id: campaignId });
        if (!campaign) {
            return { success: false, errorCode: 'CAMPAIGN_NOT_FOUND', message: `Campaign ${campaignId} not found` };
        }

        campaign.currentLocationId = locationId;
        await this.em.flush();

        this.events?.emit(STATE_CHANGED_EVENT, new StateChangedEvent('TRAVEL', String(locationId), campaignId));

        let encounter: EncounterResult | null = null;

        if (campaign.travelEncounterEnabled && sessionId !== undefined && this.dice) {
            const location = await this.em.findOne(Location, { id: locationId });
            const modifier = this.dangerModifier(location?.currentState ?? null);
            const roll = this.dice.d20() + modifier;

            if (roll >= 15) {
                const character = await this.em.findOne(Character, { campaign: { id: campaignId } } as never);
                const characterLevel = (character as { level?: number } | null)?.level ?? 1;
                const monsters = await this.drawEncounterMonsters(characterLevel);

                if (monsters.length === 0) {
                    encounter = { triggered: true, monsters: [], reason: 'NO_MONSTERS_IN_BRACKET' };
                } else {
                    const temporaryNpcs = monsters.map((monster) => this.em.create(Npc, {
                        campaignId,
                        name: monster.name,
                        hp: monster.hitPoints,
                        maxHp: monster.hitPoints,
                        alive: true,
                        agenda: null,
                    }));

                    const characterId = (character as { id?: number } | null)?.id;
                    const participants: Array<{ type: 'CHARACTER' | 'NPC'; id: string; npcData?: { hp: number; maxHp: number; name: string } }> = [
                        ...(characterId === undefined ? [] : [{ type: 'CHARACTER' as const, id: String(characterId) }]),
                        ...temporaryNpcs.map((npc, index) => ({
                            type: 'NPC' as const,
                            id: `encounter_${index}`,
                            npcData: {
                                hp: (npc as { hp: number }).hp,
                                maxHp: (npc as { maxHp: number }).maxHp,
                                name: (npc as { name: string }).name,
                            },
                        })),
                    ];

                    await this.combat?.startCombat(sessionId, participants);

                    const monsterNames = monsters.map((monster) => monster.name);
                    const article = monsterNames.length === 1 ? `A ${monsterNames[0]}` : `${monsterNames.length} ${monsterNames[0]}s`;
                    encounter = {
                        triggered: true,
                        monsters: monsterNames,
                        description: `${article} ambushes you on the road`,
                    };
                }
            }
        }

        return { success: true, data: { locationId, encounter } };
    }

    /** Creates a LocationDiscovery record idempotently. */
    async discoverLocation(
        campaignId: number,
        locationId: number,
        source: string,
        sourceId: number | null,
    ): Promise<TravelOutcome> {
        const existing = await this.em.findOne(LocationDiscovery, { campaignId, locationId });
        if (existing) {
            return { success: true, data: { discoveryId: existing.id, alreadyDiscovered: true } };
        }

        const discovery = this.em.create(LocationDiscovery, {
            campaignId,
            locationId,
            source: (source as LocationDiscoverySource) ?? LocationDiscoverySource.EXPLORATION,
            sourceId,
        });
        this.em.persist(discovery);
        await this.em.flush();

        return { success: true, data: { discoveryId: (discovery as unknown as { id: number }).id } };
    }

    /** Creates a new Location and auto-discovers it. */
    async createLocation(
        campaignId: number,
        fields: {
            name: string
            description: string
            currentState: string | null
            connectedLocationIds: number[]
        },
    ): Promise<TravelOutcome> {
        const location = this.em.create(Location, {
            campaignId,
            ...fields,
        });
        this.em.persist(location);
        await this.em.flush();

        const locationId = (location as unknown as { id: number }).id;

        const discovery = this.em.create(LocationDiscovery, {
            campaignId,
            locationId,
            source: LocationDiscoverySource.EXPLORATION,
            sourceId: null,
        });
        this.em.persist(discovery);
        await this.em.flush();

        return { success: true, data: { locationId, location } };
    }

    /** Updates campaign-level settings. Only modifies fields present in the payload. */
    async updateCampaignSettings(
        campaignId: number,
        settings: { travelEncounterEnabled?: boolean },
    ): Promise<TravelOutcome> {
        const campaign = await this.em.findOne(Campaign, { id: campaignId });
        if (!campaign) {
            return { success: false, errorCode: 'CAMPAIGN_NOT_FOUND', message: `Campaign ${campaignId} not found` };
        }

        if (settings.travelEncounterEnabled !== undefined) {
            campaign.travelEncounterEnabled = settings.travelEncounterEnabled;
        }

        await this.em.flush();
        return { success: true, data: { travelEncounterEnabled: campaign.travelEncounterEnabled } };
    }
}
