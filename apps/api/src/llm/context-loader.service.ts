import type Anthropic from '@anthropic-ai/sdk';

import { InjectRepository } from '@mikro-orm/nestjs';
import { type EntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { Character } from '../character/entities/character.entity.js';
import { type DiaryEntry } from '../memory/entities/diary-entry.entity.js';
import { MemoryService } from '../memory/memory.service.js';
import { GameEvent } from '../session/entities/game-event.entity.js';
import { GameSession } from '../session/entities/game-session.entity.js';
import { EventType, SceneType } from '../session/session.enums.js';
import { LocationItem } from '../world/entities/location-item.entity.js';
import { NpcItem } from '../world/entities/npc-item.entity.js';
import { Npc } from '../world/entities/npc.entity.js';
import { Location } from '../world/entities/location.entity.js';
import { PromptModuleRegistry } from './prompt-module-registry.service.js';

export type AnthropicMessage = Anthropic.MessageParam;
/* eslint-disable @typescript-eslint/naming-convention */
export interface CacheControlBlock { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }
/* eslint-enable @typescript-eslint/naming-convention */

const BASE_SYSTEM_PROMPT = `You are the Dungeon Master for a solo D&D 5e campaign. Your role is to:
- Narrate the world vividly and impartially
- Run NPCs with distinct personalities and agendas
- Adjudicate D&D 5e rules fairly using the available tool calls
- Return suggested player actions as short action chip labels when appropriate
- Keep the narrative consistent with established campaign lore and world state

Always use tool calls for mechanical actions (dice rolls, stat changes, scene transitions). Never invent mechanical outcomes in prose.
Never end a narrative turn with a prompt asking what the player does or says (e.g. "What does X do?", "What do you say?"). The player decides their own next action.
Never use <hr> or horizontal rule separators in narrative output.
When calling suggest_actions at a moment where the player's action will require a skill or ability check, include pending_check with the anticipated skill or ability name and DC so the player knows what is at stake before they choose.`;

function formatAbilityModifier(score: number): string {
    const modifier = Math.floor((score - 10) / 2);
    return modifier >= 0 ? `+${modifier}` : String(modifier);
}

/**
 * Assembles the four prompt cache blocks for a DM turn, aligned to the four
 * cache breakpoints defined in the prompt caching strategy.
 *
 * Block 1 (most stable): system prompt + tool definitions + scene module
 * Block 2 (campaign-stable): lore document + antagonist plan state
 * Block 3 (session-stable): character sheet + current location + world events
 * Block 4 (turn-stable): prior GameEvents for this session (excluding latest input)
 */
@Injectable()
export class ContextLoader {
    constructor(
        @InjectRepository(Campaign)
        private readonly campaignRepository: EntityRepository<Campaign>,
        @InjectRepository(Character)
        private readonly characterRepository: EntityRepository<Character>,
        @InjectRepository(GameEvent)
        private readonly eventRepository: EntityRepository<GameEvent>,
        @InjectRepository(GameSession)
        private readonly sessionRepository: EntityRepository<GameSession>,
        @InjectRepository(NpcItem)
        private readonly npcItemRepository: EntityRepository<NpcItem>,
        private readonly promptModuleRegistry: PromptModuleRegistry,
        private readonly memoryService: MemoryService,
    ) {}

    /**
     * Block 1: System prompt + tool definitions + active scene module text.
     * Cache-control: ephemeral — invalidated only on scene type change.
     */
    loadBaseBlock(sceneType: SceneType): string {
        const sceneModule = this.promptModuleRegistry.getModule(sceneType);
        return `${BASE_SYSTEM_PROMPT}\n\n${sceneModule}`;
    }

    /**
     * Block 2: Campaign state — lore document and antagonist plan state.
     * Cache-control: ephemeral — invalidated when campaign setup changes.
     */
    async loadCampaignBlock(campaignId: number): Promise<string> {
        const campaign = await this.campaignRepository.getEntityManager().findOneOrFail(Campaign, campaignId);

        const parts: string[] = [];

        if (campaign.loreDocument) {
            parts.push(`## Campaign Lore\n${campaign.loreDocument}`);
        }

        if (campaign.antagonistPlanState) {
            parts.push(`## Antagonist Plan State\n${JSON.stringify(campaign.antagonistPlanState, null, 2)}`);
        }

        if (campaign.inGameDate) {
            parts.push(`## Current In-Game Date\n${campaign.inGameDate}`);
        }

        return parts.join('\n\n') || '## Campaign State\n(No lore document yet)';
    }

    /**
     * Block 3: Character state, merchant inventory for NPCs at current location, and last 7 diary entries.
     * Cache-control: ephemeral — invalidated when character/world changes or a new diary entry is created.
     * Merchant inventory is rebuilt from DB each turn; Anthropic content-based caching handles freshness
     * after buy_item, sell_item, or restock_merchant mutations — no explicit invalidation hook is needed.
     */
    async loadWorldBlock(campaignId: number, characterId?: number, npcMemories?: string): Promise<string> {
        const parts: string[] = [];

        if (characterId) {
            const character = await this.characterRepository.getEntityManager().findOne(
                Character,
                characterId,
                { populate: ['race', 'srdClass'] as never },
            );
            if (character) {
                const abilityLines = [
                    `STR: ${character.abilityScores.STR} (${formatAbilityModifier(character.abilityScores.STR)})`,
                    `DEX: ${character.abilityScores.DEX} (${formatAbilityModifier(character.abilityScores.DEX)})`,
                    `CON: ${character.abilityScores.CON} (${formatAbilityModifier(character.abilityScores.CON)})`,
                    `INT: ${character.abilityScores.INT} (${formatAbilityModifier(character.abilityScores.INT)})`,
                    `WIS: ${character.abilityScores.WIS} (${formatAbilityModifier(character.abilityScores.WIS)})`,
                    `CHA: ${character.abilityScores.CHA} (${formatAbilityModifier(character.abilityScores.CHA)})`,
                ].join(', ');

                const skillProficiencies = Object.entries(character.skillProficiencies)
                    .filter(([, proficiency]) => proficiency !== 'none')
                    .map(([skill, proficiency]) => `${skill} (${proficiency})`)
                    .join(', ');

                parts.push(
                    [
                        '## Character Sheet',
                        `Name: ${character.name}`,
                        `Race: ${character.race.name}`,
                        `Class: ${character.srdClass.name}`,
                        `Level: ${character.level}`,
                        `HP: ${character.hp}/${character.maxHp}`,
                        `AC: ${character.ac}`,
                        `Conditions: ${character.conditions.join(', ') || 'none'}`,
                        `Spell Slots: ${JSON.stringify(character.spellSlots)}`,
                        `Ability Scores: ${abilityLines}`,
                        `Skill Proficiencies: ${skillProficiencies || 'none'}`,
                    ].join('\n'),
                );

                const personalitySections = [
                    character.personalityTraits.length > 0 ? `Traits: ${character.personalityTraits.join('; ')}` : null,
                    character.ideals.length > 0 ? `Ideals: ${character.ideals.join('; ')}` : null,
                    character.bonds.length > 0 ? `Bonds: ${character.bonds.join('; ')}` : null,
                    character.flaws.length > 0 ? `Flaws: ${character.flaws.join('; ')}` : null,
                ].filter((line): line is string => line !== null);

                if (personalitySections.length > 0) {
                    parts.push(`## Personality\n${personalitySections.join('\n')}`);
                }
            }
        }

        const campaign = await this.campaignRepository.getEntityManager().findOne(Campaign, campaignId);
        if (campaign?.currentLocationId) {
            const em = this.npcItemRepository.getEntityManager();

            // Current Location section (with optional parent name for sub-locations)
            // eslint-disable-next-line unicorn/no-array-method-this-argument
            const currentLocation = await em.findOne(Location, { id: campaign.currentLocationId });
            if (currentLocation) {
                let locationName = currentLocation.name;
                if (currentLocation.parentLocationId) {
                    // eslint-disable-next-line unicorn/no-array-method-this-argument
                    const parentLocation = await em.findOne(Location, { id: currentLocation.parentLocationId });
                    if (parentLocation) {
                        locationName = `${currentLocation.name} (inside ${parentLocation.name})`;
                    }
                }

                const locationLines = [
                    `ID: ${currentLocation.id}`,
                    `Name: ${locationName}`,
                    `Description: ${currentLocation.description}`,
                    ...(currentLocation.currentState ? [`State: ${currentLocation.currentState}`] : []),
                ];
                parts.push(`## Current Location\n${locationLines.join('\n')}`);

                // Known Establishments — only shown when at a top-level location
                if (!currentLocation.parentLocationId) {
                    // eslint-disable-next-line unicorn/no-array-method-this-argument
                    const subLocations = await em.find(Location, { parentLocationId: campaign.currentLocationId });
                    if (subLocations.length > 0) {
                        const estLines = subLocations.map(
                            (loc) => `- ${loc.name} (id: ${loc.id}): ${loc.description}`,
                        );
                        parts.push(`## Known Establishments\n${estLines.join('\n')}`);
                    }
                }
            }

            // NPCs Present
            // eslint-disable-next-line unicorn/no-array-method-this-argument
            const npcsAtLocation = await em.find(Npc, {
                campaignId,
                currentLocationId: campaign.currentLocationId,
                alive: true,
            });

            if (npcsAtLocation.length > 0) {
                const npcLines = npcsAtLocation.map((npc) => {
                    const parts2: string[] = [`${npc.name} (id: ${npc.id})`];
                    if (npc.profession) {
                        parts2.push(npc.profession);
                    }

                    if (npc.disposition) {
                        parts2.push(npc.disposition);
                    }

                    return `- ${parts2.join(' — ')}`;
                });
                parts.push(`## NPCs Present\n${npcLines.join('\n')}`);

                // Merchant Inventory (NPCs with stock)
                const npcIds = npcsAtLocation.map((npc) => npc.id);
                // eslint-disable-next-line unicorn/no-array-method-this-argument
                const npcItems = await em.find(NpcItem, { npcId: npcIds });

                const merchantSections: string[] = [];
                for (const npc of npcsAtLocation) {
                    const items = npcItems.filter((index) => index.npcId === npc.id);
                    if (items.length === 0) {
                        continue;
                    }

                    const heading = npc.profession
                        ? `### ${npc.name} (${npc.profession})`
                        : `### ${npc.name}`;

                    const itemLines = items
                        .map((index) => {
                            const price = index.merchantPrice === null ? '' : ` — ${index.merchantPrice} gp`;
                            return `- ${index.name} x${index.quantity}${price}`;
                        })
                        .join('\n');

                    merchantSections.push(`${heading}\n${itemLines}`);
                }

                if (merchantSections.length > 0) {
                    parts.push(`## Merchant Inventory\n${merchantSections.join('\n\n')}`);
                }
            }

            // Items Here
            // eslint-disable-next-line unicorn/no-array-method-this-argument
            const locationItems = await em.find(LocationItem, { locationId: campaign.currentLocationId });
            if (locationItems.length > 0) {
                const itemLines = locationItems.map((li) => {
                    const note = li.note ? ` — ${li.note}` : '';
                    return `- ${li.itemName} x${li.quantity}${note} (item_id: ${li.itemId})`;
                });
                parts.push(`## Items Here\n${itemLines.join('\n')}`);
            }
        }

        const diaryEntries = await this.memoryService.getRecentDiaryEntries(campaignId);
        if (diaryEntries.length > 0) {
            // Reverse to oldest-first for narrative continuity (DB returns newest-first)
            const ordered = diaryEntries.toReversed() as DiaryEntry[];
            const formatted = ordered
                .map((entry: DiaryEntry) => `**${entry.inGameDate}**\n${entry.content}`)
                .join('\n\n');
            parts.push(`## Recent Diary\n${formatted}`);
        }

        if (npcMemories?.trim()) {
            parts.push(`## NPC Knowledge\n${npcMemories.trim()}`);
        }

        return parts.join('\n\n') || '## World State\n(No character data yet)';
    }

    /**
     * Block 4: Historical GameEvents for the session, formatted as Anthropic messages.
     * Excludes the latest player input (which is supplied as the live user message).
     * Cache-control: ephemeral — invalidated with each completed turn.
     */
    async loadHistoryBlock(sessionId: number): Promise<AnthropicMessage[]> {
        const events = await this.eventRepository.getEntityManager().find(
            GameEvent,
            { session: sessionId },
            { orderBy: { createdAt: 'ASC' } },
        );

        return this.formatEventsAsMessages(events);
    }

    /**
     * Formats GameEvent records into Anthropic message format.
     * PLAYER_INPUT → user role, DM_NARRATIVE → assistant role,
     * TOOL_CALL → tool_use / tool_result pairs.
     */
    formatEventsAsMessages(events: GameEvent[]): AnthropicMessage[] {
        const messages: AnthropicMessage[] = [];

        for (const event of events) {
            const content = event.content as Record<string, unknown>;

            if (event.eventType === EventType.PLAYER_INPUT) {
                messages.push({
                    role: 'user',
                    content: String(content['text'] ?? ''),
                });
            } else if (event.eventType === EventType.DM_NARRATIVE) {
                messages.push({
                    role: 'assistant',
                    content: String(content['narrative'] ?? ''),
                });
            } else if (event.eventType === EventType.TOOL_CALL) {
                const toolUseId = String(content['toolUseId'] ?? `tool_${event.id}`);
                messages.push({
                    role: 'assistant',
                    content: [
                        {
                            type: 'tool_use',
                            id: toolUseId,
                            name: String(content['toolName'] ?? ''),
                            input: (content['toolInput'] ?? {}) as Record<string, unknown>,
                        },
                    ],
                });
                messages.push({
                    role: 'user',
                    content: [
                        {
                            type: 'tool_result',
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            tool_use_id: toolUseId,
                            content: JSON.stringify(content['toolResult'] ?? {}),
                        },
                    ],
                });
            }
        }

        return messages;
    }
}
