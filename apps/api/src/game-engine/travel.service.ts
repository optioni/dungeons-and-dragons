import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { Location } from '../world/entities/location.entity.js';
import { LocationDiscovery } from '../world/entities/location-discovery.entity.js';
import { LocationDiscoverySource } from '../world/world.enums.js';
import { STATE_CHANGED_EVENT, StateChangedEvent } from './events/state-changed.event.js';

export interface TravelResult { success: true; data: Record<string, unknown> }
export interface TravelError { success: false; errorCode: string; message: string }
type TravelOutcome = TravelResult | TravelError;

/**
 * Handles travel_to, discover_location, and create_location tool logic.
 */
@Injectable()
export class TravelService {
    constructor(
        private readonly em: EntityManager,
        private readonly events: EventEmitter2,
    ) {}

    /** Moves the player to a discovered location. */
    async travelTo(campaignId: number, locationId: number): Promise<TravelOutcome> {
        const discovery = await this.em.findOne(LocationDiscovery, { campaignId, locationId });
        if (!discovery) {
            return { success: false, errorCode: 'UNDISCOVERED_LOCATION', message: `Location ${locationId} not discovered` };
        }

        const campaign = await this.em.findOne(Campaign, { id: campaignId });
        if (!campaign) return { success: false, errorCode: 'CAMPAIGN_NOT_FOUND', message: `Campaign ${campaignId} not found` };

        campaign.currentLocationId = locationId;
        await this.em.flush();

        this.events?.emit(STATE_CHANGED_EVENT, new StateChangedEvent('TRAVEL', String(locationId), campaignId));

        return { success: true, data: { locationId } };
    }

    /** Creates a LocationDiscovery record idempotently. */
    async discoverLocation(
        campaignId: number,
        locationId: number,
        source: string,
        sourceId: number | null,
    ): Promise<TravelOutcome> {
        const existing = await this.em.findOne(LocationDiscovery, { campaignId, locationId });
        if (existing) return { success: true, data: { discoveryId: existing.id, alreadyDiscovered: true } };

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
            name: string;
            description: string;
            currentState: string | null;
            connectedLocationIds: number[];
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
}
