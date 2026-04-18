import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { GraphqlModule } from '../graphql/graphql.module.js';
import { SrdClass } from './entities/srd-class.entity.js';
import { SrdCondition } from './entities/srd-condition.entity.js';
import { SrdEquipment } from './entities/srd-equipment.entity.js';
import { SrdMonster } from './entities/srd-monster.entity.js';
import { SrdRace } from './entities/srd-race.entity.js';
import { SrdSpell } from './entities/srd-spell.entity.js';
import { SrdClassResolver } from './srd-class.resolver.js';
import { SrdConditionResolver } from './srd-condition.resolver.js';
import { SrdEquipmentResolver } from './srd-equipment.resolver.js';
import { SrdMonsterResolver } from './srd-monster.resolver.js';
import { SrdRaceResolver } from './srd-race.resolver.js';
import { SrdSpellResolver } from './srd-spell.resolver.js';
import { SrdService } from './srd.service.js';

@Module({
    imports: [
        GraphqlModule,
        MikroOrmModule.forFeature([
            SrdClass,
            SrdRace,
            SrdSpell,
            SrdMonster,
            SrdEquipment,
            SrdCondition,
        ]),
    ],
    providers: [
        SrdService,
        SrdClassResolver,
        SrdRaceResolver,
        SrdSpellResolver,
        SrdMonsterResolver,
        SrdEquipmentResolver,
        SrdConditionResolver,
    ],
})
export class SrdModule {}
