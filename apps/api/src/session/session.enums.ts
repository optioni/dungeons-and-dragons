import { registerEnumType } from '@nestjs/graphql';

export enum SceneType {
    EXPLORATION = 'EXPLORATION',
    DUNGEON = 'DUNGEON',
    COMBAT = 'COMBAT',
    SOCIAL = 'SOCIAL',
    SETTLEMENT = 'SETTLEMENT',
    REST = 'REST',
}

export enum EventType {
    PLAYER_INPUT = 'PLAYER_INPUT',
    DM_NARRATIVE = 'DM_NARRATIVE',
    TOOL_CALL = 'TOOL_CALL',
    DICE_ROLL = 'DICE_ROLL',
    PLAYER_VISIBLE_EVENT = 'PLAYER_VISIBLE_EVENT',
    SYSTEM = 'SYSTEM',
}

registerEnumType(SceneType, { name: 'SceneType' });
registerEnumType(EventType, { name: 'EventType' });
