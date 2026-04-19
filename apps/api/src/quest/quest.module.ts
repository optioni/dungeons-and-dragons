import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { Character } from '../character/entities/character.entity.js';
import { CharacterItem } from '../character/entities/character-item.entity.js';
import { GraphqlModule } from '../graphql/graphql.module.js';
import { Item } from '../character/entities/item.entity.js';
import { Npc } from '../world/entities/npc.entity.js';
import { Location } from '../world/entities/location.entity.js';
import { WorldEvent } from '../world/entities/world-event.entity.js';
import { QuestEntity } from './entities/quest-entity.entity.js';
import { QuestObjective } from './entities/quest-objective.entity.js';
import { Quest } from './entities/quest.entity.js';
import { QuestResolver } from './quest.resolver.js';
import { QuestService } from './quest.service.js';

/**
 * Owns Quest, QuestObjective, and QuestEntity entities plus QuestService and QuestResolver.
 * Imported by GameEngineModule for the auto-checker and tool registrar.
 */
@Module({
    imports: [
        GraphqlModule,
        MikroOrmModule.forFeature([
            Quest,
            QuestObjective,
            QuestEntity,
            Campaign,
            Character,
            CharacterItem,
            Item,
            Location,
            Npc,
            WorldEvent,
        ]),
    ],
    providers: [QuestService, QuestResolver],
    exports: [QuestService],
})
export class QuestModule {}
