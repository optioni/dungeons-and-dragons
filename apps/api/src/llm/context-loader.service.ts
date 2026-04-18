import { InjectRepository } from '@mikro-orm/nestjs';
import { type EntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { Character } from '../character/entities/character.entity.js';
import type { DiaryEntry } from '../memory/entities/diary-entry.entity.js';
import type { MemoryService } from '../memory/memory.service.js';
import { EventType, SceneType } from '../session/session.enums.js';
import { GameEvent } from '../session/entities/game-event.entity.js';
import { GameSession } from '../session/entities/game-session.entity.js';
import { PromptModuleRegistry } from './prompt-module-registry.service.js';

export type AnthropicMessage = Anthropic.MessageParam;
export type CacheControlBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };

const BASE_SYSTEM_PROMPT = `You are the Dungeon Master for a solo D&D 5e campaign. Your role is to:
- Narrate the world vividly and impartially
- Run NPCs with distinct personalities and agendas
- Adjudicate D&D 5e rules fairly using the available tool calls
- Return suggested player actions as short action chip labels when appropriate
- Keep the narrative consistent with established campaign lore and world state

Always use tool calls for mechanical actions (dice rolls, stat changes, scene transitions). Never invent mechanical outcomes in prose.`;

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
        private readonly promptModuleRegistry: PromptModuleRegistry,
        private readonly memoryService: Pick<MemoryService, 'getRecentDiaryEntries'>,
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
     * Block 3: Character state, world state, and last 7 diary entries.
     * Cache-control: ephemeral — invalidated when character/world changes or a new diary entry is created.
     */
    async loadWorldBlock(campaignId: number, characterId?: number): Promise<string> {
        const parts: string[] = [];

        if (characterId) {
            const character = await this.characterRepository.getEntityManager().findOne(Character, characterId);
            if (character) {
                parts.push(`## Character Sheet\nName: ${character.name}\nLevel: ${character.level}\nHP: ${character.hp}/${character.maxHp}\nAC: ${character.ac}\nConditions: ${character.conditions.join(', ') || 'none'}\nSpell Slots: ${JSON.stringify(character.spellSlots)}`);
            }
        }

        const diaryEntries = await this.memoryService.getRecentDiaryEntries(campaignId);
        if (diaryEntries.length > 0) {
            // Reverse to oldest-first for narrative continuity (DB returns newest-first)
            const ordered = [...diaryEntries].reverse() as DiaryEntry[];
            const formatted = ordered
                .map((e: DiaryEntry) => `**${e.inGameDate}**\n${e.content}`)
                .join('\n\n');
            parts.push(`## Recent Diary\n${formatted}`);
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
