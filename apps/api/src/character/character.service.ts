import Anthropic from '@anthropic-ai/sdk';
import { type Populate } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { type EntityRepository } from '@mikro-orm/postgresql';
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { type User } from '../auth/entities/user.entity.js';
import { Campaign } from '../campaign/entities/campaign.entity.js';
import { type EnvironmentConfig } from '../config/environment.validation.js';
import { SrdClass } from '../srd/entities/srd-class.entity.js';
import { SrdRace } from '../srd/entities/srd-race.entity.js';
import {
    type AbilityScores,
    EquipSlot,
    SKILL_NAMES,
    type SkillProficiencies,
    type SpellSlot,
} from './character.enums.js';
import { AbilityScoresInput, type CreateCharacterInput } from './dto/create-character.input.js';
import { CharacterItem } from './entities/character-item.entity.js';
import { Character } from './entities/character.entity.js';
import { Item } from './entities/item.entity.js';

/** Level 1 spell slots by class index. Half-casters and non-casters are absent. */
const LEVEL_1_SPELL_SLOTS: Partial<Record<string, SpellSlot[]>> = {
    bard: [{ level: 1, total: 2, used: 0 }],
    cleric: [{ level: 1, total: 2, used: 0 }],
    druid: [{ level: 1, total: 2, used: 0 }],
    sorcerer: [{ level: 1, total: 2, used: 0 }],
    warlock: [{ level: 1, total: 1, used: 0 }],
    wizard: [{ level: 1, total: 2, used: 0 }],
};

interface AnthropicClientLike {
    messages: {
        create: (
            parameters: Anthropic.Messages.MessageCreateParamsNonStreaming,
        ) => Promise<Anthropic.Message>
    }
}

interface CharacterPersonality {
    personalityTraits: string[]
    ideals: string[]
    bonds: string[]
    flaws: string[]
}

export type UpdateCharacterStatePayload = Partial<{
    hp: number
    maxHp: number
    ac: number
    conditions: string[]
    spellSlots: SpellSlot[]
    preparedSpells: string[]
    skillProficiencies: SkillProficiencies
    xp: number
    level: number
    deathSaveSuccesses: number
    deathSaveFailures: number
    isDead: boolean
    hitDiceRemaining: number
    goldPieces: number
    silverPieces: number
    copperPieces: number
    abilityScores: AbilityScores
}>;

/**
 * Service responsible for all character lifecycle operations: creation, state queries,
 * inventory management, and the internal state-update hook used by the game engine.
 */
@Injectable()
export class CharacterService {
    private readonly anthropic: AnthropicClientLike;

    private readonly backgroundModel: string;

    constructor(
        @InjectRepository(Character)
        private readonly characterRepository: EntityRepository<Character>,
        @InjectRepository(CharacterItem)
        private readonly characterItemRepository: EntityRepository<CharacterItem>,
        @InjectRepository(Item)
        private readonly itemRepository: EntityRepository<Item>,
        private readonly configService: ConfigService<EnvironmentConfig>,
    ) {
        this.anthropic = new Anthropic({
            apiKey: this.configService.getOrThrow('ANTHROPIC_API_KEY'),
        });
        this.backgroundModel = this.configService.getOrThrow('LLM_BACKGROUND_MODEL');
    }

    /**
     * Validates that the provided ability scores are a permutation of the standard array [15,14,13,12,10,8].
     * @throws BadRequestException if the scores are not a valid permutation.
     */
    validateAbilityScores(scores: AbilityScoresInput): void {
        const standard = [15, 14, 13, 12, 10, 8];
        const provided = [scores.STR, scores.DEX, scores.CON, scores.INT, scores.WIS, scores.CHA];
        const sorted = [...provided].sort((a, b) => b - a);

        const isValid = standard.every((value, index) => value === sorted[index]);
        if (!isValid) {
            throw new BadRequestException(
                'Ability scores must be a permutation of the standard array [15, 14, 13, 12, 10, 8]',
            );
        }
    }

    /**
     * Returns the ability modifier for a given score: floor((score - 10) / 2).
     */
    getAbilityModifier(score: number): number {
        return Math.floor((score - 10) / 2);
    }

    /**
     * Calculates initial max HP: class hit die + CON modifier (minimum 1).
     */
    calculateInitialHp(hitDie: number, conScore: number): number {
        return Math.max(1, hitDie + this.getAbilityModifier(conScore));
    }

    /**
     * Returns the proficiency bonus for a given level: floor((level - 1) / 4) + 2.
     */
    getProficiencyBonus(level: number): number {
        return Math.floor((level - 1) / 4) + 2;
    }

    /**
     * Creates a new character with initial state derived from race and class SRD data.
     * @throws BadRequestException if the ability scores are not a valid standard array permutation,
     *   or if the raceId or classId do not correspond to existing SRD records.
     * @throws ForbiddenException if the campaign does not belong to the authenticated user.
     */
    async create(input: CreateCharacterInput, user: User): Promise<Character> {
        const em = this.characterRepository.getEntityManager();

        this.validateAbilityScores(input.abilityScores);

        const campaign = await em.findOne(Campaign, { id: input.campaignId, userId: user.id });
        if (!campaign) {
            throw new ForbiddenException('Campaign not found or does not belong to you');
        }

        const race = await em.findOne(SrdRace, { id: input.raceId });
        if (!race) {
            throw new BadRequestException(`Race with id ${input.raceId} not found`);
        }

        const srdClass = await em.findOne(SrdClass, { id: input.classId });
        if (!srdClass) {
            throw new BadRequestException(`Class with id ${input.classId} not found`);
        }

        const conScore = input.abilityScores.CON;
        const dexScore = input.abilityScores.DEX;
        const maxHp = this.calculateInitialHp(srdClass.hitDie, conScore);
        const ac = 10 + this.getAbilityModifier(dexScore);

        const spellSlots = srdClass.spellcastingAbility
            ? (LEVEL_1_SPELL_SLOTS[srdClass.index] ?? [])
            : [];

        const skillProficiencies = Object.fromEntries(
            SKILL_NAMES.map((skill) => [skill, 'none']),
        ) as SkillProficiencies;
        const personality = await this.generateCharacterPersonality(
            input.name,
            race,
            srdClass,
            input.abilityScores,
        );

        const character = em.create(Character, {
            name: input.name,
            campaign,
            race,
            srdClass,
            abilityScores: input.abilityScores,
            hp: maxHp,
            maxHp,
            ac,
            spellSlots,
            skillProficiencies,
            personalityTraits: personality.personalityTraits,
            ideals: personality.ideals,
            bonds: personality.bonds,
            flaws: personality.flaws,
        } as never);

        em.persist(character);
        await em.flush();

        return character;
    }

    private async generateCharacterPersonality(
        name: string,
        race: SrdRace,
        srdClass: SrdClass,
        abilityScores: AbilityScores,
    ): Promise<CharacterPersonality> {
        try {
            /* eslint-disable @typescript-eslint/naming-convention */
            const response = await this.anthropic.messages.create({
                model: this.backgroundModel,
                max_tokens: 300,
                tools: [
                    {
                        name: 'set_character_personality',
                        description:
                            'Produce grounded D&D-style personality fields for a newly created player character.',
                        input_schema: {
                            type: 'object',
                            properties: {
                                personalityTraits: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    minItems: 1,
                                    maxItems: 2,
                                },
                                ideals: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    minItems: 1,
                                    maxItems: 2,
                                },
                                bonds: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    minItems: 1,
                                    maxItems: 2,
                                },
                                flaws: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    minItems: 1,
                                    maxItems: 2,
                                },
                            },
                            required: ['personalityTraits', 'ideals', 'bonds', 'flaws'],
                        },
                    },
                ],
                tool_choice: { type: 'tool', name: 'set_character_personality' },
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: [
                                    'Generate concise D&D 5e style personality fields for a new player character.',
                                    `Name: ${name}`,
                                    `Race: ${race.name}`,
                                    `Class: ${srdClass.name}`,
                                    `Race traits: ${race.traits.join(', ') || 'none'}`,
                                    `Class proficiencies: ${srdClass.proficiencies.join(', ') || 'none'}`,
                                    `Ability scores: STR ${abilityScores.STR}, DEX ${abilityScores.DEX}, CON ${abilityScores.CON}, INT ${abilityScores.INT}, WIS ${abilityScores.WIS}, CHA ${abilityScores.CHA}`,
                                    'Return 1-2 short entries for each field. Make them playable and specific, not melodramatic.',
                                ].join('\n'),
                            },
                        ],
                    },
                ],
            });
            /* eslint-enable @typescript-eslint/naming-convention */

            const toolUse = response.content.find(
                (content) => content.type === 'tool_use' && content.name === 'set_character_personality',
            );
            if (!toolUse || toolUse.type !== 'tool_use') {
                return this.emptyPersonality();
            }

            return this.normalizePersonality(toolUse.input as Partial<CharacterPersonality>);
        } catch {
            return this.emptyPersonality();
        }
    }

    private normalizePersonality(input: Partial<CharacterPersonality>): CharacterPersonality {
        const normalize = (items: unknown): string[] => (Array.isArray(items)
            ? items
                .filter(
                    (item): item is string => typeof item === 'string' && item.trim().length > 0,
                )
                .map((item) => item.trim())
                .slice(0, 2)
            : []);

        return {
            personalityTraits: normalize(input.personalityTraits),
            ideals: normalize(input.ideals),
            bonds: normalize(input.bonds),
            flaws: normalize(input.flaws),
        };
    }

    private emptyPersonality(): CharacterPersonality {
        return {
            personalityTraits: [],
            ideals: [],
            bonds: [],
            flaws: [],
        };
    }

    /**
     * Finds the character for a campaign the authenticated user owns.
     * @throws NotFoundException if not found or user does not own the campaign.
     */
    async findByCampaignId(campaignId: number, userId: number): Promise<Character> {
        const em = this.characterRepository.getEntityManager();
        const character = await em.findOne(
            Character,
            { campaign: { id: campaignId } },
            {
                populate: ['race', 'srdClass', 'campaign'] as Populate<
                    Character,
                    'race' | 'srdClass' | 'campaign'
                >,
            },
        );

        if (!character || character.campaign.userId !== userId) {
            throw new NotFoundException('Character not found');
        }

        return character;
    }

    /**
     * Finds a character by ID, verifying the authenticated user owns the campaign it belongs to.
     * @throws NotFoundException if not found or user does not own the campaign.
     */
    async findById(id: number, userId: number): Promise<Character> {
        const em = this.characterRepository.getEntityManager();
        const character = await em.findOne(
            Character,
            { id },
            {
                populate: ['race', 'srdClass', 'campaign'] as Populate<
                    Character,
                    'race' | 'srdClass' | 'campaign'
                >,
            },
        );

        if (!character || character.campaign.userId !== userId) {
            throw new NotFoundException('Character not found');
        }

        return character;
    }

    /**
     * Applies a partial state update to a character. Used exclusively by game engine tool call handlers.
     */
    async updateCharacterState(
        id: number,
        payload: UpdateCharacterStatePayload,
    ): Promise<Character> {
        const em = this.characterRepository.getEntityManager();
        const character = await em.findOneOrFail(Character, { id });

        Object.assign(character, payload);
        await em.flush();

        return character;
    }

    /**
     * Equips a CharacterItem to the given slot, verifying ownership and slot vacancy within a transaction.
     * @throws NotFoundException if the item is not found or the user does not own the character.
     * @throws ConflictException if the target slot is already occupied by another item.
     */
    async equipItem(
        characterItemId: number,
        slot: EquipSlot,
        userId: number,
    ): Promise<CharacterItem> {
        const em = this.characterItemRepository.getEntityManager();

        const characterItem = await em.findOne(
            CharacterItem,
            { id: characterItemId },
            {
                populate: ['character', 'character.campaign', 'item'] as Populate<
                    CharacterItem,
                    'character' | 'character.campaign' | 'item'
                >,
            },
        );

        if (!characterItem || characterItem.character.campaign.userId !== userId) {
            throw new NotFoundException('Item not found or access denied');
        }

        const transactionEm = em.fork();
        try {
            await transactionEm.begin();

            const item = await transactionEm.findOne(CharacterItem, { id: characterItemId });
            if (!item) {
                await transactionEm.rollback();
                throw new NotFoundException('Item not found');
            }

            const occupied = await transactionEm.findOne(CharacterItem, {
                character: characterItem.character,
                slot,
            });

            if (occupied) {
                await transactionEm.rollback();
                throw new ConflictException(`Slot ${slot} is already occupied`);
            }

            item.slot = slot;
            await transactionEm.flush();
            await transactionEm.commit();

            characterItem.slot = slot;
            return characterItem;
        } catch (error) {
            // rollback is idempotent if already rolled back above
            try {
                await transactionEm.rollback();
            } catch {
                /* ignore */
            }

            throw error;
        }
    }

    /**
     * Sets a CharacterItem's slot to null (carried but not equipped), verifying ownership.
     * @throws NotFoundException if the item is not found or the user does not own the character.
     */
    async unequipItem(characterItemId: number, userId: number): Promise<CharacterItem> {
        // Use a forked EM so we always load a fresh snapshot from the DB. Without this,
        // MikroORM may see the slot as unchanged (null → MAIN_HAND → null) when the same
        // parent EM was used in a preceding equipItem call, and skip the UPDATE.
        const em = this.characterItemRepository.getEntityManager().fork();

        const characterItem = await em.findOne(
            CharacterItem,
            { id: characterItemId },
            {
                populate: ['character', 'character.campaign', 'item'] as Populate<
                    CharacterItem,
                    'character' | 'character.campaign' | 'item'
                >,
            },
        );

        if (!characterItem || characterItem.character.campaign.userId !== userId) {
            throw new NotFoundException('Item not found or access denied');
        }

        characterItem.slot = null;
        await em.flush();

        return characterItem;
    }

    /**
     * Returns all CharacterItem records for a character, verifying the requesting user owns the campaign.
     * @throws NotFoundException if the character is not found or the user does not own it.
     */
    async getInventory(characterId: number, userId: number): Promise<CharacterItem[]> {
        const em = this.characterItemRepository.getEntityManager();

        const character = await em.findOne(
            Character,
            { id: characterId },
            { populate: ['campaign'] as Populate<Character, 'campaign'> },
        );

        if (!character || character.campaign.userId !== userId) {
            throw new NotFoundException('Character not found');
        }

        return em.find(
            CharacterItem,
            { character: { id: characterId } },
            {
                populate: ['item', 'item.srdEquipment'] as Populate<
                    CharacterItem,
                    'item' | 'item.srdEquipment'
                >,
            },
        );
    }
}
