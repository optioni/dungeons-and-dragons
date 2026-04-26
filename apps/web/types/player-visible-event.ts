export const PLAYER_VISIBLE_EVENT_CATEGORIES = [
    'COMBAT',
    'INVENTORY',
    'QUEST',
    'DISCOVERY',
    'TRAVEL',
    'RESOURCE',
] as const;

export type PlayerVisibleEventCategory = typeof PLAYER_VISIBLE_EVENT_CATEGORIES[number];

export type PlayerVisibleEventEntity = {
    type: string
    id?: string
    name: string
};

export type PlayerVisibleEventValue = string | number | boolean;

export type PlayerVisibleEventPayload = {
    category: PlayerVisibleEventCategory
    kind: string
    title: string
    summary?: string
    entities?: PlayerVisibleEventEntity[]
    values?: Record<string, PlayerVisibleEventValue>
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCategory(value: unknown): value is PlayerVisibleEventCategory {
    return typeof value === 'string'
        && PLAYER_VISIBLE_EVENT_CATEGORIES.includes(value as PlayerVisibleEventCategory);
}

function isEntity(value: unknown): value is PlayerVisibleEventEntity {
    return isRecord(value)
        && typeof value.type === 'string'
        && typeof value.name === 'string'
        && (value.id === undefined || typeof value.id === 'string');
}

function isVisibleValue(value: unknown): value is PlayerVisibleEventValue {
    return ['string', 'number', 'boolean'].includes(typeof value);
}

export function isPlayerVisibleEventPayload(value: unknown): value is PlayerVisibleEventPayload {
    if (!isRecord(value)) {
        return false;
    }

    if (!isCategory(value.category) || typeof value.kind !== 'string' || typeof value.title !== 'string') {
        return false;
    }

    if (value.summary !== undefined && typeof value.summary !== 'string') {
        return false;
    }

    if (value.entities !== undefined && (!Array.isArray(value.entities) || !value.entities.every(isEntity))) {
        return false;
    }

    if (value.values !== undefined) {
        if (!isRecord(value.values)) {
            return false;
        }

        if (!Object.values(value.values).every(isVisibleValue)) {
            return false;
        }
    }

    return true;
}

export function isTranscriptVisibleMechanicalEvent(value: unknown): value is PlayerVisibleEventPayload {
    if (!isPlayerVisibleEventPayload(value)) {
        return false;
    }

    return value.category !== 'COMBAT' || ['COMBAT_STARTED', 'COMBAT_ENDED', 'DEATH_SAVE_ROLLED', 'CHARACTER_DEATH'].includes(value.kind);
}
