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
    let mockSession: { id: number; campaign: { id: number }; lastInnerVoice?: string | null };
    let mockSessionEntityManager: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(() => {
        mockSession = { id: 5, campaign: { id: 11 } };
        mockSessionEntityManager = {
            findOne: vi.fn().mockResolvedValue(mockSession),
            flush: vi.fn().mockResolvedValue(undefined),
        };
        sessionRepository = {
            getEntityManager: vi.fn().mockReturnValue(mockSessionEntityManager),
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

    it('writes lastInnerVoice to session after generating inner monologue', async () => {
        anthropicMessages.create.mockResolvedValueOnce({
            content: [{ type: 'text', text: 'She mistrusts his stillness.' }],
            stop_reason: 'end_turn',
        });

        await service.runIfApplicable(5, SceneType.SOCIAL, 'The captain watches from the doorway.');

        expect(mockSession.lastInnerVoice).toBe('She mistrusts his stillness.');
        expect(mockSessionEntityManager.flush).toHaveBeenCalled();
    });

    it('swallows flush errors without propagating', async () => {
        anthropicMessages.create.mockResolvedValueOnce({
            content: [{ type: 'text', text: 'A flash of recognition.' }],
            stop_reason: 'end_turn',
        });
        mockSessionEntityManager.flush.mockRejectedValueOnce(new Error('db error'));

        await expect(service.runIfApplicable(5, SceneType.SOCIAL, 'The stranger speaks.'))
            .resolves
            .toBeUndefined();

        expect(loggerErrorSpy).toHaveBeenCalled();
    });

    describe('selectDc', () => {
        const selectDc = (difficulty?: string) =>
            (service as unknown as { selectDc: (d?: string) => number }).selectDc(difficulty);

        it('returns a value in 8–10 for easy', () => {
            for (let i = 0; i < 20; i++) {
                const dc = selectDc('easy');
                expect(dc).toBeGreaterThanOrEqual(8);
                expect(dc).toBeLessThanOrEqual(10);
            }
        });

        it('returns a value in 12–14 for medium', () => {
            for (let i = 0; i < 20; i++) {
                const dc = selectDc('medium');
                expect(dc).toBeGreaterThanOrEqual(12);
                expect(dc).toBeLessThanOrEqual(14);
            }
        });

        it('returns a value in 16–18 for hard', () => {
            for (let i = 0; i < 20; i++) {
                const dc = selectDc('hard');
                expect(dc).toBeGreaterThanOrEqual(16);
                expect(dc).toBeLessThanOrEqual(18);
            }
        });

        it('defaults to medium when difficulty is omitted', () => {
            for (let i = 0; i < 20; i++) {
                const dc = selectDc();
                expect(dc).toBeGreaterThanOrEqual(12);
                expect(dc).toBeLessThanOrEqual(14);
            }
        });

        it('defaults to medium for an unrecognised value', () => {
            for (let i = 0; i < 20; i++) {
                const dc = selectDc('legendary');
                expect(dc).toBeGreaterThanOrEqual(12);
                expect(dc).toBeLessThanOrEqual(14);
            }
        });
    });

    describe('rollSkillCheck proficiency application', () => {
        const rollSkillCheck = (skill: string, difficulty?: string) =>
            (service as unknown as {
                rollSkillCheck: (
                    character: unknown,
                    skill: string,
                    difficulty?: string,
                ) => Record<string, unknown>
            }).rollSkillCheck(
                {
                    abilityScores: { STR: 8, DEX: 14, CON: 12, INT: 16, WIS: 13, CHA: 10 },
                    skillProficiencies: {
                        Acrobatics: 'none', 'Animal Handling': 'none', Arcana: 'expert',
                        Athletics: 'none', Deception: 'none', History: 'proficient',
                        Insight: 'proficient', Intimidation: 'none', Investigation: 'proficient',
                        Medicine: 'none', Nature: 'none', Perception: 'none',
                        Performance: 'none', Persuasion: 'none', Religion: 'none',
                        'Sleight of Hand': 'none', Stealth: 'none', Survival: 'none',
                    },
                    level: 4,
                    proficiencyBonus: 3,
                },
                skill,
                difficulty,
            );

        beforeEach(() => {
            diceService.d20.mockReturnValue(10);
        });

        it('adds no proficiency bonus for a none-proficiency skill', () => {
            // perception is 'none', WIS modifier for 13 = +1, rolled = 10 → total = 11
            const result = rollSkillCheck('perception', 'medium');
            expect(result['total']).toBe(11);
            expect(result['modifier']).toBe(1);
        });

        it('adds proficiencyBonus once for a proficient skill', () => {
            // insight is 'proficient', WIS mod = +1, proficiency = 3, rolled = 10 → total = 14
            const result = rollSkillCheck('insight', 'medium');
            expect(result['total']).toBe(14);
            expect(result['modifier']).toBe(1);
        });

        it('adds 2× proficiencyBonus for an expert skill', () => {
            // arcana is 'expert', INT mod for 16 = +3, proficiency = 3×2 = 6, rolled = 10 → total = 19
            const result = rollSkillCheck('arcana', 'easy');
            expect(result['total']).toBe(19);
            expect(result['modifier']).toBe(3);
        });

        it('dc is within the expected range for each difficulty', () => {
            for (let i = 0; i < 10; i++) {
                const easy = rollSkillCheck('perception', 'easy');
                expect(easy['dc']).toBeGreaterThanOrEqual(8);
                expect(easy['dc']).toBeLessThanOrEqual(10);

                const medium = rollSkillCheck('perception', 'medium');
                expect(medium['dc']).toBeGreaterThanOrEqual(12);
                expect(medium['dc']).toBeLessThanOrEqual(14);

                const hard = rollSkillCheck('perception', 'hard');
                expect(hard['dc']).toBeGreaterThanOrEqual(16);
                expect(hard['dc']).toBeLessThanOrEqual(18);
            }
        });
    });

    it('passes difficulty from tool input to rollSkillCheck', async () => {
        anthropicMessages.create
            .mockResolvedValueOnce({
                content: [{
                    type: 'tool_use',
                    id: 'toolu_hard',
                    name: 'roll_skill_check',
                    input: { skill: 'insight', difficulty: 'hard' },
                }],
                stop_reason: 'tool_use',
            })
            .mockResolvedValueOnce({
                content: [{ type: 'text', text: 'Something dangerous is close.' }],
                stop_reason: 'end_turn',
            });

        await service.runIfApplicable(5, SceneType.SOCIAL, 'The envoy smiles, but her eyes are calculating.');

        const secondCall = anthropicMessages.create.mock.calls[1]?.[0] as {
            messages: Array<{ role: string; content: unknown }>
        };
        const toolResult = (secondCall.messages.at(-1) as { content: Array<{ content: string }> })
            .content[0].content;
        const parsed = JSON.parse(toolResult) as { dc: number; skill: string };
        expect(parsed.skill).toBe('insight');
        expect(parsed.dc).toBeGreaterThanOrEqual(16);
        expect(parsed.dc).toBeLessThanOrEqual(18);
    });
});
