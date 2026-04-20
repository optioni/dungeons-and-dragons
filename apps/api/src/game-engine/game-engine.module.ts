import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module, forwardRef } from '@nestjs/common';

import { CampaignModule } from '../campaign/campaign.module.js';
import { Campaign } from '../campaign/entities/campaign.entity.js';
import { CharacterItem } from '../character/entities/character-item.entity.js';
import { Character } from '../character/entities/character.entity.js';
import { Item } from '../character/entities/item.entity.js';
import { LlmModule } from '../llm/llm.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { QuestModule } from '../quest/quest.module.js';
import { Quest } from '../quest/entities/quest.entity.js';
import { CombatSession } from '../session/entities/combat-session.entity.js';
import { GameEvent } from '../session/entities/game-event.entity.js';
import { GameSession } from '../session/entities/game-session.entity.js';
import { SessionModule } from '../session/session.module.js';
import { Faction } from '../world/entities/faction.entity.js';
import { LocationDiscovery } from '../world/entities/location-discovery.entity.js';
import { Location } from '../world/entities/location.entity.js';
import { MapLocation } from '../world/entities/map-location.entity.js';
import { NpcItem } from '../world/entities/npc-item.entity.js';
import { Npc } from '../world/entities/npc.entity.js';
import { WorldEvent } from '../world/entities/world-event.entity.js';
import { CombatService } from './combat.service.js';
import { DiceChecksService } from './dice-checks.service.js';
import { DiceService } from './dice.service.js';
import { GameEngineToolRegistrar } from './game-engine-tool-registrar.service.js';
import { GameEngineResolver } from './game-engine.resolver.js';
import { ItemService } from './item.service.js';
import { LevelingService } from './leveling.service.js';
import { RestService } from './rest.service.js';
import { TravelService } from './travel.service.js';
import { WorldMutationService } from './world-mutation.service.js';

/**
 * Owns all D&D 5e game mechanics: dice, combat, rest, travel, items, leveling,
 * and world mutations. Registers all LLM tool handlers via GameEngineToolRegistrar.
 */
@Module({
    imports: [
        MikroOrmModule.forFeature([
            Campaign,
            Character,
            CharacterItem,
            CombatSession,
            Faction,
            GameEvent,
            GameSession,
            Item,
            Location,
            LocationDiscovery,
            MapLocation,
            Npc,
            NpcItem,
            Quest,
            WorldEvent,
        ]),
        LlmModule,
        MemoryModule,
        QueueModule,
        QuestModule,
        forwardRef(() => CampaignModule),
        forwardRef(() => SessionModule),
    ],
    providers: [
        DiceService,
        DiceChecksService,
        CombatService,
        RestService,
        TravelService,
        ItemService,
        LevelingService,
        WorldMutationService,
        GameEngineToolRegistrar,
        GameEngineResolver,
    ],
    exports: [
        DiceService,
        DiceChecksService,
        CombatService,
        RestService,
        TravelService,
        ItemService,
        LevelingService,
        WorldMutationService,
    ],
})
export class GameEngineModule {}
