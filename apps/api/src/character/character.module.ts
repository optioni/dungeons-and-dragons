import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { GraphqlModule } from '../graphql/graphql.module.js';
import { CharacterResolver } from './character.resolver.js';
import { CharacterService } from './character.service.js';
import { CharacterItem } from './entities/character-item.entity.js';
import { Character } from './entities/character.entity.js';
import { Item } from './entities/item.entity.js';

@Module({
    imports: [GraphqlModule, MikroOrmModule.forFeature([Character, Item, CharacterItem])],
    providers: [CharacterService, CharacterResolver],
    exports: [CharacterService],
})
export class CharacterModule {}
