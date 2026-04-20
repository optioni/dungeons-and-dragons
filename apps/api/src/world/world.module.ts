import Anthropic from '@anthropic-ai/sdk';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { GraphqlModule } from '../graphql/graphql.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { ANTHROPIC_CLIENT, BACKGROUND_MODEL } from '../memory/memory.service.js';
import { QueueModule } from '../queue/queue.module.js';
import { Faction } from './entities/faction.entity.js';
import { LocationDiscovery } from './entities/location-discovery.entity.js';
import { Location } from './entities/location.entity.js';
import { MapLocation } from './entities/map-location.entity.js';
import { Map } from './entities/map.entity.js';
import { NpcItem } from './entities/npc-item.entity.js';
import { NpcRelationship } from './entities/npc-relationship.entity.js';
import { Npc } from './entities/npc.entity.js';
import { WorldEvent } from './entities/world-event.entity.js';
import { WorldTickWorker } from './world-tick.worker.js';
import { WorldResolver } from './world.resolver.js';
import { WorldService } from './world.service.js';

/**
 * Owns all campaign-scoped world and NPC entities: locations, maps, factions,
 * world events, NPCs, relationships, and items. Also runs the world-tick BullMQ worker.
 */
@Module({
    imports: [
        GraphqlModule,
        MikroOrmModule.forFeature([
            Campaign,
            Location,
            Map,
            MapLocation,
            LocationDiscovery,
            Faction,
            WorldEvent,
            Npc,
            NpcRelationship,
            NpcItem,
        ]),
        MemoryModule,
        QueueModule,
    ],
    providers: [
        WorldService,
        WorldResolver,
        WorldTickWorker,
        {
            provide: ANTHROPIC_CLIENT,
            useFactory: (config: ConfigService) => new Anthropic({ apiKey: config.getOrThrow<string>('ANTHROPIC_API_KEY') }),
            inject: [ConfigService],
        },
        {
            provide: BACKGROUND_MODEL,
            useFactory: (config: ConfigService) => config.getOrThrow<string>('LLM_BACKGROUND_MODEL'),
            inject: [ConfigService],
        },
    ],
    exports: [WorldService],
})
export class WorldModule {}
