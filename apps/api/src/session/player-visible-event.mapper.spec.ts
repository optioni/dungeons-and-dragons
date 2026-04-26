import { describe, expect, it } from 'vitest';

import { PlayerVisibleEventMapper } from './player-visible-event.mapper';
import { isPlayerVisibleEventPayload } from './player-visible-event.types';

describe('PlayerVisibleEventMapper', () => {
    const mapper = new PlayerVisibleEventMapper();

    it('validates curated payloads and rejects raw tool pass-through', () => {
        expect(isPlayerVisibleEventPayload({
            category: 'INVENTORY',
            kind: 'ITEM_GAINED',
            title: 'Item gained',
            summary: 'Quantity 2.',
            entities: [{ type: 'ITEM', id: '10', name: 'Item' }],
            values: { quantity: 2 },
        })).toBe(true);

        expect(isPlayerVisibleEventPayload({
            category: 'INVENTORY',
            kind: 'ITEM_GAINED',
            title: 'Item gained',
            toolInput: { item_id: 10 },
        })).toBe(false);

        expect(isPlayerVisibleEventPayload({
            category: 'COMBAT',
            kind: 'DAMAGE_APPLIED',
            title: 'Damage applied',
            values: { armorClass: 17 },
        })).toBe(false);
    });

    it('maps successful combat effects without hidden enemy stats', () => {
        const events = mapper.map({
            toolName: 'apply_damage',
            toolInput: { target_id: 'goblin-1', amount: 7, damage_type: 'slashing' },
            toolResult: { success: true, data: { newHp: 3, armorClass: 15, downed: false } },
        });

        expect(events).toEqual([
            {
                category: 'COMBAT',
                kind: 'DAMAGE_APPLIED',
                title: 'Damage applied',
                entities: [{ type: 'COMBATANT', id: 'goblin-1', name: 'Combatant' }],
                values: { amount: 7, damageType: 'slashing', downed: false },
            },
        ]);
    });

    it('maps inventory, resource, quest, travel, and discovery events', () => {
        expect(mapper.map({
            toolName: 'give_item',
            toolInput: { item_id: 10, quantity: 2 },
            toolResult: { success: true, data: { itemId: 10, quantity: 2 } },
        })[0]).toMatchObject({ category: 'INVENTORY', kind: 'ITEM_GAINED' });

        expect(mapper.map({
            toolName: 'use_spell_slot',
            toolInput: { level: 1 },
            toolResult: { success: true, data: { level: 1, used: 1, total: 2 } },
        })[0]).toMatchObject({ category: 'RESOURCE', kind: 'SPELL_SLOT_USED' });

        expect(mapper.map({
            toolName: 'create_quest',
            toolInput: { title: 'Find the courier' },
            toolResult: { success: true, data: { questId: 5 } },
        })[0]).toMatchObject({ category: 'QUEST', kind: 'QUEST_CREATED', title: 'Quest started: Find the courier' });

        expect(mapper.map({
            toolName: 'travel_to',
            toolInput: { location_id: 4 },
            toolResult: { success: true, data: { locationId: 4 } },
        })[0]).toMatchObject({ category: 'TRAVEL', kind: 'TRAVEL_COMPLETED' });

        expect(mapper.map({
            toolName: 'create_location',
            toolInput: { name: 'Hidden input name' },
            toolResult: { success: true, data: { locationId: 9, location: { id: 9, name: 'Blackfen Crossing' } } },
        })[0]).toMatchObject({ category: 'DISCOVERY', kind: 'LOCATION_DISCOVERED', title: 'Location discovered: Blackfen Crossing' });
    });

    it('does not map failed, internal, hidden, or insufficiently safe outcomes', () => {
        expect(mapper.map({
            toolName: 'give_item',
            toolInput: { item_id: 10 },
            toolResult: { success: false, errorCode: 'NO_RECIPIENT', message: 'No recipient' },
        })).toEqual([]);

        expect(mapper.map({
            toolName: 'record_memory',
            toolInput: { text: 'Secret memory' },
            toolResult: { success: true, data: { id: 1 } },
        })).toEqual([]);

        expect(mapper.map({
            toolName: 'shift_faction_disposition',
            toolInput: { faction_id: 1, disposition: 'HOSTILE' },
            toolResult: { success: true, data: { playerDisposition: 'HOSTILE' } },
        })).toEqual([]);

        expect(mapper.map({
            toolName: 'create_location',
            toolInput: { name: 'Do not infer this' },
            toolResult: { success: true, data: { locationId: 9 } },
        })).toEqual([]);
    });
});
