import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { Item } from '../character/entities/item.entity.js';
import { GraphqlModule } from '../graphql/graphql.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { GameSession } from '../session/entities/game-session.entity.js';
import { SrdMonster } from '../srd/entities/srd-monster.entity.js';
import { Location } from '../world/entities/location.entity.js';
import { Npc } from '../world/entities/npc.entity.js';
import { DungeonResolver } from './dungeon.resolver.js';
import { DungeonService } from './dungeon.service.js';
import { Dungeon } from './entities/dungeon.entity.js';
import { RoomEncounter } from './entities/room-encounter.entity.js';
import { RoomItem } from './entities/room-item.entity.js';

@Module({
    imports: [
        GraphqlModule,
        QueueModule,
        MikroOrmModule.forFeature([
            Campaign,
            Dungeon,
            RoomEncounter,
            RoomItem,
            Location,
            Item,
            GameSession,
            SrdMonster,
            Npc,
        ]),
    ],
    providers: [DungeonService, DungeonResolver],
    exports: [DungeonService],
})
export class DungeonModule {}
