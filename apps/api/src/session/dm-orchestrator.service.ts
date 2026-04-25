import Anthropic from '@anthropic-ai/sdk';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { Character } from '../character/entities/character.entity.js';
import { type EnvironmentConfig } from '../config/environment.validation.js';
import { ContextLoader } from '../llm/context-loader.service.js';
import { InnerMonologueService } from '../llm/inner-monologue.service.js';
import { ToolRegistry } from '../llm/tool-registry.service.js';
import { Npc } from '../world/entities/npc.entity.js';
import { NpcMemoryService } from '../world/npc-memory.service.js';
import { DmStreamChunkType } from './dto/dm-stream-chunk.dto.js';
import { EventType } from './session.enums.js';
import { SessionService } from './session.service.js';
import { StreamPublisher } from './stream-publisher.service.js';

/* eslint-disable @typescript-eslint/naming-convention */
/** All tool definitions exposed to the DM model. */
const DM_TOOLS: Anthropic.Tool[] = [
    // ── Utility ─────────────────────────────────────────────────────────────
    {
        name: 'set_scene_type',
        description: 'Changes the active scene type for the current session, affecting prompt module and UI mode.',
        input_schema: {
            type: 'object' as const,
            properties: {
                scene_type: { type: 'string', enum: ['EXPLORATION', 'COMBAT', 'SOCIAL', 'SETTLEMENT', 'REST'], description: 'The new scene type' },
            },
            required: ['scene_type'],
        },
    },
    {
        name: 'suggest_actions',
        description: 'Suggests a short list of possible next actions for the player to choose from.',
        input_schema: {
            type: 'object' as const,
            properties: {
                actions: { type: 'array', items: { type: 'string' as const }, description: 'Concise action labels' },
            },
            required: ['actions'],
        },
    },
    // ── Dice ─────────────────────────────────────────────────────────────────
    {
        name: 'roll_dice',
        description: 'Rolls a dice expression (e.g. "2d6+3") and returns the total and individual rolls.',
        input_schema: {
            type: 'object' as const,
            properties: {
                expression: { type: 'string', description: 'Dice expression such as "1d20", "2d6+3"' },
            },
            required: ['expression'],
        },
    },
    {
        name: 'check_skill',
        description: 'Rolls a skill check against a DC for the active character and returns pass/fail.',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_id: { type: 'number', description: 'Character performing the check' },
                skill: { type: 'string', description: 'Skill name (e.g. "Perception", "Stealth")' },
                dc: { type: 'number', description: 'Difficulty class to beat' },
            },
            required: ['character_id', 'skill', 'dc'],
        },
    },
    {
        name: 'check_ability',
        description: 'Rolls an ability check against a DC for the active character and returns pass/fail.',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_id: { type: 'number', description: 'Character performing the check' },
                ability: { type: 'string', description: 'Ability name (STR, DEX, CON, INT, WIS, CHA)' },
                dc: { type: 'number', description: 'Difficulty class to beat' },
            },
            required: ['character_id', 'ability', 'dc'],
        },
    },
    // ── Combat ───────────────────────────────────────────────────────────────
    {
        name: 'start_combat',
        description: 'Starts a combat encounter. Rolls initiative for all participants.',
        input_schema: {
            type: 'object' as const,
            properties: {
                participants: {
                    type: 'array',
                    description: 'Each entry has type ("CHARACTER"|"NPC"), id, and optional npcData',
                    items: { type: 'object' as const },
                },
            },
            required: ['participants'],
        },
    },
    {
        name: 'advance_initiative',
        description: 'Advances combat to the next participant in initiative order.',
        input_schema: { type: 'object' as const, properties: {} },
    },
    {
        name: 'apply_damage',
        description: 'Applies damage to a combatant. Target ID is "character" or an NPC encounter key.',
        input_schema: {
            type: 'object' as const,
            properties: {
                target_id: { type: 'string', description: '"character" or the NPC encounter key' },
                amount: { type: 'number', description: 'HP to subtract' },
                damage_type: { type: 'string', description: 'Damage type (e.g. "slashing", "fire")' },
            },
            required: ['target_id', 'amount', 'damage_type'],
        },
    },
    {
        name: 'heal',
        description: 'Restores HP to a combatant up to their maximum.',
        input_schema: {
            type: 'object' as const,
            properties: {
                target_id: { type: 'string', description: '"character" or the NPC encounter key' },
                amount: { type: 'number', description: 'HP to restore' },
            },
            required: ['target_id', 'amount'],
        },
    },
    {
        name: 'apply_condition',
        description: 'Applies a D&D 5e condition to a combatant.',
        input_schema: {
            type: 'object' as const,
            properties: {
                target_id: { type: 'string', description: '"character" or the NPC encounter key' },
                condition: { type: 'string', description: 'Condition name (e.g. "Poisoned", "Stunned")' },
            },
            required: ['target_id', 'condition'],
        },
    },
    {
        name: 'remove_condition',
        description: 'Removes a condition from a combatant.',
        input_schema: {
            type: 'object' as const,
            properties: {
                target_id: { type: 'string', description: '"character" or the NPC encounter key' },
                condition: { type: 'string', description: 'Condition name to remove' },
            },
            required: ['target_id', 'condition'],
        },
    },
    {
        name: 'roll_death_save',
        description: 'Rolls a death saving throw for a downed character.',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_id: { type: 'number', description: 'Character making the death save' },
            },
            required: ['character_id'],
        },
    },
    {
        name: 'stabilise',
        description: 'Stabilises a downed character without HP (stops death saves).',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_id: { type: 'number', description: 'Character to stabilise' },
            },
            required: ['character_id'],
        },
    },
    {
        name: 'instant_death',
        description: 'Kills a character instantly (massive damage rule).',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_id: { type: 'number', description: 'Character who dies' },
            },
            required: ['character_id'],
        },
    },
    {
        name: 'end_combat',
        description: 'Ends the current combat encounter and clears combat state.',
        input_schema: { type: 'object' as const, properties: {} },
    },
    // ── Rest ─────────────────────────────────────────────────────────────────
    {
        name: 'take_short_rest',
        description: 'Takes a short rest. Spends hit dice to recover HP.',
        input_schema: {
            type: 'object' as const,
            properties: {
                hit_dice_to_spend: { type: 'number', description: 'Number of hit dice to spend (default 1)' },
            },
        },
    },
    {
        name: 'take_long_rest',
        description: 'Takes a long rest. Fully restores HP and spell slots, advances the in-game day, and triggers the world tick.',
        input_schema: { type: 'object' as const, properties: {} },
    },
    // ── Travel ───────────────────────────────────────────────────────────────
    {
        name: 'travel_to',
        description: 'Moves the player to a previously discovered location. May trigger a random encounter.',
        input_schema: {
            type: 'object' as const,
            properties: {
                location_id: { type: 'number', description: 'ID of the target location' },
            },
            required: ['location_id'],
        },
    },
    {
        name: 'discover_location',
        description: 'Marks a pre-seeded location as discovered. Only use for locations with known IDs from campaign setup.',
        input_schema: {
            type: 'object' as const,
            properties: {
                location_id: { type: 'number', description: 'ID of the location to discover' },
                source: { type: 'string', description: 'Discovery source (e.g. "EXPLORATION", "NPC_DIALOGUE", "MAP")' },
                source_id: { type: 'number', description: 'ID of the source entity (optional)' },
            },
            required: ['location_id', 'source'],
        },
    },
    {
        name: 'create_location',
        description: 'Creates a new named location and auto-discovers it. Use this when the DM introduces any named place on the fly. For sub-locations (inn, archive, guild) within a settlement pass the settlement\'s ID as parent_location_id.',
        input_schema: {
            type: 'object' as const,
            properties: {
                name: { type: 'string', description: 'Location name' },
                description: { type: 'string', description: 'One-sentence description' },
                current_state: { type: 'string', description: 'Current narrative state (optional)' },
                connected_location_ids: { type: 'array', items: { type: 'number' as const }, description: 'IDs of adjacent locations' },
                parent_location_id: { type: 'number', description: 'Parent settlement ID for sub-locations (optional)' },
            },
            required: ['name', 'description'],
        },
    },
    {
        name: 'update_campaign_settings',
        description: 'Updates campaign-level settings such as travel encounter toggle.',
        input_schema: {
            type: 'object' as const,
            properties: {
                travel_encounter_enabled: { type: 'boolean', description: 'Enable or disable random travel encounters' },
            },
        },
    },
    // ── Items ─────────────────────────────────────────────────────────────────
    {
        name: 'create_item',
        description: 'Persists a new item in the campaign item registry. Must be called before give_item.',
        input_schema: {
            type: 'object' as const,
            properties: {
                name: { type: 'string', description: 'Item name' },
                description: { type: 'string', description: 'Item description' },
                item_type: { type: 'string', description: 'Item type (WEAPON, ARMOR, POTION, MISC, etc.)' },
                weight: { type: 'number', description: 'Weight in lbs (optional)' },
                value: { type: 'number', description: 'Value in copper pieces (optional)' },
                srd_equipment_id: { type: 'number', description: 'SRD equipment reference ID (optional)' },
            },
            required: ['name', 'description', 'item_type'],
        },
    },
    {
        name: 'give_item',
        description: 'Transfers an item from the registry into a character or NPC inventory.',
        input_schema: {
            type: 'object' as const,
            properties: {
                item_id: { type: 'number', description: 'Item ID to give' },
                quantity: { type: 'number', description: 'Quantity to give (default 1)' },
                to_character_id: { type: 'number', description: 'Character receiving the item' },
                to_npc_id: { type: 'number', description: 'NPC receiving the item' },
            },
            required: ['item_id'],
        },
    },
    {
        name: 'equip_item',
        description: 'Equips a character item to a specific slot.',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_item_id: { type: 'number', description: 'CharacterItem row ID' },
                slot: { type: 'string', description: 'Equipment slot (e.g. "mainHand", "offHand", "armor")' },
            },
            required: ['character_item_id', 'slot'],
        },
    },
    {
        name: 'unequip_item',
        description: 'Removes a character item from its equipped slot.',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_item_id: { type: 'number', description: 'CharacterItem row ID to unequip' },
            },
            required: ['character_item_id'],
        },
    },
    {
        name: 'buy_item',
        description: 'Purchases an item from an NPC merchant. Deducts gold from the character.',
        input_schema: {
            type: 'object' as const,
            properties: {
                npc_id: { type: 'number', description: 'Merchant NPC ID' },
                item_id: { type: 'number', description: 'Item to purchase' },
                quantity: { type: 'number', description: 'Quantity to buy (default 1)' },
                character_id: { type: 'number', description: 'Buying character ID (defaults to campaign character)' },
            },
            required: ['npc_id', 'item_id'],
        },
    },
    {
        name: 'sell_item',
        description: 'Sells a character item to an NPC merchant. Adds gold to the character.',
        input_schema: {
            type: 'object' as const,
            properties: {
                npc_id: { type: 'number', description: 'Merchant NPC ID' },
                item_id: { type: 'number', description: 'Item to sell' },
                quantity: { type: 'number', description: 'Quantity to sell (default 1)' },
                character_id: { type: 'number', description: 'Selling character ID (defaults to campaign character)' },
            },
            required: ['npc_id', 'item_id'],
        },
    },
    {
        name: 'restock_merchant',
        description: 'Sets the inventory for an NPC merchant, replacing any existing stock.',
        input_schema: {
            type: 'object' as const,
            properties: {
                npc_id: { type: 'number', description: 'Merchant NPC ID' },
                items: {
                    type: 'array',
                    description: 'Items to stock',
                    items: {
                        type: 'object' as const,
                        properties: {
                            itemId: { type: 'number' as const },
                            quantity: { type: 'number' as const },
                            priceInGold: { type: 'number' as const },
                        },
                    },
                },
            },
            required: ['npc_id', 'items'],
        },
    },
    {
        name: 'place_item',
        description: 'Places an item at an overworld location. Use when an NPC leaves something behind or the DM places environmental treasure. Stacks quantity if the item is already there.',
        input_schema: {
            type: 'object' as const,
            properties: {
                location_id: { type: 'number', description: 'Location where the item is placed' },
                item_id: { type: 'number', description: 'ID of the item to place (must exist in campaign)' },
                quantity: { type: 'number', description: 'Quantity to place (default 1)' },
                note: { type: 'string', description: 'Short description of how the item came to be here (optional)' },
            },
            required: ['location_id', 'item_id'],
        },
    },
    {
        name: 'take_item',
        description: 'Transfers an item from an overworld location into the active character\'s inventory. Use when the player picks up a placed item.',
        input_schema: {
            type: 'object' as const,
            properties: {
                location_id: { type: 'number', description: 'Location the item is at' },
                item_id: { type: 'number', description: 'Item to take' },
                quantity: { type: 'number', description: 'Quantity to take (default 1)' },
            },
            required: ['location_id', 'item_id'],
        },
    },
    // ── Leveling ──────────────────────────────────────────────────────────────
    {
        name: 'trigger_level_up',
        description: 'Signals that the character has earned enough XP to level up and should choose improvements.',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_id: { type: 'number', description: 'Character leveling up' },
            },
        },
    },
    {
        name: 'apply_level_up',
        description: 'Applies chosen level-up improvements (ability scores or feat, hit points).',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_id: { type: 'number', description: 'Character leveling up' },
                ability_score_improvements: { type: 'object' as const, description: 'Map of ability name to +1/+2 increase' },
                feat: { type: 'string', description: 'Feat name if chosen instead of ASI (optional)' },
                hit_points_rolled: { type: 'number', description: 'HP rolled on the hit die' },
            },
            required: ['hit_points_rolled'],
        },
    },
    {
        name: 'use_spell_slot',
        description: 'Expends a spell slot of the given level.',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_id: { type: 'number', description: 'Spellcaster character' },
                level: { type: 'number', description: 'Spell slot level (1–9)' },
            },
            required: ['level'],
        },
    },
    {
        name: 'prepare_spells',
        description: 'Sets the list of prepared spells for the character.',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_id: { type: 'number', description: 'Spellcaster character' },
                spells: { type: 'array', items: { type: 'string' as const }, description: 'Spell names to prepare' },
            },
            required: ['spells'],
        },
    },
    {
        name: 'trigger_spell_prep',
        description: 'Signals that the player must choose prepared spells before freeform play continues.',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_id: { type: 'number', description: 'Character who needs to prepare spells' },
            },
            required: ['character_id'],
        },
    },
    // ── World / NPCs ──────────────────────────────────────────────────────────
    {
        name: 'create_npc',
        description: 'Persists a new named NPC mid-session. Call this the first time any named NPC is introduced, before the narrative continues.',
        input_schema: {
            type: 'object' as const,
            properties: {
                name: { type: 'string', description: 'NPC name' },
                description: { type: 'string', description: 'Brief physical or contextual description (optional)' },
                profession: { type: 'string', description: 'NPC role or occupation (optional)' },
                disposition: { type: 'string', description: 'Attitude toward the player (e.g. "friendly", "hostile") (optional)' },
                personality_traits: { type: 'array', items: { type: 'string' as const }, description: 'Adjectives or phrases describing behaviour (optional)' },
                speech_style: { type: 'string', description: 'Distinctive voice or verbal tics (optional)' },
                core_motivation: { type: 'string', description: 'Primary drive behind all NPC decisions (optional)' },
                agenda: { type: 'string', description: 'What the NPC is currently trying to achieve (optional)' },
                current_location_id: { type: 'number', description: 'Location where the NPC is anchored (optional)' },
            },
            required: ['name'],
        },
    },
    {
        name: 'update_npc',
        description: 'Partially updates an existing NPC\'s fields.',
        input_schema: {
            type: 'object' as const,
            properties: {
                npc_id: { type: 'number', description: 'NPC to update' },
                updates: {
                    type: 'object' as const,
                    description: 'Fields to update',
                    properties: {
                        alive: { type: 'boolean' as const },
                        disposition: { type: 'string' as const },
                        currentLocationId: { type: 'number' as const },
                        agenda: { type: 'string' as const },
                        nextTickInGameDay: { type: 'number' as const },
                    },
                },
            },
            required: ['npc_id', 'updates'],
        },
    },
    {
        name: 'add_to_party',
        description: 'Makes an NPC a companion who travels with the player.',
        input_schema: {
            type: 'object' as const,
            properties: {
                npc_id: { type: 'number', description: 'NPC to add to the party' },
            },
            required: ['npc_id'],
        },
    },
    {
        name: 'remove_from_party',
        description: 'Removes an NPC companion from the party.',
        input_schema: {
            type: 'object' as const,
            properties: {
                npc_id: { type: 'number', description: 'NPC to remove from the party' },
            },
            required: ['npc_id'],
        },
    },
    {
        name: 'update_location_state',
        description: 'Updates the narrative state of a location (e.g. "TENSE", "SAFE", "RUINED").',
        input_schema: {
            type: 'object' as const,
            properties: {
                location_id: { type: 'number', description: 'Location to update' },
                state: { type: 'string', description: 'New narrative state' },
            },
            required: ['location_id', 'state'],
        },
    },
    {
        name: 'shift_faction_disposition',
        description: 'Changes a faction\'s attitude toward the player.',
        input_schema: {
            type: 'object' as const,
            properties: {
                faction_id: { type: 'number', description: 'Faction to update' },
                disposition: { type: 'string', description: 'New disposition (e.g. "hostile", "allied")' },
            },
            required: ['faction_id', 'disposition'],
        },
    },
    {
        name: 'trigger_world_event',
        description: 'Creates an active world event (crisis, opportunity, or background development).',
        input_schema: {
            type: 'object' as const,
            properties: {
                description: { type: 'string', description: 'What is happening' },
                location_id: { type: 'number', description: 'Relevant location ID (optional)' },
                deadline_in_game_date: { type: 'string', description: 'In-game date by which it must be resolved (optional)' },
                source: { type: 'string', description: 'Event source: PLAYER_ACTION, WORLD_TICK, ANTAGONIST, CATASTROPHE' },
            },
            required: ['description', 'source'],
        },
    },
    {
        name: 'resolve_world_event',
        description: 'Marks an active world event as resolved and records the outcome.',
        input_schema: {
            type: 'object' as const,
            properties: {
                world_event_id: { type: 'number', description: 'Event to resolve' },
                outcome: { type: 'string', description: 'Narrative outcome of the event' },
            },
            required: ['world_event_id', 'outcome'],
        },
    },
    {
        name: 'advance_antagonist_stage',
        description: 'Marks the current antagonist plan stage as complete and moves to the next stage.',
        input_schema: { type: 'object' as const, properties: {} },
    },
    {
        name: 'record_lore',
        description: 'Appends a discovered fact to the campaign\'s permanent lore document.',
        input_schema: {
            type: 'object' as const,
            properties: {
                fact: { type: 'string', description: 'One-sentence lore fact to record' },
            },
            required: ['fact'],
        },
    },
    // ── Dungeon ───────────────────────────────────────────────────────────────
    {
        name: 'enter_dungeon',
        description: 'Enters a dungeon, placing the player at the entry room.',
        input_schema: {
            type: 'object' as const,
            properties: {
                dungeon_id: { type: 'number', description: 'Dungeon to enter' },
            },
            required: ['dungeon_id'],
        },
    },
    {
        name: 'move_to_room',
        description: 'Moves the player to an adjacent dungeon room.',
        input_schema: {
            type: 'object' as const,
            properties: {
                room_id: { type: 'number', description: 'Destination room ID' },
            },
            required: ['room_id'],
        },
    },
    {
        name: 'exit_dungeon',
        description: 'Exits the current dungeon and returns the player to the overworld.',
        input_schema: { type: 'object' as const, properties: {} },
    },
    {
        name: 'spawn_encounter',
        description: 'Spawns a combat encounter in the current dungeon room.',
        input_schema: {
            type: 'object' as const,
            properties: {
                room_id: { type: 'number', description: 'Room to spawn in (optional, defaults to current)' },
                dungeon_id: { type: 'number', description: 'Dungeon ID (optional)' },
                from_table: { type: 'boolean', description: 'Use the room\'s encounter table (optional)' },
            },
        },
    },
    {
        name: 'update_room_state',
        description: 'Updates the exploration state of a dungeon room.',
        input_schema: {
            type: 'object' as const,
            properties: {
                room_id: { type: 'number', description: 'Room to update' },
                state: { type: 'string', description: 'New room state (e.g. "EXPLORED", "CLEARED")' },
            },
            required: ['room_id', 'state'],
        },
    },
    {
        name: 'add_room_item',
        description: 'Adds an item to a dungeon room for the player to find. Only valid during an active dungeon session.',
        input_schema: {
            type: 'object' as const,
            properties: {
                room_id: { type: 'number', description: 'Room to place the item in' },
                item_id: { type: 'number', description: 'Item to place' },
                quantity: { type: 'number', description: 'Quantity (default 1)' },
                container_name: { type: 'string', description: 'Container description (e.g. "chest", "corpse") (optional)' },
            },
            required: ['room_id', 'item_id'],
        },
    },
    {
        name: 'loot_room',
        description: 'Transfers an item from a dungeon room into the character\'s inventory. Only valid during an active dungeon session.',
        input_schema: {
            type: 'object' as const,
            properties: {
                room_id: { type: 'number', description: 'Room being looted' },
                item_id: { type: 'number', description: 'Item to loot' },
                quantity: { type: 'number', description: 'Quantity to loot (default 1)' },
            },
            required: ['room_id', 'item_id'],
        },
    },
    // ── Memory ────────────────────────────────────────────────────────────────
    {
        name: 'record_memory',
        description: 'Persists a memory fact about an entity (character, NPC, location, faction, quest, world).',
        input_schema: {
            type: 'object' as const,
            properties: {
                subject_type: { type: 'string', description: 'Subject type: CHARACTER, NPC, LOCATION, FACTION, QUEST, WORLD' },
                content: { type: 'string', description: 'Memory statement to persist' },
                subject_id: { type: 'string', description: 'Subject entity ID (optional)' },
            },
            required: ['subject_type', 'content'],
        },
    },
    {
        name: 'search_memories',
        description: 'Performs a semantic search over recorded memory facts.',
        input_schema: {
            type: 'object' as const,
            properties: {
                query: { type: 'string', description: 'Search query' },
                subject_type: { type: 'string', description: 'Filter by subject type (optional)' },
                subject_id: { type: 'string', description: 'Filter by subject ID (optional)' },
                limit: { type: 'number', description: 'Max results (default 5)' },
            },
            required: ['query'],
        },
    },
    {
        name: 'record_npc_memory',
        description: 'Records a notable event or learned fact from an NPC\'s perspective for future recall.',
        input_schema: {
            type: 'object' as const,
            properties: {
                npc_id: { type: 'number', description: 'NPC who witnessed or learned the information' },
                content: { type: 'string', description: 'Concise memory statement to persist for that NPC' },
            },
            required: ['npc_id', 'content'],
        },
    },
    // ── Quests ────────────────────────────────────────────────────────────────
    {
        name: 'create_quest',
        description: 'Creates a new quest with objectives. Can also create associated NPCs, locations, items, and world events in one call.',
        input_schema: {
            type: 'object' as const,
            properties: {
                title: { type: 'string', description: 'Quest title' },
                description: { type: 'string', description: 'Quest summary' },
                dungeon_id: { type: 'number', description: 'Associated dungeon (optional)' },
                agenda_impact: { type: 'string', description: 'How completing this quest shifts the world (optional)' },
                reward_narrative: { type: 'string', description: 'Narrative description of the reward (optional)' },
                reward_xp: { type: 'number', description: 'XP reward (optional)' },
                reward_gold: { type: 'number', description: 'Gold reward (optional)' },
                objectives: { type: 'array', description: 'Quest objectives', items: { type: 'object' as const } },
                npcs: { type: 'array', description: 'NPCs to create alongside the quest', items: { type: 'object' as const } },
                locations: { type: 'array', description: 'Locations to create alongside the quest', items: { type: 'object' as const } },
                items: { type: 'array', description: 'Items to create alongside the quest', items: { type: 'object' as const } },
                world_events: { type: 'array', description: 'World events to create alongside the quest', items: { type: 'object' as const } },
            },
            required: ['title', 'description', 'objectives'],
        },
    },
    {
        name: 'complete_quest',
        description: 'Marks a quest as completed and awards XP and gold rewards.',
        input_schema: {
            type: 'object' as const,
            properties: {
                quest_id: { type: 'number', description: 'Quest to complete' },
            },
            required: ['quest_id'],
        },
    },
    {
        name: 'fail_quest',
        description: 'Marks a quest as failed.',
        input_schema: {
            type: 'object' as const,
            properties: {
                quest_id: { type: 'number', description: 'Quest to fail' },
            },
            required: ['quest_id'],
        },
    },
    {
        name: 'update_quest_objective',
        description: 'Updates the status of a specific quest objective.',
        input_schema: {
            type: 'object' as const,
            properties: {
                objective_id: { type: 'number', description: 'Objective to update' },
                status: { type: 'string', description: 'New status: PENDING, COMPLETED, FAILED' },
            },
            required: ['objective_id', 'status'],
        },
    },
    // ── Campaign ──────────────────────────────────────────────────────────────
    {
        name: 'end_campaign',
        description: 'Ends the campaign permanently. Use only when the story reaches a definitive conclusion or the character dies in PERMADEATH mode.',
        input_schema: {
            type: 'object' as const,
            properties: {
                campaign_id: { type: 'number', description: 'Campaign to end' },
                reason: { type: 'string', description: 'Why the campaign is ending' },
                epitaph: { type: 'string', description: 'Final narrative epitaph to display' },
            },
            required: ['campaign_id', 'reason', 'epitaph'],
        },
    },
];
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Orchestrates a single DM turn: persists player input, assembles prompt with
 * cache-control breakpoints, streams from Claude, dispatches tool calls through
 * ToolRegistry, accumulates narrative, and persists the final DM_NARRATIVE event.
 *
 * Finalization runs in a `finally` block so events are persisted even on SSE disconnect.
 */
@Injectable()
export class DmOrchestrator {
    private readonly logger = new Logger(DmOrchestrator.name);

    /* eslint-disable @typescript-eslint/naming-convention */
    private static readonly toolSuccessStatuses: Record<string, string> = {
        trigger_level_up: 'LEVEL_UP_PENDING',
        trigger_spell_prep: 'SPELL_PREP_PENDING',
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    private readonly anthropic: Anthropic;

    private readonly dmModel: string;

    constructor(
        private readonly sessionService: SessionService,
        private readonly contextLoader: ContextLoader,
        private readonly innerMonologueService: InnerMonologueService,
        private readonly toolRegistry: ToolRegistry,
        private readonly streamPublisher: StreamPublisher,
        private readonly em: EntityManager,
        private readonly npcMemoryService: NpcMemoryService,
        private readonly configService: ConfigService<EnvironmentConfig>,
    ) {
        this.anthropic = new Anthropic({
            apiKey: this.configService.getOrThrow('ANTHROPIC_API_KEY'),
        });
        this.dmModel = this.configService.getOrThrow('LLM_DM_MODEL');
    }

    /**
     * Runs a full DM turn for a session. Call without awaiting — results are published
     * via StreamPublisher. Handles multi-step tool-use loops until the model returns
     * a final end_turn response.
     */
    async runTurn(sessionId: number, playerInput: string): Promise<void> {
        const turnStartedAt = Date.now();
        this.logger.log(`DM turn start: sessionId=${sessionId}`);

        await this.sessionService.appendEvent(sessionId, EventType.PLAYER_INPUT, { text: playerInput });

        const session = await this.sessionService.findSessionWithCampaign(sessionId);
        const campaignId = session.campaign.id;
        const sceneType = session.sceneType;
        const npcMemories = await this.loadSceneNpcMemories(campaignId, playerInput);

        const baseBlock = this.contextLoader.loadBaseBlock(sceneType);
        const campaignBlock = await this.contextLoader.loadCampaignBlock(campaignId);
        const character = await this.em.findOne(Character, { campaign: { id: campaignId } } as never);
        const worldBlock = await this.contextLoader.loadWorldBlock(campaignId, character?.id, npcMemories);
        const historyMessages = await this.contextLoader.loadHistoryBlock(sessionId);

        this.logger.log(`Context loaded: sessionId=${sessionId} sceneType=${sceneType} historyMessages=${historyMessages.length} npcMemories=${npcMemories ? 'yes' : 'no'}`);

        // historyMessages includes the player input we just persisted as the last item;
        // exclude it so we can supply it as the live uncached user message.
        const priorHistory = historyMessages.slice(0, -1);

        // Mark the history/live-input boundary for cache breakpoint 4
        if (priorHistory.length > 0) {
            const last = priorHistory[priorHistory.length - 1];
            if (typeof last.content === 'string') {
                /* eslint-disable @typescript-eslint/naming-convention */
                priorHistory[priorHistory.length - 1] = {
                    ...last,
                    content: [{ type: 'text', text: last.content, cache_control: { type: 'ephemeral' } }],
                };
                /* eslint-enable @typescript-eslint/naming-convention */
            }
        }

        /* eslint-disable @typescript-eslint/naming-convention */
        const systemBlocks: Anthropic.TextBlockParam[] = [
            { type: 'text', text: baseBlock, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: campaignBlock, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: worldBlock, cache_control: { type: 'ephemeral' } },
        ];
        /* eslint-enable @typescript-eslint/naming-convention */

        const messages: Anthropic.MessageParam[] = [
            ...priorHistory,
            { role: 'user', content: playerInput },
        ];

        const narrativeRef = { text: '' };
        const loopIterations = { count: 0 };

        try {
            await this.runToolLoop(sessionId, systemBlocks, messages, narrativeRef, loopIterations);
        } catch (error) {
            const errorClass = error instanceof Error ? error.constructor.name : 'UnknownError';
            this.logger.error(`DM turn failed: sessionId=${sessionId} errorClass=${errorClass}`);
        } finally {
            if (narrativeRef.text) {
                await this.sessionService.appendEvent(sessionId, EventType.DM_NARRATIVE, {
                    narrative: narrativeRef.text,
                });
            }

            const duration = Date.now() - turnStartedAt;
            this.logger.log(`DM turn complete: sessionId=${sessionId} loopIterations=${loopIterations.count} duration=${duration}ms`);

            this.streamPublisher.publish(sessionId, { type: DmStreamChunkType.DONE });
            await this.innerMonologueService.runIfApplicable(sessionId, sceneType, narrativeRef.text);
        }
    }

    /**
     * Recursive tool loop: streams model output, dispatches any tool calls, and
     * continues until the model returns stop_reason = 'end_turn'.
     */
    private async runToolLoop(
        sessionId: number,
        system: Anthropic.TextBlockParam[],
        messages: Anthropic.MessageParam[],
        narrativeRef: { text: string },
        loopIterations: { count: number },
    ): Promise<void> {
        loopIterations.count++;
        const streamStartedAt = Date.now();
        this.logger.log(`Anthropic stream start: sessionId=${sessionId} model=${this.dmModel} iteration=${loopIterations.count}`);

        /* eslint-disable @typescript-eslint/naming-convention */
        const stream = this.anthropic.messages.stream({
            model: this.dmModel,
            max_tokens: 2048,
            system,
            tools: DM_TOOLS,
            messages,
        });
        /* eslint-enable @typescript-eslint/naming-convention */

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                narrativeRef.text += event.delta.text;
                this.streamPublisher.publish(sessionId, {
                    type: DmStreamChunkType.NARRATIVE_CHUNK,
                    text: event.delta.text,
                });
            }
        }

        const finalMessage = await stream.finalMessage();
        const streamDuration = Date.now() - streamStartedAt;
        this.logger.log(`Anthropic stream complete: sessionId=${sessionId} provider=anthropic model=${this.dmModel} stopReason=${finalMessage.stop_reason} duration=${streamDuration}ms`);

        if (finalMessage.stop_reason !== 'tool_use') {
            return;
        }

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of finalMessage.content) {
            if (block.type !== 'tool_use') {
                continue;
            }

            if (block.name === 'suggest_actions') {
                const suggestActionsResult = this.handleSuggestActions(
                    sessionId,
                    block.input as Record<string, unknown>,
                );

                this.logger.log(`Tool dispatch: sessionId=${sessionId} tool=${block.name} success=${suggestActionsResult.success}`);

                await this.sessionService.appendEvent(sessionId, EventType.TOOL_CALL, {
                    toolUseId: block.id,
                    toolName: block.name,
                    toolInput: block.input,
                    toolResult: suggestActionsResult,
                });

                continue;
            }

            const result = await this.toolRegistry.dispatch(
                sessionId,
                block.name,
                block.input as Record<string, unknown>,
            );

            this.logger.log(`Tool dispatch: sessionId=${sessionId} tool=${block.name} success=${(result as { success?: boolean }).success ?? 'unknown'}`);

            await this.sessionService.appendEvent(sessionId, EventType.TOOL_CALL, {
                toolUseId: block.id,
                toolName: block.name,
                toolInput: block.input,
                toolResult: result,
            });

            this.streamPublisher.publish(sessionId, {
                type: DmStreamChunkType.TOOL_RESULT,
                toolName: block.name,
                toolResult: result,
            });

            const status = this.getToolSuccessStatus(block.name, result);
            if (status) {
                this.streamPublisher.publish(sessionId, {
                    type: DmStreamChunkType.STATUS,
                    status,
                });
            }

            /* eslint-disable @typescript-eslint/naming-convention */
            toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result),
            });
            /* eslint-enable @typescript-eslint/naming-convention */
        }

        if (toolResults.length === 0) {
            return;
        }

        await this.runToolLoop(sessionId, system, [
            ...messages,
            { role: 'assistant', content: finalMessage.content },
            { role: 'user', content: toolResults },
        ], narrativeRef, loopIterations);
    }

    /**
     * Loads relevant NPC memories for the current campaign location, capped across all NPCs.
     */
    private async loadSceneNpcMemories(campaignId: number, playerInput: string): Promise<string | undefined> {
        const campaign = await this.em.findOne(Campaign, { id: campaignId });
        if (!campaign?.currentLocationId) {
            return undefined;
        }

        const limit = this.configService.get<number>('NPC_MEMORY_SCENE_LIMIT', 10) ?? 10;
        // eslint-disable-next-line unicorn/no-array-method-this-argument
        const npcs = await this.em.find(Npc, {
            campaignId,
            currentLocationId: campaign.currentLocationId,
        });
        if (npcs.length === 0) {
            return undefined;
        }

        const lines: string[] = [];
        for (const npc of npcs) {
            if (lines.length >= limit) {
                break;
            }

            const memories = await this.npcMemoryService.searchNpcMemories(
                npc.id,
                playerInput,
                limit - lines.length,
            );

            for (const memory of memories) {
                lines.push(`${npc.name} remembers: ${memory.content}`);
                if (lines.length >= limit) {
                    break;
                }
            }
        }

        return lines.length > 0 ? lines.join('\n') : undefined;
    }

    /**
     * Converts `suggest_actions` into one chunk per action without replaying a tool
     * result into the model. Invalid payloads return a structured error envelope.
     */
    private handleSuggestActions(
        sessionId: number,
        input: Record<string, unknown>,
    ): { success: boolean; data?: { count: number }; errorCode?: string; message?: string } {
        const rawActions = input.actions;
        if (!Array.isArray(rawActions)) {
            return {
                success: false,
                errorCode: 'INVALID_ACTIONS',
                message: 'suggest_actions requires an actions array',
            };
        }

        const actions = rawActions.filter((action): action is string => typeof action === 'string')
            .map((action) => action.trim())
            .filter((action) => action.length > 0);

        if (actions.length === 0) {
            return {
                success: false,
                errorCode: 'EMPTY_ACTIONS',
                message: 'suggest_actions requires at least one non-empty action',
            };
        }

        for (const action of actions) {
            this.streamPublisher.publish(sessionId, {
                type: DmStreamChunkType.SUGGESTED_ACTION,
                action,
            });
        }

        return { success: true, data: { count: actions.length } };
    }

    /** Emits stream-only follow-up statuses for successful tool dispatches that pause freeform play. */
    private getToolSuccessStatus(
        toolName: string,
        result: { success?: boolean },
    ): string | undefined {
        if (result.success !== true) {
            return undefined;
        }

        return DmOrchestrator.toolSuccessStatuses[toolName];
    }
}
