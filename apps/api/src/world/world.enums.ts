import { registerEnumType } from '@nestjs/graphql';

export enum MapScale {
    WORLD = 'WORLD',
    REGIONAL = 'REGIONAL',
    LOCAL = 'LOCAL',
    DUNGEON = 'DUNGEON',
}

export enum LocationDiscoverySource {
    SETUP = 'SETUP',
    PLAYER_ACTION = 'PLAYER_ACTION',
    WORLD_TICK = 'WORLD_TICK',
    MAP = 'MAP',
    NPC = 'NPC',
    EXPLORATION = 'EXPLORATION',
    QUEST = 'QUEST',
}

export enum WorldEventSource {
    SETUP = 'SETUP',
    PLAYER_ACTION = 'PLAYER_ACTION',
    WORLD_TICK = 'WORLD_TICK',
    CATASTROPHE = 'CATASTROPHE',
}

export enum WorldEventStatus {
    ACTIVE = 'ACTIVE',
    RESOLVED = 'RESOLVED',
    EXPIRED = 'EXPIRED',
}

export enum NpcPartyStatus {
    NONE = 'NONE',
    ALLY = 'ALLY',
    COMPANION = 'COMPANION',
    ENEMY = 'ENEMY',
}

export enum NpcRelationshipType {
    ALLY = 'ALLY',
    RIVAL = 'RIVAL',
    ENEMY = 'ENEMY',
    NEUTRAL = 'NEUTRAL',
    FAMILY = 'FAMILY',
    MENTOR = 'MENTOR',
    STUDENT = 'STUDENT',
}

registerEnumType(MapScale, { name: 'MapScale' });
registerEnumType(LocationDiscoverySource, { name: 'LocationDiscoverySource' });
registerEnumType(WorldEventSource, { name: 'WorldEventSource' });
registerEnumType(WorldEventStatus, { name: 'WorldEventStatus' });
registerEnumType(NpcPartyStatus, { name: 'NpcPartyStatus' });
registerEnumType(NpcRelationshipType, { name: 'NpcRelationshipType' });
