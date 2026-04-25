export const STATE_CHANGED_EVENT = 'engine.state-changed';

export type StateChangedType = 'TRAVEL' | 'DAMAGE' | 'GIVE_ITEM' | 'NPC_UPDATE' | 'NPC_KILLED' | 'NPC_CREATED';

export class StateChangedEvent {
    constructor(
        readonly type: StateChangedType,
        readonly entityId: string,
        readonly campaignId: number,
    ) {}
}
