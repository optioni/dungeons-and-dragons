import { Injectable } from '@nestjs/common';

import { type ToolResult } from '../llm/tool-registry.js';
import {
    isPlayerVisibleEventPayload,
    type PlayerVisibleEventPayload,
    type PlayerVisibleEventValue,
} from './player-visible-event.types.js';

export interface PlayerVisibleEventMappingInput {
    toolName: string;
    toolInput: Record<string, unknown>;
    toolResult: ToolResult;
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function entity(type: string, id: unknown, fallbackName: string) {
    const idValue = typeof id === 'number' || typeof id === 'string' ? String(id) : undefined;
    return { type, ...(idValue === undefined ? {} : { id: idValue }), name: fallbackName };
}

function compactValues(
    values: Record<string, PlayerVisibleEventValue | undefined>,
): Record<string, PlayerVisibleEventValue> | undefined {
    const entries = Object.entries(values).filter(
        (entry): entry is [string, PlayerVisibleEventValue] => entry[1] !== undefined,
    );
    return entries.length === 0 ? undefined : Object.fromEntries(entries);
}

/**
 * Converts successful tool outcomes into authored player-facing mechanical events.
 */
@Injectable()
export class PlayerVisibleEventMapper {
    /**
     * Returns zero or one sanitized visible event for a completed tool dispatch.
     */
    map({ toolName, toolInput, toolResult }: PlayerVisibleEventMappingInput): PlayerVisibleEventPayload[] {
        if (toolResult.success !== true) {
            return [];
        }

        const data = asRecord(toolResult.data);
        const payload = this.mapSuccessfulTool(toolName, toolInput, data, toolResult);
        if (!payload) {
            return [];
        }

        return isPlayerVisibleEventPayload(payload) ? [payload] : [];
    }

    // eslint-disable-next-line complexity
    private mapSuccessfulTool(
        toolName: string,
        toolInput: Record<string, unknown>,
        data: Record<string, unknown>,
        toolResult: ToolResult,
    ): PlayerVisibleEventPayload | null {
        switch (toolName) {
            case 'start_combat':
                return this.event('COMBAT', 'COMBAT_STARTED', 'Combat begins', 'Initiative is set.');
            case 'end_combat':
                return this.event('COMBAT', 'COMBAT_ENDED', 'Combat ends', 'The encounter is resolved.');
            case 'apply_damage':
                return this.combatValueEvent('DAMAGE_APPLIED', 'Damage applied', toolInput, {
                    amount: numberValue(toolInput.amount),
                    damageType: stringValue(toolInput.damage_type),
                    downed: typeof data.downed === 'boolean' ? data.downed : undefined,
                });
            case 'heal':
                return this.combatValueEvent('HEALING_APPLIED', 'Healing applied', toolInput, {
                    amount: numberValue(toolInput.amount),
                });
            case 'apply_condition':
                return this.conditionEvent('CONDITION_APPLIED', 'Condition applied', toolInput);
            case 'remove_condition':
                return this.conditionEvent('CONDITION_REMOVED', 'Condition removed', toolInput);
            case 'roll_death_save':
                return this.event('COMBAT', 'DEATH_SAVE_ROLLED', 'Death save resolved', this.deathSaveSummary(data), {
                    entities: [entity('CHARACTER', toolInput.character_id, 'Character')],
                    values: compactValues({
                        outcome: stringValue(data.outcome),
                        successes: numberValue(data.successes),
                        failures: numberValue(data.failures),
                        natural20: typeof data.natural20 === 'boolean' ? data.natural20 : undefined,
                    }),
                });
            case 'instant_death':
                return this.event('COMBAT', 'CHARACTER_DEATH', 'Character death', 'A character has died.', {
                    entities: [entity('CHARACTER', toolInput.character_id, 'Character')],
                });
            case 'give_item':
            case 'loot_room':
                return this.itemEvent('INVENTORY', 'ITEM_GAINED', 'Item gained', toolInput, data);
            case 'take_item':
                return this.itemEvent('INVENTORY', 'ITEM_TAKEN', 'Item taken', toolInput, data);
            case 'buy_item':
                return this.itemEvent('INVENTORY', 'ITEM_BOUGHT', 'Item bought', toolInput, data, {
                    goldSpent: numberValue(data.goldSpent),
                    newGold: numberValue(data.newGold),
                });
            case 'sell_item':
                return this.itemEvent('INVENTORY', 'ITEM_SOLD', 'Item sold', toolInput, data, {
                    goldEarned: numberValue(data.goldEarned),
                    newGold: numberValue(data.newGold),
                });
            case 'equip_item':
                return this.event('INVENTORY', 'ITEM_EQUIPPED', 'Item equipped', 'Equipment changed.', {
                    values: compactValues({ slot: stringValue(data.slot) ?? stringValue(toolInput.slot) }),
                });
            case 'unequip_item':
                return this.event('INVENTORY', 'ITEM_UNEQUIPPED', 'Item unequipped', 'Equipment changed.');
            case 'use_spell_slot':
                return this.event('RESOURCE', 'SPELL_SLOT_USED', 'Spell slot expended', 'A spell slot was used.', {
                    values: compactValues({
                        level: numberValue(data.level) ?? numberValue(toolInput.level),
                        used: numberValue(data.used),
                        total: numberValue(data.total),
                    }),
                });
            case 'take_short_rest':
                return this.event(
                    'RESOURCE',
                    'SHORT_REST_TAKEN',
                    'Short rest completed',
                    'Hit dice and wounds are resolved.',
                    {
                        values: compactValues({
                            hitDiceSpent: numberValue(data.hitDiceSpent),
                            hpRestored: numberValue(data.hpRestored),
                        }),
                    },
                );
            case 'take_long_rest':
                return this.event(
                    'RESOURCE',
                    'LONG_REST_TAKEN',
                    'Long rest completed',
                    'The party rests and recovers.',
                );
            case 'apply_level_up':
                return this.event('RESOURCE', 'LEVEL_UP_APPLIED', 'Level up applied', 'The character grows stronger.', {
                    values: compactValues({
                        level: numberValue(data.level),
                        maxHp: numberValue(data.maxHp),
                    }),
                });
            case 'create_quest':
                return this.event(
                    'QUEST',
                    'QUEST_CREATED',
                    `Quest started: ${stringValue(toolInput.title) ?? 'New quest'}`,
                );
            case 'update_quest_objective':
                return this.event('QUEST', 'QUEST_OBJECTIVE_UPDATED', 'Quest objective updated', undefined, {
                    entities: [entity('QUEST_OBJECTIVE', data.objectiveId ?? toolInput.objective_id, 'Objective')],
                    values: compactValues({ status: stringValue(data.status) ?? stringValue(toolInput.status) }),
                });
            case 'complete_quest':
                return this.questStatusEvent(
                    'QUEST_COMPLETED',
                    'Quest completed',
                    data,
                    toolInput,
                    toolResult.questCompleted?.questTitle,
                );
            case 'fail_quest':
                return this.questStatusEvent('QUEST_FAILED', 'Quest failed', data, toolInput);
            case 'travel_to':
                return this.event('TRAVEL', 'TRAVEL_COMPLETED', 'Travel completed', 'You arrive at the destination.', {
                    entities: [entity('LOCATION', data.locationId ?? toolInput.location_id, 'Location')],
                });
            case 'discover_location':
                return this.event(
                    'DISCOVERY',
                    'LOCATION_DISCOVERED',
                    'Location discovered',
                    'A new place is added to the map.',
                    {
                        entities: [entity('LOCATION', toolInput.location_id, 'Location')],
                        values: compactValues({
                            alreadyDiscovered:
                                typeof data.alreadyDiscovered === 'boolean' ? data.alreadyDiscovered : undefined,
                        }),
                    },
                );
            case 'create_location':
                return this.createdLocationEvent(data);
            case 'enter_dungeon':
                return this.event('DISCOVERY', 'DUNGEON_ENTERED', 'Dungeon entered', 'You cross into the dungeon.', {
                    entities: [entity('DUNGEON', data.dungeonId ?? toolInput.dungeon_id, 'Dungeon')],
                });
            case 'exit_dungeon':
                return this.event('TRAVEL', 'DUNGEON_EXITED', 'Dungeon exited', 'You return from the dungeon.');
            case 'move_to_room':
                return this.event('TRAVEL', 'ROOM_ENTERED', 'Room entered', 'You move deeper through the dungeon.', {
                    entities: [entity('ROOM', data.roomId ?? toolInput.room_id, 'Room')],
                    values: compactValues({
                        roomState: stringValue(data.roomState),
                        wanderingMonsterTriggered:
                            typeof data.wanderingMonsterTriggered === 'boolean'
                                ? data.wanderingMonsterTriggered
                                : undefined,
                    }),
                });
            default:
                return null;
        }
    }

    private combatValueEvent(
        kind: string,
        title: string,
        toolInput: Record<string, unknown>,
        values: Record<string, PlayerVisibleEventValue | undefined>,
    ): PlayerVisibleEventPayload {
        return this.event('COMBAT', kind, title, undefined, {
            entities: [entity('COMBATANT', toolInput.target_id, 'Combatant')],
            values: compactValues(values),
        });
    }

    private conditionEvent(kind: string, title: string, toolInput: Record<string, unknown>): PlayerVisibleEventPayload {
        return this.combatValueEvent(kind, title, toolInput, { condition: stringValue(toolInput.condition) });
    }

    private itemEvent(
        category: 'INVENTORY',
        kind: string,
        title: string,
        toolInput: Record<string, unknown>,
        data: Record<string, unknown>,
        extraValues: Record<string, PlayerVisibleEventValue | undefined> = {},
    ): PlayerVisibleEventPayload {
        const itemId = data.itemId ?? toolInput.item_id;
        const itemName = stringValue(data.itemName) ?? 'Item';
        const quantity = numberValue(data.quantity) ?? numberValue(toolInput.quantity) ?? 1;
        return this.event(category, kind, title, quantity > 1 ? `Quantity ${quantity}.` : undefined, {
            entities: [entity('ITEM', itemId, itemName)],
            values: compactValues({ quantity, ...extraValues }),
        });
    }

    private questStatusEvent(
        kind: string,
        title: string,
        data: Record<string, unknown>,
        toolInput: Record<string, unknown>,
        questTitle?: string,
    ): PlayerVisibleEventPayload {
        return this.event('QUEST', kind, questTitle ? `${title}: ${questTitle}` : title, undefined, {
            entities: [entity('QUEST', data.questId ?? toolInput.quest_id, 'Quest')],
            values: compactValues({ status: stringValue(data.status) }),
        });
    }

    private createdLocationEvent(data: Record<string, unknown>): PlayerVisibleEventPayload | null {
        const location = asRecord(data.location);
        const locationId = data.locationId ?? location.id;
        const locationName = stringValue(location.name);
        if (locationName === undefined) {
            return null;
        }

        return this.event('DISCOVERY', 'LOCATION_DISCOVERED', `Location discovered: ${locationName}`, undefined, {
            entities: [entity('LOCATION', locationId, locationName)],
        });
    }

    private deathSaveSummary(data: Record<string, unknown>): string | undefined {
        const outcome = stringValue(data.outcome);
        if (!outcome) {
            return undefined;
        }

        return `Outcome: ${outcome.toLowerCase().replaceAll('_', ' ')}.`;
    }

    private event(
        category: PlayerVisibleEventPayload['category'],
        kind: string,
        title: string,
        summary?: string,
        rest: Pick<PlayerVisibleEventPayload, 'entities' | 'values'> = {},
    ): PlayerVisibleEventPayload {
        return {
            category,
            kind,
            title,
            ...(summary === undefined ? {} : { summary }),
            ...(rest.entities === undefined ? {} : { entities: rest.entities }),
            ...(rest.values === undefined ? {} : { values: rest.values }),
        };
    }
}
