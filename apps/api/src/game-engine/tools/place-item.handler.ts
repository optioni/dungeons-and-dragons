import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Item } from '../../character/entities/item.entity.js';
import { type ToolResult } from '../../llm/tool-registry.js';
import { Location } from '../../world/entities/location.entity.js';
import { LocationItem } from '../../world/entities/location-item.entity.js';

/** Places an item at an overworld location, stacking quantity if a row already exists. */
@Injectable()
export class PlaceItemHandler {
    constructor(private readonly em: EntityManager) {}

    async execute(
        campaignId: number,
        input: { locationId: number; itemId: number; quantity?: number; note?: string | null },
    ): Promise<ToolResult> {
        const location = await this.em.findOne(Location, { id: input.locationId });
        if (!location || location.campaignId !== campaignId) {
            return { success: false, errorCode: 'LOCATION_NOT_FOUND', message: `Location ${input.locationId} not found` };
        }

        const item = await this.em.findOne(Item, { id: input.itemId });
        if (!item) {
            return { success: false, errorCode: 'ITEM_NOT_FOUND', message: `Item ${input.itemId} not found` };
        }

        const quantity = input.quantity ?? 1;
        const existing = await this.em.findOne(LocationItem, { locationId: input.locationId, itemId: input.itemId });

        if (existing) {
            existing.quantity += quantity;
            if (input.note !== undefined) {
                existing.note = input.note ?? null;
            }
        } else {
            const locationItem = this.em.create(LocationItem, {
                locationId: input.locationId,
                itemId: input.itemId,
                itemName: item.name,
                quantity,
                note: input.note ?? null,
            });
            this.em.persist(locationItem);
        }

        await this.em.flush();

        return { success: true, data: { locationId: input.locationId, itemId: input.itemId, quantity } };
    }
}
