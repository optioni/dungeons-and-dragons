import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Character } from '../character/entities/character.entity.js';
import { CharacterItem } from '../character/entities/character-item.entity.js';
import { Item } from '../character/entities/item.entity.js';
import { ItemType } from '../character/character.enums.js';
import { LocationDiscovery } from '../world/entities/location-discovery.entity.js';
import { MapLocation } from '../world/entities/map-location.entity.js';
import { NpcItem } from '../world/entities/npc-item.entity.js';
import { LocationDiscoverySource } from '../world/world.enums.js';
import { STATE_CHANGED_EVENT, StateChangedEvent } from './events/state-changed.event.js';

export interface ItemResult { success: true; data: Record<string, unknown> }
export interface ItemError { success: false; errorCode: string; message: string }
type ItemOutcome = ItemResult | ItemError;

/**
 * Handles all item-related LLM tool logic: create, give, equip, buy, sell, restock.
 */
@Injectable()
export class ItemService {
    constructor(
        private readonly em: EntityManager,
        private readonly events: EventEmitter2,
    ) {}

    /** Persists a new Item entity. */
    async createItem(
        campaignId: number,
        fields: {
            name: string;
            description: string;
            itemType: string;
            weight?: number | null;
            value?: number | null;
            srdEquipmentId?: number | null;
        },
    ): Promise<ItemOutcome> {
        const item = this.em.create(Item, {
            name: fields.name,
            description: fields.description,
            itemType: (fields.itemType as ItemType) ?? ItemType.OTHER,
            weight: fields.weight ?? null,
            value: fields.value ?? null,
        });
        this.em.persist(item);
        await this.em.flush();

        return { success: true, data: { itemId: (item as unknown as { id: number }).id, campaignId } };
    }

    /** Gives an item to a character or NPC. */
    async giveItem(
        sessionId: number,
        itemId: number,
        quantity: number,
        toCharacterId?: number,
        toNpcId?: number,
    ): Promise<ItemOutcome> {
        const item = await this.em.findOne(Item, { id: itemId });
        if (!item) return { success: false, errorCode: 'ITEM_NOT_FOUND', message: `Item ${itemId} not found` };

        let campaignId = 0;

        if (toCharacterId !== undefined) {
            const char = await this.em.findOne(Character, { id: toCharacterId });
            if (!char) return { success: false, errorCode: 'CHARACTER_NOT_FOUND', message: `Character ${toCharacterId} not found` };

            const existing = await this.em.findOne(CharacterItem, { character: toCharacterId, item: itemId });
            if (existing) {
                existing.quantity += quantity;
            } else {
                const ci = this.em.create(CharacterItem, { character: char, item, quantity });
                this.em.persist(ci);
            }
            await this.em.flush();

            campaignId = (char as unknown as { campaign?: { id?: number } }).campaign?.id ?? 0;

            // Auto-discover map locations if item has a mapId
            const itemMapId = (item as unknown as { mapId?: number | null }).mapId;
            if (itemMapId) {
                const mapLocations = await this.em.find(MapLocation, { mapId: itemMapId });
                for (const ml of mapLocations) {
                    const exists = await this.em.findOne(LocationDiscovery, { campaignId, locationId: ml.locationId });
                    if (!exists) {
                        const disc = this.em.create(LocationDiscovery, {
                            campaignId,
                            locationId: ml.locationId,
                            source: LocationDiscoverySource.MAP,
                            sourceId: null,
                        });
                        this.em.persist(disc);
                    }
                }
                await this.em.flush();
            }
        } else if (toNpcId !== undefined) {
            const existingNpcItem = await this.em.findOne(NpcItem, { npcId: toNpcId, itemId });
            if (existingNpcItem) {
                existingNpcItem.quantity += quantity;
            } else {
                const ni = this.em.create(NpcItem, { npcId: toNpcId, itemId, name: item.name, quantity });
                this.em.persist(ni);
            }
            await this.em.flush();
        } else {
            return { success: false, errorCode: 'NO_RECIPIENT', message: 'Must specify toCharacterId or toNpcId' };
        }

        this.events?.emit(STATE_CHANGED_EVENT, new StateChangedEvent('GIVE_ITEM', String(itemId), campaignId));

        return { success: true, data: { itemId, quantity } };
    }

    /** Sets the equipped slot for a CharacterItem. */
    async equipItem(characterItemId: number, slot: string): Promise<ItemOutcome> {
        const ci = await this.em.findOne(CharacterItem, { id: characterItemId });
        if (!ci) return { success: false, errorCode: 'ITEM_NOT_FOUND', message: `CharacterItem ${characterItemId} not found` };

        // Check if slot is occupied by another item for this character
        const occupied = await this.em.findOne(CharacterItem, {
            character: (ci as unknown as { character: { id: number } }).character.id,
            slot,
            id: { $ne: characterItemId } as never,
        });
        if (occupied) return { success: false, errorCode: 'SLOT_OCCUPIED', message: `Slot ${slot} is already occupied` };

        ci.slot = slot as never;
        await this.em.flush();

        return { success: true, data: { slot } };
    }

    /** Clears the equipped slot for a CharacterItem. */
    async unequipItem(characterItemId: number): Promise<ItemOutcome> {
        const ci = await this.em.findOne(CharacterItem, { id: characterItemId });
        if (!ci) return { success: false, errorCode: 'ITEM_NOT_FOUND', message: `CharacterItem ${characterItemId} not found` };

        ci.slot = null;
        await this.em.flush();

        return { success: true, data: {} };
    }

    /** Purchases an item from an NPC atomically. */
    async buyItem(characterId: number, npcId: number, itemId: number, quantity: number): Promise<ItemOutcome> {
        const npcItem = await this.em.findOne(NpcItem, { npcId, itemId });
        if (!npcItem) return { success: false, errorCode: 'ITEM_NOT_FOUND', message: `NPC ${npcId} does not carry item ${itemId}` };

        if (npcItem.quantity < quantity) {
            return { success: false, errorCode: 'INSUFFICIENT_STOCK', message: 'NPC has insufficient stock' };
        }

        const pricePerUnit = npcItem.merchantPrice ?? 0;
        const totalCost = pricePerUnit * quantity;

        const char = await this.em.findOne(Character, { id: characterId });
        if (!char) return { success: false, errorCode: 'CHARACTER_NOT_FOUND', message: `Character ${characterId} not found` };

        if (char.goldPieces < totalCost) {
            return { success: false, errorCode: 'INSUFFICIENT_GOLD', message: 'Insufficient gold' };
        }

        // Atomic transaction
        char.goldPieces -= totalCost;
        npcItem.quantity -= quantity;

        const existingCI = await this.em.findOne(CharacterItem, { character: characterId, item: itemId });
        if (existingCI) {
            existingCI.quantity += quantity;
        } else {
            const item = await this.em.findOne(Item, { id: itemId });
            if (item) {
                const ci = this.em.create(CharacterItem, { character: char, item, quantity });
                this.em.persist(ci);
            }
        }

        await this.em.flush();

        return { success: true, data: { goldSpent: totalCost, newGold: char.goldPieces } };
    }

    /** Sells an item to an NPC atomically. */
    async sellItem(characterId: number, npcId: number, itemId: number, quantity: number): Promise<ItemOutcome> {
        const ci = await this.em.findOne(CharacterItem, { character: characterId, item: itemId });
        if (!ci) return { success: false, errorCode: 'ITEM_NOT_FOUND', message: `Character ${characterId} does not own item ${itemId}` };

        if (ci.quantity < quantity) {
            return { success: false, errorCode: 'INSUFFICIENT_QUANTITY', message: 'Character does not have enough of this item' };
        }

        const item = await this.em.findOne(Item, { id: itemId });
        const saleValuePerUnit = (item as unknown as { value?: number | null })?.value ?? 1;
        const totalGold = saleValuePerUnit * quantity;

        const char = await this.em.findOne(Character, { id: characterId });
        if (!char) return { success: false, errorCode: 'CHARACTER_NOT_FOUND', message: `Character ${characterId} not found` };

        char.goldPieces += totalGold;

        ci.quantity -= quantity;
        if (ci.quantity === 0) {
            this.em.remove(ci);
        }

        // Add to NPC inventory
        const existingNpcItem = await this.em.findOne(NpcItem, { npcId, itemId });
        if (existingNpcItem) {
            existingNpcItem.quantity += quantity;
        } else if (item) {
            const ni = this.em.create(NpcItem, { npcId, itemId, name: item.name, quantity });
            this.em.persist(ni);
        }

        await this.em.flush();

        return { success: true, data: { goldEarned: totalGold, newGold: char.goldPieces } };
    }

    /** Replaces all NpcItem rows for an NPC atomically. */
    async restockMerchant(
        npcId: number,
        items: Array<{ itemId: number; quantity: number; priceInGold: number }>,
    ): Promise<ItemOutcome> {
        const existing = await this.em.find(NpcItem, { npcId });
        for (const ni of existing) {
            this.em.remove(ni);
        }

        for (const item of items) {
            const itemEntity = await this.em.findOne(Item, { id: item.itemId });
            const ni = this.em.create(NpcItem, {
                npcId,
                itemId: item.itemId,
                name: itemEntity?.name ?? `Item ${item.itemId}`,
                quantity: item.quantity,
                merchantPrice: item.priceInGold,
            });
            this.em.persist(ni);
        }

        await this.em.flush();

        return { success: true, data: { npcId, itemCount: items.length } };
    }
}
