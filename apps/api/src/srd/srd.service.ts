import { InjectRepository } from '@mikro-orm/nestjs';
import { type EntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { type Connection } from 'graphql-relay';

import { type ConnectionArgs } from '../graphql/relay/index.js';
import { GraphqlService } from '../graphql/graphql.service.js';
import { SrdClass } from './entities/srd-class.entity.js';
import { SrdCondition } from './entities/srd-condition.entity.js';
import { SrdEquipment } from './entities/srd-equipment.entity.js';
import { SrdMonster } from './entities/srd-monster.entity.js';
import { SrdRace } from './entities/srd-race.entity.js';
import { SrdSpell } from './entities/srd-spell.entity.js';
import { type SrdEquipmentWhereInput } from './inputs/srd-equipment-where.input.js';
import { type SrdMonsterWhereInput } from './inputs/srd-monster-where.input.js';
import { type SrdSpellWhereInput } from './inputs/srd-spell-where.input.js';

@Injectable()
export class SrdService {
    constructor(
        private readonly graphqlService: GraphqlService,
        @InjectRepository(SrdClass)
        private readonly classRepo: EntityRepository<SrdClass>,
        @InjectRepository(SrdRace)
        private readonly raceRepo: EntityRepository<SrdRace>,
        @InjectRepository(SrdSpell)
        private readonly spellRepo: EntityRepository<SrdSpell>,
        @InjectRepository(SrdMonster)
        private readonly monsterRepo: EntityRepository<SrdMonster>,
        @InjectRepository(SrdEquipment)
        private readonly equipmentRepo: EntityRepository<SrdEquipment>,
        @InjectRepository(SrdCondition)
        private readonly conditionRepo: EntityRepository<SrdCondition>,
    ) {}

    async getClasses(connArgs: ConnectionArgs): Promise<Connection<SrdClass>> {
        return this.graphqlService.findAndPaginate(this.classRepo, undefined, undefined, connArgs);
    }

    async getClass(index: string): Promise<SrdClass | null> {
        return this.classRepo.findOne({ index });
    }

    async getRaces(connArgs: ConnectionArgs): Promise<Connection<SrdRace>> {
        return this.graphqlService.findAndPaginate(this.raceRepo, undefined, undefined, connArgs);
    }

    async getRace(index: string): Promise<SrdRace | null> {
        return this.raceRepo.findOne({ index });
    }

    async getSpells(
        connArgs: ConnectionArgs,
        where?: SrdSpellWhereInput,
    ): Promise<Connection<SrdSpell>> {
        return this.graphqlService.findAndPaginate(this.spellRepo, where, undefined, connArgs);
    }

    async getSpell(index: string): Promise<SrdSpell | null> {
        return this.spellRepo.findOne({ index });
    }

    async getMonsters(
        connArgs: ConnectionArgs,
        where?: SrdMonsterWhereInput,
    ): Promise<Connection<SrdMonster>> {
        return this.graphqlService.findAndPaginate(this.monsterRepo, where, undefined, connArgs);
    }

    async getMonster(index: string): Promise<SrdMonster | null> {
        return this.monsterRepo.findOne({ index });
    }

    async getEquipment(
        connArgs: ConnectionArgs,
        where?: SrdEquipmentWhereInput,
    ): Promise<Connection<SrdEquipment>> {
        return this.graphqlService.findAndPaginate(this.equipmentRepo, where, undefined, connArgs);
    }

    async getEquipmentItem(index: string): Promise<SrdEquipment | null> {
        return this.equipmentRepo.findOne({ index });
    }

    async getConditions(connArgs: ConnectionArgs): Promise<Connection<SrdCondition>> {
        return this.graphqlService.findAndPaginate(this.conditionRepo, undefined, undefined, connArgs);
    }

    async getCondition(index: string): Promise<SrdCondition | null> {
        return this.conditionRepo.findOne({ index });
    }
}
