import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { GraphqlModule } from '../graphql/graphql.module.js';
import { Faction } from './entities/faction.entity.js';
import { Location } from './entities/location.entity.js';
import { LocationDiscovery } from './entities/location-discovery.entity.js';
import { Map } from './entities/map.entity.js';
import { MapLocation } from './entities/map-location.entity.js';
import { Npc } from './entities/npc.entity.js';
import { NpcItem } from './entities/npc-item.entity.js';
import { NpcRelationship } from './entities/npc-relationship.entity.js';
import { WorldEvent } from './entities/world-event.entity.js';
import { WorldResolver } from './world.resolver.js';
import { WorldService } from './world.service.js';

/**
 * Owns all campaign-scoped world and NPC entities: locations, maps, factions,
 * world events, NPCs, relationships, and items.
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
    ],
    providers: [WorldService, WorldResolver],
    exports: [WorldService],
})
export class WorldModule {}
