import {
    Args, ID, Mutation, Query, Resolver,
} from '@nestjs/graphql';

import { type User } from '../auth/entities/user.entity.js';
import { CurrentUser } from '../graphql/decorators/current-user.decorator.js';
import { EquipSlot } from './character.enums.js';
import { CharacterService } from './character.service.js';
import { CreateCharacterInput } from './dto/create-character.input.js';
import { CharacterItem } from './entities/character-item.entity.js';
import { Character } from './entities/character.entity.js';

/**
 * GraphQL resolver for character sheet queries and character lifecycle mutations.
 * All operations require authentication via the global AuthGuard.
 */
@Resolver(() => Character)
export class CharacterResolver {
    constructor(private readonly characterService: CharacterService) {}

    /**
     * Creates a new character for the authenticated user's campaign.
     * Validates ability scores and derives initial state from SRD race and class data.
     */
    @Mutation(() => Character)
    async createCharacter(
        @Args('input') input: CreateCharacterInput,
        @CurrentUser() user: User,
    ): Promise<Character> {
        return this.characterService.create(input, user);
    }

    /**
     * Returns the full character sheet for a character the authenticated user owns.
     */
    @Query(() => Character)
    async character(
        @Args('id', { type: () => ID }) id: string,
        @CurrentUser() user: User,
    ): Promise<Character> {
        return this.characterService.findById(Number(id), user.id);
    }

    /**
     * Returns all inventory items for a character the authenticated user owns.
     */
    @Query(() => [CharacterItem])
    async characterInventory(
        @Args('characterId', { type: () => ID }) characterId: string,
        @CurrentUser() user: User,
    ): Promise<CharacterItem[]> {
        return this.characterService.getInventory(Number(characterId), user.id);
    }

    /**
     * Equips a CharacterItem to a slot. Throws ConflictException if the slot is occupied.
     */
    @Mutation(() => CharacterItem)
    async equipItem(
        @Args('characterItemId', { type: () => ID }) characterItemId: string,
        @Args('slot', { type: () => EquipSlot }) slot: EquipSlot,
        @CurrentUser() user: User,
    ): Promise<CharacterItem> {
        return this.characterService.equipItem(Number(characterItemId), slot, user.id);
    }

    /**
     * Unequips a CharacterItem (sets slot to null). Item remains in inventory.
     */
    @Mutation(() => CharacterItem)
    async unequipItem(
        @Args('characterItemId', { type: () => ID }) characterItemId: string,
        @CurrentUser() user: User,
    ): Promise<CharacterItem> {
        return this.characterService.unequipItem(Number(characterItemId), user.id);
    }
}
