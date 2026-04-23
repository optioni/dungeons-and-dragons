import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, type EntityRepository } from '@mikro-orm/postgresql';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
    ForbiddenException, Inject, Injectable, NotFoundException,
} from '@nestjs/common';
import { type Cache } from 'cache-manager';
import { type Connection } from 'graphql-relay';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { Item } from '../character/entities/item.entity.js';
import { GraphqlService } from '../graphql/graphql.service.js';
import { type ConnectionArgs } from '../graphql/relay';
import { GameSession } from '../session/entities/game-session.entity.js';
import { SrdMonster } from '../srd/entities/srd-monster.entity.js';
import { Location } from '../world/entities/location.entity.js';
import { Npc } from '../world/entities/npc.entity.js';
import { RoomState } from './dungeon.enums.js';
import { Dungeon, type EncounterTableEntry, type MonsterSpec } from './entities/dungeon.entity.js';
import { RoomEncounter } from './entities/room-encounter.entity.js';
import { RoomItem } from './entities/room-item.entity.js';

/**
 * Owns dungeon persistence and room-scoped state changes.
 */
@Injectable()
export class DungeonService {
    constructor(
        private readonly em: EntityManager,
        @Inject(CACHE_MANAGER)
        private readonly cache: Cache,
        @InjectRepository(Dungeon)
        private readonly dungeonRepo: EntityRepository<Dungeon>,
        @InjectRepository(RoomEncounter)
        private readonly roomEncounterRepo: EntityRepository<RoomEncounter>,
        @InjectRepository(RoomItem)
        private readonly roomItemRepo: EntityRepository<RoomItem>,
        @InjectRepository(Location)
        private readonly locationRepo: EntityRepository<Location>,
        @InjectRepository(Item)
        private readonly itemRepo: EntityRepository<Item>,
        @InjectRepository(GameSession)
        private readonly sessionRepo: EntityRepository<GameSession>,
        @InjectRepository(Campaign)
        private readonly campaignRepo: EntityRepository<Campaign>,
        @InjectRepository(SrdMonster)
        private readonly srdMonsterRepo: EntityRepository<SrdMonster>,
        @InjectRepository(Npc)
        private readonly npcRepo: EntityRepository<Npc>,
    ) {}

    async verifyCampaignOwnership(campaignId: number, userId: number): Promise<Campaign> {
        const campaign = await this.campaignRepo.findOne({ id: campaignId, userId });
        if (!campaign) {
            throw new ForbiddenException('Campaign not found or access denied');
        }

        return campaign;
    }

    async createDungeon(
        campaignId: number,
        userId: number,
        fields: {
            name: string
            description: string
            totalFloors?: number
            encounterTable?: EncounterTableEntry[] | null
        },
    ): Promise<Dungeon> {
        const campaign = await this.verifyCampaignOwnership(campaignId, userId);
        const dungeon = this.em.create(Dungeon, {
            campaign,
            name: fields.name,
            description: fields.description,
            totalFloors: fields.totalFloors ?? 1,
            encounterTable: fields.encounterTable ?? null,
        });
        this.em.persist(dungeon);
        await this.em.flush();
        return dungeon;
    }

    async getDungeons(
        campaignId: number,
        userId: number,
        connArgs: ConnectionArgs,
        graphqlService: GraphqlService,
    ): Promise<Connection<Dungeon>> {
        await this.verifyCampaignOwnership(campaignId, userId);
        const qb = this.dungeonRepo.createQueryBuilder();
        return graphqlService.findAndPaginate(qb.andWhere({ campaign: campaignId }), undefined, undefined, connArgs);
    }

    async getRoomEncounters(
        dungeonId: number,
        userId: number,
        connArgs: ConnectionArgs,
        graphqlService: GraphqlService,
    ): Promise<Connection<RoomEncounter>> {
        const dungeon = await this.dungeonRepo.findOne({ id: dungeonId }, { populate: ['campaign'] });
        if (!dungeon || dungeon.campaign.userId !== userId) {
            throw new NotFoundException('Dungeon not found');
        }

        const qb = this.roomEncounterRepo.createQueryBuilder('re')
            .leftJoin('re.room', 'room')
            // eslint-disable-next-line @typescript-eslint/naming-convention
            .andWhere({ 'room.dungeon': dungeonId });
        return graphqlService.findAndPaginate(qb, undefined, undefined, connArgs);
    }

    async getRoomItems(roomId: number, userId: number): Promise<RoomItem[]> {
        const room = await this.locationRepo.findOne({ id: roomId }, { populate: ['dungeon.campaign'] });
        if (!room || !room.dungeon || room.dungeon.campaign.userId !== userId) {
            throw new NotFoundException('Room not found');
        }

        return this.roomItemRepo.find({ room: roomId }, { populate: ['item'] });
    }

    async findByRoom(roomId: number): Promise<Dungeon | null> {
        const room = await this.locationRepo.findOne({ id: roomId }, { populate: ['dungeon'] });
        return room?.dungeon ?? null;
    }

    async findActiveDungeon(sessionId: number): Promise<Dungeon | null> {
        const session = await this.sessionRepo.findOne({ id: sessionId }, { populate: ['activeDungeon'] });
        return session?.activeDungeon ?? null;
    }

    async addRoomItem(
        roomId: number,
        itemId: number,
        quantity = 1,
        containerName: string | null = null,
    ): Promise<RoomItem> {
        const room = await this.locationRepo.findOne({ id: roomId });
        if (!room) {
            throw new NotFoundException('Room not found');
        }

        const item = await this.itemRepo.findOne({ id: itemId });
        if (!item) {
            throw new NotFoundException('Item not found');
        }

        const roomItem = this.em.create(RoomItem, {
            room,
            item,
            quantity,
            containerName,
        });
        this.em.persist(roomItem);
        await this.em.flush();
        return roomItem;
    }

    async removeRoomItem(roomItemId: number, quantity = 1): Promise<boolean> {
        const roomItem = await this.roomItemRepo.findOne({ id: roomItemId });
        if (!roomItem) {
            return false;
        }

        roomItem.quantity -= quantity;
        if (roomItem.quantity <= 0) {
            this.em.remove(roomItem);
        }

        await this.em.flush();
        return true;
    }

    async updateRoomState(roomId: number, roomState: RoomState): Promise<Location> {
        const room = await this.locationRepo.findOne({ id: roomId });
        if (!room) {
            throw new NotFoundException('Room not found');
        }

        room.roomState = roomState;
        await this.em.flush();
        return room;
    }

    async spawnEncounter(input: {
        campaignId: number
        roomId?: number
        dungeonId?: number
        fromTable?: boolean
    }): Promise<{ npcIds: number[]; source: 'ROOM' | 'WANDERING' }> {
        if (input.roomId !== undefined) {
            const room = await this.locationRepo.findOne({ id: input.roomId }, { populate: ['dungeon'] });
            if (!room || !room.dungeon) {
                throw new Error('ROOM_NOT_FOUND');
            }

            const encounter = await this.roomEncounterRepo.findOne(
                { room: input.roomId, cleared: false },
                { populate: ['room'] },
            );
            if (!encounter) {
                const clearedEncounter = await this.roomEncounterRepo.findOne({ room: input.roomId, cleared: true });
                if (clearedEncounter) {
                    throw new Error('ENCOUNTER_ALREADY_CLEARED');
                }

                throw new Error('ENCOUNTER_NOT_FOUND');
            }

            const roomNpcIds = await this.materializeMonsterSpecs(
                input.campaignId,
                encounter.room.id,
                encounter.monsters,
            );
            return { npcIds: roomNpcIds, source: 'ROOM' };
        }

        if (input.dungeonId === undefined || input.fromTable !== true) {
            throw new Error('ENCOUNTER_SOURCE_NOT_FOUND');
        }

        const dungeon = await this.dungeonRepo.findOne({ id: input.dungeonId });
        const tableEntry = this.pickEncounterTableEntry(dungeon?.encounterTable ?? null);
        if (!dungeon || !tableEntry) {
            throw new Error(dungeon ? 'NO_ENCOUNTER_TABLE' : 'DUNGEON_NOT_FOUND');
        }

        const wanderingNpcIds = await this.materializeMonsterSpecs(input.campaignId, null, tableEntry.monsters);
        return { npcIds: wanderingNpcIds, source: 'WANDERING' };
    }

    private pickEncounterTableEntry(table: EncounterTableEntry[] | null): EncounterTableEntry | null {
        if (!table || table.length === 0) {
            return null;
        }

        const totalWeight = table.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
        if (totalWeight <= 0) {
            return table[0] ?? null;
        }

        let roll = Math.random() * totalWeight;
        for (const entry of table) {
            roll -= Math.max(0, entry.weight);
            if (roll <= 0) {
                return entry;
            }
        }

        return table.at(-1) ?? null;
    }

    private async materializeMonsterSpecs(
        campaignId: number,
        roomId: number | null,
        specs: MonsterSpec[],
    ): Promise<number[]> {
        const npcIds: number[] = [];

        for (const spec of specs) {
            const srdMonster = spec.srdIndex
                ? await this.getCachedSrdMonster(spec.srdIndex)
                : null;
            if (spec.srdIndex && !srdMonster) {
                throw new Error('MONSTER_NOT_FOUND');
            }

            for (let index = 0; index < spec.count; index += 1) {
                const needsSuffix = spec.count > 1;
                const npc = this.em.create(Npc, {
                    campaignId,
                    name: needsSuffix ? `${spec.name} ${index + 1}` : spec.name,
                    hp: spec.hp ?? srdMonster?.hitPoints ?? 1,
                    maxHp: spec.hp ?? srdMonster?.hitPoints ?? 1,
                    currentLocationId: roomId,
                    alive: true,
                });
                this.em.persist(npc);
                await this.em.flush();
                npcIds.push(npc.id);
            }
        }

        return npcIds;
    }

    private async getCachedSrdMonster(index: string): Promise<SrdMonster | null> {
        const cacheKey = `srd:monster:${index}`;
        const cachedMonster = await this.cache.get<SrdMonster>(cacheKey);
        if (cachedMonster) {
            return cachedMonster;
        }

        const monster = await this.srdMonsterRepo.findOne({ index });
        if (monster) {
            await this.cache.set(cacheKey, monster);
        }

        return monster;
    }
}
