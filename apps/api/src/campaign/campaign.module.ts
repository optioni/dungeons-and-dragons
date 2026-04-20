import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { GraphqlModule } from '../graphql/graphql.module.js';
import { Faction } from '../world/entities/faction.entity.js';
import { LocationDiscovery } from '../world/entities/location-discovery.entity.js';
import { Location } from '../world/entities/location.entity.js';
import { MapLocation } from '../world/entities/map-location.entity.js';
import { Map } from '../world/entities/map.entity.js';
import { NpcItem } from '../world/entities/npc-item.entity.js';
import { NpcRelationship } from '../world/entities/npc-relationship.entity.js';
import { Npc } from '../world/entities/npc.entity.js';
import { WorldEvent } from '../world/entities/world-event.entity.js';
import { CampaignResolver } from './campaign.resolver.js';
import { CampaignService } from './campaign.service.js';
import { CampaignSetupService } from './campaign.setup.service.js';
import { Campaign } from './entities/campaign.entity.js';

/**
 * Owns the Campaign entity lifecycle: creation, ownership-scoped queries,
 * and the staged setup orchestration that produces a ready-to-play campaign.
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
    providers: [CampaignService, CampaignSetupService, CampaignResolver],
    exports: [CampaignService],
})
export class CampaignModule {}
