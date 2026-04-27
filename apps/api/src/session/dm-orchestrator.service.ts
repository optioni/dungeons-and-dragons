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
import { PlayerVisibleEventMapper } from './player-visible-event.mapper.js';
import { EventType } from './session.enums.js';
import { SessionService } from './session.service.js';
import { StreamPublisher } from './stream-publisher.service.js';

/* eslint-disable @typescript-eslint/naming-convention */
/** All tool definitions exposed to the DM model. */
const DM_TOOLS: Anthropic.Tool[] = [
    // ── Utility ─────────────────────────────────────────────────────────────
    {
        name: 'set_scene_type',
        description: 'Changes the active scene type and loads the appropriate narrative prompt module. When to use: (1) entering a new location/scenario type (exploration → combat, combat → settlement, settlement → rest), (2) after long_rest completes (MUST transition out of REST), (3) player explicitly chooses a different activity. Call this to shift narrative tone and narrative guidance.',
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
        description: 'Presents action options to the player at a decision point. Include pending_check if an action will trigger a skill/ability check, telegraphing the DC so the player knows the stakes before committing. Use when multiple valid paths exist (talk to NPC, sneak past guards, fight, negotiate).',
        input_schema: {
            type: 'object' as const,
            properties: {
                actions: { type: 'array', items: { type: 'string' as const }, description: 'Concise action labels (3–5 options)' },
                pending_check: {
                    type: 'object' as const,
                    description: 'Optional upcoming check to telegraph to the player',
                    properties: {
                        skill: { type: 'string' as const, description: 'Skill name (e.g. "Persuasion") — mutually exclusive with ability' },
                        ability: { type: 'string' as const, description: 'Ability name (STR/DEX/CON/INT/WIS/CHA) — mutually exclusive with skill' },
                        dc: { type: 'number' as const, description: 'Difficulty class for the anticipated check' },
                    },
                    required: ['dc'],
                },
            },
            required: ['actions'],
        },
    },
    // ── Dice ─────────────────────────────────────────────────────────────────
    {
        name: 'roll_dice',
        description: 'Rolls a dice expression for NPC actions, random events, or other mechanics outside character skill checks. Examples: "2d6" for wandering monster check, "1d20+5" for an NPC attack roll, "3d6" for random encounter damage. Use check_skill/check_ability for character-initiated rolls with DCs.',
        input_schema: {
            type: 'object' as const,
            properties: {
                expression: { type: 'string', description: 'Dice expression such as "1d20", "2d6+3", "4d6"' },
            },
            required: ['expression'],
        },
    },
    {
        name: 'check_skill',
        description: 'Rolls a skill check against a DC. When to use: only when the outcome is uncertain AND meaningful to the story. Examples: Perception to detect a hidden enemy, Persuasion to convince an NPC, Stealth to sneak past guards. Do NOT use for: trivial tasks, guaranteed successes, or pure narrative flavor. Always announce the DC before the player commits to the action.',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_id: { type: 'number', description: 'Character performing the check' },
                skill: { type: 'string', description: 'Skill name (e.g. "Perception", "Stealth", "Persuasion")' },
                dc: { type: 'number', description: 'Difficulty class to beat' },
            },
            required: ['character_id', 'skill', 'dc'],
        },
    },
    {
        name: 'check_ability',
        description: 'Rolls an ability check against a DC (no proficiency bonus). When to use: for raw ability tests (strength to break something, dexterity to catch something, intelligence to recall lore, wisdom to sense danger). Follow the same rule as check_skill: only when outcome is uncertain and meaningful. Do NOT use for trivial or guaranteed outcomes.',
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
        description: 'Initiates combat: rolls initiative for all participants and sets combat state. Call this the moment combat begins (enemy appears, player draws weapon, ambush triggers).',
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
        description: 'Moves to the next combatant in initiative order. Call after a combatant completes their turn.',
        input_schema: { type: 'object' as const, properties: {} },
    },
    {
        name: 'apply_damage',
        description: 'Applies damage to a combatant after a hit lands. Always include damage_type (slashing, piercing, bludgeoning, fire, cold, acid, poison, radiant, necrotic, psychic, thunder, force, etc.).',
        input_schema: {
            type: 'object' as const,
            properties: {
                target_id: { type: 'string', description: '"character" or the NPC encounter key' },
                amount: { type: 'number', description: 'HP to subtract' },
                damage_type: { type: 'string', description: 'Damage type (slashing, fire, poison, necrotic, etc.)' },
            },
            required: ['target_id', 'amount', 'damage_type'],
        },
    },
    {
        name: 'heal',
        description: 'Restores HP from a healing spell, potion, or ability. Capped at max HP. Use during combat for healing spells/potions; use outside combat to represent natural rest recovery via take_short_rest or take_long_rest.',
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
        description: 'Applies a D&D 5e condition (Poisoned, Stunned, Restrained, Blinded, Charmed, etc.) from spells, abilities, or environmental effects. Conditions modify future rolls and actions.',
        input_schema: {
            type: 'object' as const,
            properties: {
                target_id: { type: 'string', description: '"character" or the NPC encounter key' },
                condition: { type: 'string', description: 'Condition name (Poisoned, Stunned, Restrained, Blinded, Charmed, Frightened, Prone, etc.)' },
            },
            required: ['target_id', 'condition'],
        },
    },
    {
        name: 'remove_condition',
        description: 'Removes a condition from a combatant when a spell ends it, an action removes it, or a save succeeds.',
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
        description: 'Rolls a death saving throw (d20 + 0) when the character is at 0 HP and making death saves. Success: +1 success counter; Failure: +1 failure counter. 3 successes = stabilized; 3 failures = dead.',
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
        description: 'Stabilizes a downed character (at 0 HP) by stopping death saves and setting HP to 1. Use when a healing spell reaches them, an ally uses Healer\'s Kit, or another stabilization ability triggers.',
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
        description: 'Kills a character instantly from massive environmental damage (falling from a cliff, lava, crushed by a collapsing structure). Use when damage in a single hit exceeds max HP by 10+.',
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
        description: 'Ends combat when all enemies are defeated, fled, surrendered, or the encounter is resolved. Clears combat state and resets initiative.',
        input_schema: { type: 'object' as const, properties: {} },
    },
    // ── Rest ─────────────────────────────────────────────────────────────────
    {
        name: 'take_short_rest',
        description: 'Takes a 1-hour short rest: player spends hit dice to recover HP, short-rest ability recharges trigger. No day advance; no world tick. Use when player wants to rest briefly during the same day (after combat, mid-adventure).',
        input_schema: {
            type: 'object' as const,
            properties: {
                hit_dice_to_spend: { type: 'number', description: 'Number of hit dice to spend (default 1)' },
            },
        },
    },
    {
        name: 'take_long_rest',
        description: 'Takes a long rest: restores HP/spell slots, advances the in-game day, triggers world tick and diary writing. When to use: when the player explicitly says they rest for 8 hours (only mechanism for day transitions). After this returns, you MUST call set_scene_type to transition OUT of REST into EXPLORATION/SOCIAL/SETTLEMENT. The diary summarizes the day\'s events—ensure your narration before this call is rich with conflict, discovery, and change.',
        input_schema: { type: 'object' as const, properties: {} },
    },
    // ── Travel ───────────────────────────────────────────────────────────────
    {
        name: 'travel_to',
        description: 'Moves the player to a previously discovered location (one already in the campaign database). May trigger a random encounter en route. Call when player chooses to travel or when moving between discovered locations.',
        input_schema: {
            type: 'object' as const,
            properties: {
                location_id: { type: 'number', description: 'ID of the target location (must be previously discovered or created)' },
            },
            required: ['location_id'],
        },
    },
    {
        name: 'discover_location',
        description: 'Marks a pre-seeded location as discovered. Use ONLY for locations with known IDs from campaign setup (e.g., major towns, dungeons, landmarks seeded during character creation). Do NOT use for places you invent on the fly—use create_location instead. Always provide source (EXPLORATION, NPC, MAP, QUEST, PLAYER_ACTION).',
        input_schema: {
            type: 'object' as const,
            properties: {
                location_id: { type: 'number', description: 'ID of the pre-seeded location to discover' },
                source: { type: 'string', description: 'Discovery source: EXPLORATION, NPC, MAP, QUEST, PLAYER_ACTION, WORLD_TICK, SETUP' },
                source_id: { type: 'number', description: 'ID of the source entity (optional)' },
            },
            required: ['location_id', 'source'],
        },
    },
    {
        name: 'create_location',
        description: 'Creates a named location on the fly and auto-discovers it. When to use: the FIRST time you introduce a distinct named place (a forest shrine, a ruined tower, an inn, a cave system). When NOT to use: for pre-seeded locations with known IDs (use discover_location instead). Always provide parent_location_id for sub-locations (inn within a town, shop within a settlement). Example: "You reach the Shattered Well, an ancient stone circle. [create_location: name=Shattered Well, description=Ancient stone circle half-swallowed by moss, parent_location_id=<settlement>] Inside, you find..."',
        input_schema: {
            type: 'object' as const,
            properties: {
                name: { type: 'string', description: 'Location name' },
                description: { type: 'string', description: 'One-sentence description' },
                current_state: { type: 'string', description: 'Current narrative state (SAFE, TENSE, RUINED, etc.) (optional)' },
                connected_location_ids: { type: 'array', items: { type: 'number' as const }, description: 'IDs of adjacent locations (optional)' },
                parent_location_id: { type: 'number', description: 'Parent settlement ID for sub-locations (optional)' },
            },
            required: ['name', 'description'],
        },
    },
    // ── Items ─────────────────────────────────────────────────────────────────
    {
        name: 'create_item',
        description: 'Persists a named item in the campaign registry. When to use: the FIRST time you mention an item the player finds, receives, or loots (a rusty sword, a leather journal, a healing potion). When NOT to use: unnamed ambient objects (decorations, generic supplies, scenery). Always call before give_item or place_item. Example: "You find a brass key in the chest. [create_item: name=Brass Key, description=An old brass key with intricate filigree, item_type=QUEST] You pocket it."',
        input_schema: {
            type: 'object' as const,
            properties: {
                name: { type: 'string', description: 'Item name' },
                description: { type: 'string', description: 'Item description' },
                item_type: { type: 'string', description: 'Item type (WEAPON, ARMOR, POTION, MISC, MAGIC, QUEST, DOCUMENT, CONSUMABLE, etc.)' },
                weight: { type: 'number', description: 'Weight in lbs (optional)' },
                value: { type: 'number', description: 'Value in gold pieces (optional)' },
                srd_equipment_id: { type: 'number', description: 'SRD equipment reference ID (optional)' },
            },
            required: ['name', 'description', 'item_type'],
        },
    },
    {
        name: 'give_item',
        description: 'Transfers an item from the campaign registry into a character or NPC inventory. Always call after create_item. Specify either to_character_id or to_npc_id (not both).',
        input_schema: {
            type: 'object' as const,
            properties: {
                item_id: { type: 'number', description: 'Item ID to give (must exist in campaign)' },
                quantity: { type: 'number', description: 'Quantity to give (default 1)' },
                to_character_id: { type: 'number', description: 'Character receiving the item' },
                to_npc_id: { type: 'number', description: 'NPC receiving the item' },
            },
            required: ['item_id'],
        },
    },
    {
        name: 'equip_item',
        description: 'Equips a character item to a specific slot (MAIN_HAND, OFF_HAND, ARMOR, ACCESSORY). Use when character equips a weapon, dons armor, or puts on a ring.',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_item_id: { type: 'number', description: 'CharacterItem row ID' },
                slot: { type: 'string', description: 'Equipment slot (MAIN_HAND, OFF_HAND, ARMOR, ACCESSORY)' },
            },
            required: ['character_item_id', 'slot'],
        },
    },
    {
        name: 'unequip_item',
        description: 'Unequips a character item from its equipped slot. Use when character removes armor, drops a weapon, or takes off an accessory.',
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
        description: 'Character purchases an item from an NPC merchant—deducts gold from character, item goes to inventory. Use in SETTLEMENT scenes during shopping. Handles currency automatically; only specify if merchant price differs from item value.',
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
        description: 'Character sells an item to an NPC merchant—adds gold to character, item leaves inventory. Use in SETTLEMENT scenes during shopping. Merchant determines buyback price.',
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
        description: 'Updates an NPC merchant\'s inventory (stock and prices). Replaces existing stock. Use during world tick to refresh merchant wares or in SETTLEMENT scenes to establish a shop.',
        input_schema: {
            type: 'object' as const,
            properties: {
                npc_id: { type: 'number', description: 'Merchant NPC ID' },
                items: {
                    type: 'array',
                    description: 'Items to stock with quantities and prices',
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
        description: 'Places an item at an overworld location (on ground, on a shelf, left behind by an NPC). Stacks quantity if item is already there. Use when NPCs leave items or DM places environmental treasure.',
        input_schema: {
            type: 'object' as const,
            properties: {
                location_id: { type: 'number', description: 'Location where the item is placed' },
                item_id: { type: 'number', description: 'ID of the item to place (must exist)' },
                quantity: { type: 'number', description: 'Quantity to place (default 1)' },
                note: { type: 'string', description: 'Narrative note (e.g. "left on the altar") (optional)' },
            },
            required: ['location_id', 'item_id'],
        },
    },
    {
        name: 'take_item',
        description: 'Transfers an item from an overworld location into character inventory. Use when player picks up a placed item. Opposite of place_item.',
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
        description: 'Signals character has earned a level: pauses session for player to choose ability score improvements (ASI) or a feat, and roll for HP. Call when character XP reaches threshold.',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_id: { type: 'number', description: 'Character leveling up' },
            },
        },
    },
    {
        name: 'apply_level_up',
        description: 'Applies level-up choices after player selects ASI (ability score improvements) or a feat, and rolls HP on hit die. Call to finalize the level-up.',
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
        description: 'Expends a spell slot when character casts a spell. Always call when a spell is cast to track remaining slots. Use after describing the spell effect.',
        input_schema: {
            type: 'object' as const,
            properties: {
                character_id: { type: 'number', description: 'Spellcaster character' },
                level: { type: 'number', description: 'Spell slot level (1–9, or 0 for cantrips which don\'t consume slots)' },
            },
            required: ['level'],
        },
    },
    {
        name: 'prepare_spells',
        description: 'Sets prepared spells for Wizard/Cleric/Druid characters after long rest. Player chooses spells they can cast. Use after long_rest if character is a preparation-based caster.',
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
        description: 'Signals character must choose prepared spells after long rest (for Wizard/Cleric/Druid). Pauses session until player selects spells.',
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
        description: 'Persists a named NPC immediately after introduction, before the narrative continues. When to use: the FIRST time you introduce a named NPC with personality/role (the tavern keeper, a bandit leader, a lost child). When NOT to use: unnamed background NPCs (generic guards, passing merchants, faceless cultists). Always include current_location_id if known. Example: "Theron steps forward, scarred and wary. [create_npc: name=Theron, profession=scout, disposition=guarded] He eyes you..."',
        input_schema: {
            type: 'object' as const,
            properties: {
                name: { type: 'string', description: 'NPC name' },
                description: { type: 'string', description: 'Brief physical or contextual description (optional)' },
                profession: { type: 'string', description: 'NPC role or occupation (optional)' },
                disposition: { type: 'string', description: 'Attitude toward the player (e.g. "friendly", "hostile", "wary") (optional)' },
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
        description: 'Updates an NPC\'s disposition, location, agenda, or alive status after significant changes (disposition shift from story, NPC dies/recovers, agenda changes, NPC moves locations). Use sparingly—only for material story changes.',
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
        description: 'Makes an NPC a companion who travels with the player, fights in combat, and accompanies them. Suspends NPC\'s world tick agenda. Use when NPC joins the party (romance, quest requirement, voluntary companionship).',
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
        description: 'Removes an NPC companion from the party (leaves voluntarily, dies, betrays player, or quest completes). Resumes NPC\'s world tick agenda.',
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
        description: 'Updates a location\'s narrative state to reflect changes. When to use: when a location\'s condition materially changes (fire spreads, building collapses, area becomes safe, creatures move in). Examples: "BURNING", "RUINED", "OCCUPIED", "SAFE", "HOSTILE", "CURSED". This ensures future visits to the location remember what changed.',
        input_schema: {
            type: 'object' as const,
            properties: {
                location_id: { type: 'number', description: 'Location to update' },
                state: { type: 'string', description: 'New narrative state (e.g. TENSE, SAFE, RUINED, BURNING, OCCUPIED)' },
            },
            required: ['location_id', 'state'],
        },
    },
    {
        name: 'shift_faction_disposition',
        description: 'Changes a faction\'s attitude toward the player when significant events shift their opinion. When to use: player helps a faction (earning favor), harms a faction (incurring wrath), or their actions sway a faction\'s alignment. Examples: helping the Thieves\' Guild with a heist, destroying a cult\'s plans, brokering peace between enemies. This creates lasting world consequences.',
        input_schema: {
            type: 'object' as const,
            properties: {
                faction_id: { type: 'number', description: 'Faction to update' },
                disposition: { type: 'string', description: 'New disposition (e.g. "allied", "friendly", "neutral", "hostile", "hunted")' },
            },
            required: ['faction_id', 'disposition'],
        },
    },
    {
        name: 'trigger_world_event',
        description: 'Creates an active world event: a crisis, opportunity, or background development with stakes and deadline. Use when significant world changes happen (bandits blockade a road, plague spreads, faction power shift, natural disaster, antagonist makes a move). Provides context for future adventures.',
        input_schema: {
            type: 'object' as const,
            properties: {
                description: { type: 'string', description: 'What is happening and why it matters' },
                location_id: { type: 'number', description: 'Relevant location ID (optional)' },
                deadline_in_game_date: { type: 'string', description: 'In-game date deadline for resolution (optional)' },
                source: { type: 'string', description: 'Event source: PLAYER_ACTION, WORLD_TICK, ANTAGONIST, CATASTROPHE' },
            },
            required: ['description', 'source'],
        },
    },
    {
        name: 'resolve_world_event',
        description: 'Marks an active world event as resolved and records the outcome. Use when event deadline is met, crisis is averted, opportunity seized, or event no longer relevant.',
        input_schema: {
            type: 'object' as const,
            properties: {
                world_event_id: { type: 'number', description: 'Event to resolve' },
                outcome: { type: 'string', description: 'Narrative outcome (what happened, why it happened, consequences)' },
            },
            required: ['world_event_id', 'outcome'],
        },
    },
    {
        name: 'advance_antagonist_stage',
        description: 'Marks the current antagonist plan stage as complete and advances to the next stage. Use when player completes a major quest related to the antagonist or antagonist\'s plan progresses. Moves the campaign toward climax.',
        input_schema: { type: 'object' as const, properties: {} },
    },
    {
        name: 'record_lore',
        description: 'Appends a discovered fact to the campaign\'s permanent lore document. Use for world-building facts the player discovers (history, secrets, prophecies, discovered truths). Persists for future reference and recap.',
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
        description: 'Enters a dungeon and places player at entry room. Initializes dungeon exploration session. Call when player decides to explore a dungeon.',
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
        description: 'Moves player to an adjacent dungeon room. Call each time player moves (not just describing movement, but actually changing rooms). Updates exploration state.',
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
        description: 'Exits the current dungeon and returns player to the overworld. Use when player leaves dungeon intentionally or is forced out. Call before set_scene_type to EXPLORATION/SETTLEMENT.',
        input_schema: { type: 'object' as const, properties: {} },
    },
    {
        name: 'spawn_encounter',
        description: 'Triggers a combat encounter in a dungeon room. Use when a room contains a keyed encounter or wandering monster emerges. Call spawn_encounter, then set_scene_type to COMBAT.',
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
        description: 'Updates a dungeon room\'s state when it materially changes (EXPLORED, CLEARED, FLOODED, COLLAPSED, etc.). Remembers state for future visits.',
        input_schema: {
            type: 'object' as const,
            properties: {
                room_id: { type: 'number', description: 'Room to update' },
                state: { type: 'string', description: 'New room state (EXPLORED, CLEARED, FLOODED, COLLAPSED, LOCKED, TRAPPED, etc.)' },
            },
            required: ['room_id', 'state'],
        },
    },
    {
        name: 'add_room_item',
        description: 'Places an item in a dungeon room. Use when DM adds treasure, plants loot, or introduces an item the player can find. Only valid during active dungeon session.',
        input_schema: {
            type: 'object' as const,
            properties: {
                room_id: { type: 'number', description: 'Room to place the item in' },
                item_id: { type: 'number', description: 'Item to place (must exist)' },
                quantity: { type: 'number', description: 'Quantity (default 1)' },
                container_name: { type: 'string', description: 'Container description (e.g. "chest", "corpse", "altar") (optional)' },
            },
            required: ['room_id', 'item_id'],
        },
    },
    {
        name: 'loot_room',
        description: 'Transfers an item from a dungeon room to character inventory when player picks it up. Use loot_room (not create_item + give_item) for dungeon loot. Only valid during active dungeon session.',
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
        description: 'Persists a fact about an entity (character detail, location lore, faction belief, item history). Use for world-building facts the DM wants to remember long-term. Searchable via search_memories.',
        input_schema: {
            type: 'object' as const,
            properties: {
                subject_type: { type: 'string', enum: ['character', 'npc', 'location', 'faction', 'item', 'general'], description: 'Subject type' },
                content: { type: 'string', description: 'Memory statement to persist' },
                subject_id: { type: 'string', description: 'Subject entity ID (optional)' },
            },
            required: ['subject_type', 'content'],
        },
    },
    {
        name: 'search_memories',
        description: 'Performs a semantic search over recorded memory facts to retrieve relevant lore, history, or relationships. Use when the DM needs to recall something specific (e.g., "what do we know about the Thieves Guild?").',
        input_schema: {
            type: 'object' as const,
            properties: {
                query: { type: 'string', description: 'Search query (e.g. "Thieves Guild relationships")' },
                subject_type: { type: 'string', enum: ['character', 'npc', 'location', 'faction', 'item', 'general'], description: 'Filter by subject type (optional)' },
                subject_id: { type: 'string', description: 'Filter by subject ID (optional)' },
                limit: { type: 'number', description: 'Max results (default 5)' },
            },
            required: ['query'],
        },
    },
    {
        name: 'record_npc_memory',
        description: 'Records a notable fact or revelation about an NPC (their secret, motivation, relationship, or commitment) so the world remembers it. When to use: when an NPC reveals something important (a secret past, a hidden motivation, a promise made to the player, a betrayal witnessed). When NOT to use: for trivial dialogue or pure flavor. Example: NPC admits "I once served the Crimson Hand." [record_npc_memory: content="Former member of the Crimson Hand, now hunted by them"] This ensures future encounters with that NPC remember what was learned.',
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
        description: 'Creates a quest with objectives. When to use: the MOMENT an NPC offers a task, mission, or quest-like request that the player can accept. Call BEFORE describing objectives, rewards, or stakes in prose. When NOT to use: for pure flavor, rumor, or background information. Example: NPC says "Bring me three herbs." [create_quest immediately] Then narrate quest details. Can also create associated NPCs, locations, items, and world events in one call.',
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
        description: 'Marks a quest as completed, awards XP and gold rewards to character. Call when player accomplishes all quest objectives or quest giver confirms completion.',
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
        description: 'Marks a quest as failed (objective becomes impossible, deadline passed, quest giver dies, player betrays quest giver). Use only when quest can no longer be completed.',
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
        description: 'Updates a quest objective status as player makes progress (PENDING → COMPLETED when objective is achieved, or PENDING → FAILED if objective becomes impossible). Auto-completes quests when all objectives are done.',
        input_schema: {
            type: 'object' as const,
            properties: {
                objective_id: { type: 'number', description: 'Objective to update' },
                status: { type: 'string', description: 'New status: PENDING, COMPLETED, or FAILED' },
            },
            required: ['objective_id', 'status'],
        },
    },
    // ── Campaign ──────────────────────────────────────────────────────────────
    {
        name: 'end_campaign',
        description: 'Permanently ends the campaign: character dies (PERMADEATH mode), story reaches definitive conclusion, or player requests end. Archives the campaign and shows epitaph to player.',
        input_schema: {
            type: 'object' as const,
            properties: {
                campaign_id: { type: 'number', description: 'Campaign to end' },
                reason: { type: 'string', description: 'Reason for ending (e.g. "character death", "quest complete", "player choice")' },
                epitaph: { type: 'string', description: 'Final narrative epitaph to display' },
            },
            required: ['campaign_id', 'reason', 'epitaph'],
        },
    },
    {
        name: 'update_campaign_settings',
        description: 'Adjusts campaign-level settings (e.g., toggle random travel encounters). Use to customize difficulty or pacing.',
        input_schema: {
            type: 'object' as const,
            properties: {
                travel_encounter_enabled: { type: 'boolean', description: 'Enable/disable random travel encounters' },
            },
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
        private readonly playerVisibleEventMapper: PlayerVisibleEventMapper,
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
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : '';
            this.logger.error(
              `DM turn failed: sessionId=${sessionId} sceneType=${sceneType} errorClass=${errorClass} errorMessage=${errorMessage}`,
              errorStack,
            );
            this.logger.debug(`Context: playerInput="${playerInput}" loopIterations=${loopIterations.count}`);
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

        try {
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

            await this.handleToolUseLoop(sessionId, system, finalMessage, messages, narrativeRef, loopIterations);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : '';
            this.logger.error(
              `Anthropic stream failed: sessionId=${sessionId} iteration=${loopIterations.count} errorMessage=${errorMessage}`,
              errorStack,
            );
            throw error;
        }
    }

    private async handleToolUseLoop(
        sessionId: number,
        system: Anthropic.TextBlockParam[],
        finalMessage: Anthropic.Message,
        messages: Anthropic.MessageParam[],
        narrativeRef: { text: string },
        loopIterations: { count: number },
    ): Promise<void> {

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

                if (suggestActionsResult.success) {
                    this.logger.log(`Tool dispatch: sessionId=${sessionId} tool=${block.name} success=true`);
                } else {
                    this.logger.warn(`Tool dispatch failed: sessionId=${sessionId} tool=${block.name} errorCode=${(suggestActionsResult as { errorCode?: string }).errorCode ?? 'unknown'} message=${(suggestActionsResult as { message?: string }).message ?? ''}`);
                }

                await this.sessionService.appendEvent(sessionId, EventType.TOOL_CALL, {
                    toolUseId: block.id,
                    toolName: block.name,
                    toolInput: block.input,
                    toolResult: suggestActionsResult,
                });

                await this.appendPlayerVisibleEvents(
                    sessionId,
                    block.name,
                    block.input as Record<string, unknown>,
                    suggestActionsResult,
                );

                // suggest_actions result must still be included so the assistant message and
                // tool_result array stay in sync — the API rejects mismatched tool_use blocks.
                /* eslint-disable @typescript-eslint/naming-convention */
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: JSON.stringify(suggestActionsResult),
                });
                /* eslint-enable @typescript-eslint/naming-convention */
                continue;
            }

            try {
                const result = await this.toolRegistry.dispatch(
                    sessionId,
                    block.name,
                    block.input as Record<string, unknown>,
                );

                const toolSuccess = (result as { success?: boolean }).success;
                if (toolSuccess !== false) {
                    this.logger.log(`Tool dispatch: sessionId=${sessionId} tool=${block.name} success=true`);
                } else {
                    const errorCode = (result as { errorCode?: string }).errorCode ?? 'unknown';
                    const errorMessage = (result as { message?: string }).message ?? '';
                    this.logger.warn(`Tool dispatch failed: sessionId=${sessionId} tool=${block.name} errorCode=${errorCode} errorMessage=${errorMessage} input=${JSON.stringify(block.input)}`);
                }

                await this.sessionService.appendEvent(sessionId, EventType.TOOL_CALL, {
                    toolUseId: block.id,
                    toolName: block.name,
                    toolInput: block.input,
                    toolResult: result,
                });

                await this.appendPlayerVisibleEvents(
                    sessionId,
                    block.name,
                    block.input as Record<string, unknown>,
                    result,
                );

                const diceRollContent = this.extractDiceRollContent(block.name, block.input as Record<string, unknown>, result);
                if (diceRollContent) {
                    await this.sessionService.appendEvent(sessionId, EventType.DICE_ROLL, diceRollContent);
                }

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
            } catch (toolError) {
                const errorMessage = toolError instanceof Error ? toolError.message : String(toolError);
                const errorStack = toolError instanceof Error ? toolError.stack : '';
                this.logger.error(
                  `Tool dispatch threw exception: sessionId=${sessionId} tool=${block.name} errorMessage=${errorMessage} input=${JSON.stringify(block.input)}`,
                  errorStack,
                );
                // Continue to next tool call rather than breaking - the stream may have more tool calls
            }
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
     * Persists authored player-facing consequences without exposing raw tool payloads.
     */
    private async appendPlayerVisibleEvents(
        sessionId: number,
        toolName: string,
        toolInput: Record<string, unknown>,
        toolResult: { success: boolean; data?: unknown; errorCode?: string; message?: string },
    ): Promise<void> {
        const events = this.playerVisibleEventMapper.map({ toolName, toolInput, toolResult });
        for (const event of events) {
            await this.sessionService.appendEvent(sessionId, EventType.PLAYER_VISIBLE_EVENT, event);
        }
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

        const rawPendingCheck = input.pending_check as { skill?: string; ability?: string; dc?: number } | undefined;
        if (rawPendingCheck && typeof rawPendingCheck.dc === 'number') {
            this.streamPublisher.publish(sessionId, {
                type: DmStreamChunkType.PENDING_CHECK,
                pendingCheck: {
                    skill: typeof rawPendingCheck.skill === 'string' ? rawPendingCheck.skill : undefined,
                    ability: typeof rawPendingCheck.ability === 'string' ? rawPendingCheck.ability : undefined,
                    dc: rawPendingCheck.dc,
                },
            });
        }

        for (const action of actions) {
            this.streamPublisher.publish(sessionId, {
                type: DmStreamChunkType.SUGGESTED_ACTION,
                action,
            });
        }

        return { success: true, data: { count: actions.length } };
    }

    /** Extracts dice roll content for DICE_ROLL event persistence, or null if not applicable. */
    private extractDiceRollContent(
        toolName: string,
        input: Record<string, unknown>,
        result: unknown,
    ): Record<string, unknown> | null {
        const typedResult = result as { success?: boolean; data?: Record<string, unknown>; expression?: string; rolls?: number[]; total?: number };

        if (!typedResult.success) {
            return null;
        }

        if (toolName === 'check_skill') {
            const data = typedResult.data;
            if (!data) return null;
            return {
                tool: 'check_skill',
                skill: input.skill,
                roll: data['roll'],
                modifier: data['modifier'],
                total: data['total'],
                dc: data['dc'],
                passed: data['passed'],
            };
        }

        if (toolName === 'check_ability') {
            const data = typedResult.data;
            if (!data) return null;
            return {
                tool: 'check_ability',
                ability: input.ability,
                roll: data['roll'],
                modifier: data['modifier'],
                total: data['total'],
                dc: data['dc'],
                passed: data['passed'],
            };
        }

        if (toolName === 'roll_dice') {
            return {
                tool: 'roll_dice',
                expression: typedResult.expression ?? input.expression,
                rolls: typedResult.rolls,
                total: typedResult.total,
            };
        }

        return null;
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
