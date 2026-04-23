import { registerEnumType } from '@nestjs/graphql';

export enum QuestStatus {
    ACTIVE = 'ACTIVE',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

export enum QuestObjectiveType {
    REACH_LOCATION = 'REACH_LOCATION',
    NPC_DEAD = 'NPC_DEAD',
    NPC_ALIVE = 'NPC_ALIVE',
    HAVE_ITEM = 'HAVE_ITEM',
    TALK_TO_NPC = 'TALK_TO_NPC',
    MANUAL = 'MANUAL',
}

export enum QuestObjectiveStatus {
    INCOMPLETE = 'INCOMPLETE',
    COMPLETE = 'COMPLETE',
}

export enum QuestEntityType {
    NPC = 'NPC',
    LOCATION = 'LOCATION',
    ITEM = 'ITEM',
    DUNGEON = 'DUNGEON',
    WORLD_EVENT = 'WORLD_EVENT',
}

registerEnumType(QuestStatus, { name: 'QuestStatus' });
registerEnumType(QuestObjectiveType, { name: 'QuestObjectiveType' });
registerEnumType(QuestObjectiveStatus, { name: 'QuestObjectiveStatus' });
registerEnumType(QuestEntityType, { name: 'QuestEntityType' });
