/* eslint-disable @typescript-eslint/naming-convention */
// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';

import { DmStreamChunkType } from '../session/dto/dm-stream-chunk.dto.js';
import { SceneType } from '../session/session.enums.js';
import { InnerMonologueService } from './inner-monologue.service.js';

describe('InnerMonologueService', () => {
    let sessionRepository: Record<string, ReturnType<typeof vi.fn>>;
    let characterRepository: Record<string, ReturnType<typeof vi.fn>>;
    let campaignRepository: Record<string, ReturnType<typeof vi.fn>>;
    let locationRepository: Record<string, ReturnType<typeof vi.fn>>;
    let npcRepository: Record<string, ReturnType<typeof vi.fn>>;
    let diceService: Record<string, ReturnType<typeof vi.fn>>;
    let streamPublisher: Record<string, ReturnType<typeof vi.fn>>;
    let anthropicMessages: Record<string, ReturnType<typeof vi.fn>>;
    let loggerErrorSpy: ReturnType<typeof vi.spyOn>;
    let service: InnerMonologueService;

    beforeEach(() => {
        sessionRepository = {
            getEntityManager: vi.fn().mockReturnValue({
                findOne: vi.fn().mockResolvedValue({ id: 5, campaign: { id: 11 } }),
            }),
        };
        characterRepository = {
            getEntityManager: vi.fn().mockReturnValue({
                findOne: vi.fn().mockResolvedValue({
                    id: 7,
                    name: 'Seraphina',
                    level: 4,
                    abilityScores: {
                        STR: 8, DEX: 14, CON: 12, INT: 16, WIS: 13, CHA: 10,
                    },
                    skillProficiencies: {
                        Acrobatics: 'none',
                        'Animal Handling': 'none',
                        Arcana: 'expert',
                        Athletics: 'none',
                        Deception: 'none',
                        History: 'proficient',
                        Insight: 'proficient',
                        Intimidation: 'none',
                        Investigation: 'proficient',
                        Medicine: 'none',
                        Nature: 'none',
                        Perception: 'none',
                        Performance: 'none',
                        Persuasion: 'none',
                        Religion: 'none',
                        'Sleight of Hand': 'none',
                        Stealth: 'none',
                        Survival: 'none',
                    },
                    personalityTraits: ['I distrust easy answers.'],
                    ideals: ['Truth over comfort.'],
                    bonds: ['My mentor was taken from me.'],
                    flaws: ['I read too much into silence.'],
                    race: { name: 'Elf' },
                    srdClass: { name: 'Wizard' },
                    campaign: { id: 11 },
                }),
            }),
        };
        campaignRepository = {
            getEntityManager: vi.fn().mockReturnValue({
                findOne: vi.fn().mockResolvedValue({ id: 11, currentLocationId: 21 }),
            }),
        };
        locationRepository = {
            getEntityManager: vi.fn().mockReturnValue({
                findOne: vi.fn().mockResolvedValue({ id: 21, name: 'The Lantern Court' }),
            }),
        };
        npcRepository = {
            getEntityManager: vi.fn().mockReturnValue({
                find: vi.fn().mockResolvedValue([
                    { id: 1, name: 'Captain Brann' },
                    { id: 2, name: 'Sister Vale' },
                ]),
            }),
        };
        diceService = {
            d20: vi.fn().mockReturnValue(9),
        };
        streamPublisher = {
            publish: vi.fn(),
        };
        anthropicMessages = {
            create: vi.fn(),
        };

        service = new InnerMonologueService(
            sessionRepository as never,
            characterRepository as never,
            campaignRepository as never,
            locationRepository as never,
            npcRepository as never,
            diceService as never,
            streamPublisher as never,
            {
                getOrThrow: vi.fn().mockImplementation((key: string) => (key === 'ANTHROPIC_API_KEY' ? 'test-key' : 'claude-haiku-test')),
            } as never,
        );

        (service as unknown as Record<string, unknown>).anthropic = {
            messages: anthropicMessages,
        };

        loggerErrorSpy = vi.spyOn((service as unknown as { logger: { error: (...args: unknown[]) => void } }).logger, 'error')
            .mockImplementation(() => {});
    });

    it('returns early for COMBAT and REST scenes', async () => {
        await service.runIfApplicable(5, SceneType.COMBAT, 'Steel clashes around you.');
        await service.runIfApplicable(5, SceneType.REST, 'The campfire burns low.');

        expect(anthropicMessages.create).not.toHaveBeenCalled();
        expect(streamPublisher.publish).not.toHaveBeenCalled();
    });

    it('returns a structured error for ineligible skills and still finishes the loop', async () => {
        anthropicMessages.create
            .mockResolvedValueOnce({
                content: [{
                    type: 'tool_use',
                    id: 'toolu_1',
                    name: 'roll_skill_check',
                    input: { skill: 'athletics' },
                }],
                stop_reason: 'tool_use',
            })
            .mockResolvedValueOnce({
                content: [{ type: 'text', text: 'She mistakes force for understanding.' }],
                stop_reason: 'end_turn',
            });

        await service.runIfApplicable(5, SceneType.SOCIAL, 'The captain smiles too quickly.');

        expect(streamPublisher.publish).toHaveBeenCalledWith(
            5,
            expect.objectContaining({
                type: DmStreamChunkType.INNER_VOICE,
                text: 'She mistakes force for understanding.',
            }),
        );

        const secondCall = anthropicMessages.create.mock.calls[1]?.[0] as {
            messages: Array<{ role: string; content: unknown }>
        };
        expect(secondCall.messages.at(-1)).toEqual({
            role: 'user',
            content: [{
                type: 'tool_result',
                tool_use_id: 'toolu_1',
                content: JSON.stringify({ error: 'skill not available for inner monologue' }),
            }],
        });
    });

    it('stops honoring tool calls after the second roll and emits a trailing DONE', async () => {
        anthropicMessages.create
            .mockResolvedValueOnce({
                content: [{
                    type: 'tool_use',
                    id: 'toolu_1',
                    name: 'roll_skill_check',
                    input: { skill: 'insight' },
                }],
                stop_reason: 'tool_use',
            })
            .mockResolvedValueOnce({
                content: [{
                    type: 'tool_use',
                    id: 'toolu_2',
                    name: 'roll_skill_check',
                    input: { skill: 'history' },
                }],
                stop_reason: 'tool_use',
            })
            .mockResolvedValueOnce({
                content: [{ type: 'text', text: 'Two instincts tug in different directions.' }],
                stop_reason: 'end_turn',
            });

        await service.runIfApplicable(5, SceneType.EXPLORATION, 'Dust lies untouched on the altar.');

        expect(diceService.d20).toHaveBeenCalledTimes(2);
        expect(anthropicMessages.create).toHaveBeenCalledTimes(3);
        expect(streamPublisher.publish).toHaveBeenNthCalledWith(
            1,
            5,
            expect.objectContaining({
                type: DmStreamChunkType.INNER_VOICE,
                text: 'Two instincts tug in different directions.',
            }),
        );
        expect(streamPublisher.publish).toHaveBeenNthCalledWith(
            2,
            5,
            expect.objectContaining({ type: DmStreamChunkType.DONE }),
        );
    });

    it('logs errors without rethrowing', async () => {
        anthropicMessages.create.mockRejectedValue(new Error('haiku offline'));

        await expect(service.runIfApplicable(5, SceneType.SOCIAL, 'A priest watches from the archway.'))
            .resolves
            .toBeUndefined();

        expect(loggerErrorSpy).toHaveBeenCalled();
    });
});
