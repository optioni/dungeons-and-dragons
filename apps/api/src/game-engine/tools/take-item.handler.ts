import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Character } from '../../character/entities/character.entity.js';
import { type ToolResult } from '../../llm/tool-registry.js';
import { QuestService } from '../../quest/quest.service.js';
import { GameSession } from '../../session/entities/game-session.entity.js';
import { Location } from '../../world/entities/location.entity.js';
import { LocationItem } from '../../world/entities/location-item.entity.js';
import { ItemService } from '../item.service.js';

/** Transfers an item from an overworld location into the active character's inventory. */
@Injectable()
export class TakeItemHandler {
    constructor(
        private readonly em: EntityManager,
        private readonly itemService: ItemService,
        private readonly questService: QuestService,
    ) {}

    async execute(
        sessionId: number,
        input: { locationId: number; itemId: number; quantity?: number },
    ): Promise<ToolResult> {
        const session = await this.em.findOne(GameSession, { id: sessionId }, { populate: ['campaign' as never] });
        if (!session) {
            return { success: false, errorCode: 'SESSION_NOT_FOUND', message: `Session ${sessionId} not found` };
        }

        const quantity = input.quantity ?? 1;
        const campaignId = session.campaign.id;

        const location = await this.em.findOne(Location, { id: input.locationId });
        if (!location || location.campaignId !== campaignId) {
            return { success: false, errorCode: 'LOCATION_NOT_FOUND', message: `Location ${input.locationId} not found` };
        }

        const locationItem = await this.em.findOne(LocationItem, {
            locationId: input.locationId,
            itemId: input.itemId,
        });
        if (!locationItem) {
            return {
                success: false,
                errorCode: 'ITEM_NOT_AT_LOCATION',
                message: `Item ${input.itemId} not found at location ${input.locationId}`,
            };
        }

        if (locationItem.quantity < quantity) {
            return {
                success: false,
                errorCode: 'INSUFFICIENT_QUANTITY',
                message: `Location only has ${locationItem.quantity} of item ${input.itemId}`,
            };
        }

        const character = await this.em.findOne(Character, { campaign: { id: campaignId } } as never);
        const characterId = (character as { id?: number } | null)?.id;
        if (!characterId) {
            return {
                success: false,
                errorCode: 'CHARACTER_NOT_FOUND',
                message: `Character for campaign ${campaignId} not found`,
            };
        }

        const giveResult = await this.itemService.giveItem(sessionId, input.itemId, quantity, characterId);
        if (!giveResult.success) {
            return giveResult;
        }

        locationItem.quantity -= quantity;
        if (locationItem.quantity <= 0) {
            this.em.remove(locationItem);
        }

        // giveItem() flushes internally; this second flush persists the quantity decrement on locationItem.
        await this.em.flush();

        const checkerResult = await this.questService.runAutoChecker(campaignId);
        return {
            success: true,
            data: { locationId: input.locationId, itemId: input.itemId, itemName: locationItem.itemName, quantity },
            ...(checkerResult.questCompleted ? { questCompleted: checkerResult.questCompleted } : {}),
        };
    }
}
