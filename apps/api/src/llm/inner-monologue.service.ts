import Anthropic from '@anthropic-ai/sdk';
import { InjectRepository } from '@mikro-orm/nestjs';
import { type EntityRepository } from '@mikro-orm/postgresql';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { type SkillName } from '../character/character.enums.js';
import { Character } from '../character/entities/character.entity.js';
import { type EnvironmentConfig } from '../config/environment.validation.js';
import { DiceService } from '../game-engine/dice.service.js';
import { DmStreamChunkType } from '../session/dto/dm-stream-chunk.dto.js';
import { GameSession } from '../session/entities/game-session.entity.js';
import { SceneType } from '../session/session.enums.js';
import { StreamPublisher } from '../session/stream-publisher.service.js';
import { Location } from '../world/entities/location.entity.js';
import { Npc } from '../world/entities/npc.entity.js';

const ELIGIBLE_SKILLS = new Set<Lowercase<SkillName>>([
    'arcana',
    'history',
    'insight',
    'investigation',
    'perception',
    'survival',
]);

const SKILL_TO_ABILITY = {
    perception: 'WIS',
    insight: 'WIS',
    investigation: 'INT',
    history: 'INT',
    arcana: 'INT',
    survival: 'WIS',
} as const;

type EligibleSkill = keyof typeof SKILL_TO_ABILITY;

interface AnthropicClientLike {
    messages: {
        create: (parameters: Anthropic.Messages.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>
    }
}

/**
 * Runs a short post-turn Haiku call that turns server-authoritative passive checks
 * into a character-owned inner voice stream.
 */
@Injectable()
export class InnerMonologueService {
    private readonly logger = new Logger(InnerMonologueService.name);

    private readonly anthropic: AnthropicClientLike;

    private readonly backgroundModel: string;

    constructor(
        @InjectRepository(GameSession)
        private readonly sessionRepository: EntityRepository<GameSession>,
        @InjectRepository(Character)
        private readonly characterRepository: EntityRepository<Character>,
        @InjectRepository(Campaign)
        private readonly campaignRepository: EntityRepository<Campaign>,
        @InjectRepository(Location)
        private readonly locationRepository: EntityRepository<Location>,
        @InjectRepository(Npc)
        private readonly npcRepository: EntityRepository<Npc>,
        private readonly diceService: DiceService,
        @Inject(forwardRef(() => StreamPublisher))
        private readonly streamPublisher: StreamPublisher,
        private readonly configService: ConfigService<EnvironmentConfig>,
    ) {
        this.anthropic = new Anthropic({
            apiKey: this.configService.getOrThrow('ANTHROPIC_API_KEY'),
        });
        this.backgroundModel = this.configService.getOrThrow('LLM_BACKGROUND_MODEL');
    }

    async runIfApplicable(sessionId: number, sceneType: SceneType, narrativeText: string): Promise<void> {
        if (sceneType === SceneType.COMBAT || sceneType === SceneType.REST || !narrativeText.trim()) {
            return;
        }

        try {
            const session = await this.sessionRepository.getEntityManager().findOne(
                GameSession,
                sessionId,
                { populate: ['campaign'] as never },
            );
            if (!session) {
                return;
            }

            const character = await this.characterRepository.getEntityManager().findOne(
                Character,
                { campaign: { id: session.campaign.id } } as never,
                { populate: ['race', 'srdClass'] as never },
            );
            if (!character) {
                return;
            }

            const campaign = await this.campaignRepository.getEntityManager().findOne(Campaign, session.campaign.id);
            const location = campaign?.currentLocationId
                ? await this.locationRepository.getEntityManager().findOne(Location, campaign.currentLocationId)
                : null;
            const npcs = campaign?.currentLocationId
                ? await this.npcRepository.getEntityManager().find(
                    Npc,
                    { campaignId: session.campaign.id, currentLocationId: campaign.currentLocationId },
                    { orderBy: { id: 'ASC' } },
                )
                : [];

            const system = this.buildSystemPrompt(character);
            const userTurn = [
                `Current location: ${location?.name ?? 'Unknown location'}`,
                `NPCs present: ${npcs.length > 0 ? npcs.map((npc) => npc.name).join(', ') : 'none'}`,
                `DM narrative: ${narrativeText.trim()}`,
            ].join('\n');

            /* eslint-disable @typescript-eslint/naming-convention */
            const tools: Anthropic.Tool[] = [{
                name: 'roll_skill_check',
                description: 'Roll one narratively relevant passive-style skill check for the character.',
                input_schema: {
                    type: 'object',
                    properties: {
                        skill: {
                            type: 'string',
                            enum: ['perception', 'insight', 'investigation', 'history', 'arcana', 'survival'],
                        },
                    },
                    required: ['skill'],
                },
            }];
            /* eslint-enable @typescript-eslint/naming-convention */

            const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userTurn }];
            let toolCalls = 0;

            while (true) {
                const callStartedAt = Date.now();
                /* eslint-disable @typescript-eslint/naming-convention */
                const response = await this.anthropic.messages.create({
                    model: this.backgroundModel,
                    max_tokens: 300,
                    system,
                    tools,
                    messages,
                });
                /* eslint-enable @typescript-eslint/naming-convention */
                const callDuration = Date.now() - callStartedAt;
                this.logger.log(`Anthropic call complete: provider=anthropic model=${this.backgroundModel} context=inner_monologue sessionId=${sessionId} duration=${callDuration}ms success=true`);

                const toolUses = response.content.filter((block) => block.type === 'tool_use');
                if (response.stop_reason === 'tool_use' && toolUses.length > 0) {
                    if (toolCalls >= 2) {
                        messages.push(
                            { role: 'assistant', content: response.content },
                            { role: 'user', content: 'You have already used 2 skill checks. Write the inner monologue now without any more tool calls.' },
                        );
                        continue;
                    }

                    const toolResults: Anthropic.ToolResultBlockParam[] = [];

                    for (const block of toolUses) {
                        const skill = String((block.input as Record<string, unknown>)['skill'] ?? '').toLowerCase();
                        const result = this.rollSkillCheck(character, skill);
                        toolCalls += 1;

                        /* eslint-disable @typescript-eslint/naming-convention */
                        toolResults.push({
                            type: 'tool_result',
                            tool_use_id: block.id,
                            content: JSON.stringify(result),
                        });
                        /* eslint-enable @typescript-eslint/naming-convention */
                    }

                    messages.push(
                        { role: 'assistant', content: response.content },
                        { role: 'user', content: toolResults },
                    );
                    continue;
                }

                const text = response.content
                    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
                    .map((block) => block.text)
                    .join('');

                if (text.trim()) {
                    this.streamPublisher.publish(sessionId, {
                        type: DmStreamChunkType.INNER_VOICE,
                        text,
                    });
                    try {
                        session.lastInnerVoice = text;
                        await this.sessionRepository.getEntityManager().flush();
                    } catch (flushError) {
                        const errorClass = flushError instanceof Error ? flushError.constructor.name : 'UnknownError';
                        this.logger.error(`Inner monologue flush failed: sessionId=${sessionId} errorClass=${errorClass}`);
                    }
                }

                this.streamPublisher.publish(sessionId, { type: DmStreamChunkType.DONE });
                return;
            }
        } catch (error) {
            const errorClass = error instanceof Error ? error.constructor.name : 'UnknownError';
            this.logger.error(`Anthropic call failed: provider=anthropic model=${this.backgroundModel} context=inner_monologue sessionId=${sessionId} errorClass=${errorClass}`);
        }
    }

    private buildSystemPrompt(character: Character): string {
        const personalityBlocks = [
            character.personalityTraits.length > 0 ? `Traits: ${character.personalityTraits.join('; ')}` : null,
            character.ideals.length > 0 ? `Ideals: ${character.ideals.join('; ')}` : null,
            character.bonds.length > 0 ? `Bonds: ${character.bonds.join('; ')}` : null,
            character.flaws.length > 0 ? `Flaws: ${character.flaws.join('; ')}` : null,
        ].filter((line): line is string => line !== null);

        const personalityInstruction = personalityBlocks.length > 0
            ? personalityBlocks.join('\n')
            : 'No explicit traits were recorded. Ground the voice in the character race and class background instead.';

        return [
            `You are writing the private inner monologue of ${character.name}, a ${character.race.name} ${character.srdClass.name}.`,
            personalityInstruction,
            'Write 2-3 sentences of pure internal thought — what the character notices, feels, or silently concludes. This is NOT a response to the DM, NOT spoken dialogue, and NOT a description of the character taking action.',
            'Do NOT include any quoted speech, action descriptions, or anything the character says out loud. Only what crosses their mind in the moment.',
            'Output prose directly. No headers, no labels, no "Inner Monologue:" prefix — just the thoughts themselves.',
            'You may call roll_skill_check up to 2 times for narratively relevant insight, perception, investigation, history, arcana, or survival checks.',
            'Use the rolled result exactly as returned. Failed insight means a confident wrong read. Failed perception means the character notices nothing unusual.',
        ].join('\n');
    }

    private rollSkillCheck(character: Character, skill: string): { error: string } | {
        skill: string
        rolled: number
        modifier: number
        total: number
        dc: number
        success: boolean
    } {
        if (!ELIGIBLE_SKILLS.has(skill as Lowercase<SkillName>)) {
            return { error: 'skill not available for inner monologue' };
        }

        const eligibleSkill = skill as EligibleSkill;
        const abilityKey = SKILL_TO_ABILITY[eligibleSkill];
        const rolled = this.diceService.d20();
        const modifier = Math.floor((character.abilityScores[abilityKey] - 10) / 2);
        const total = rolled + modifier;
        const dc = 12;

        return {
            skill,
            rolled,
            modifier,
            total,
            dc,
            success: total >= dc,
        };
    }
}
