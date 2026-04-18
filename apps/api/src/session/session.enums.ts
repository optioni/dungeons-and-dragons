import { registerEnumType } from '@nestjs/graphql';

export enum SceneType {
    EXPLORATION = 'EXPLORATION',
    COMBAT = 'COMBAT',
    SOCIAL = 'SOCIAL',
    SETTLEMENT = 'SETTLEMENT',
    REST = 'REST',
}

export enum EventType {
    PLAYER_INPUT = 'PLAYER_INPUT',
    DM_NARRATIVE = 'DM_NARRATIVE',
    TOOL_CALL = 'TOOL_CALL',
    SYSTEM = 'SYSTEM',
}

registerEnumType(SceneType, { name: 'SceneType' });
registerEnumType(EventType, { name: 'EventType' });
