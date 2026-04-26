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

const FORBIDDEN_PAYLOAD_KEYS = new Set([
    'toolInput',
    'toolResult',
    'input',
    'result',
    'raw',
    'rawInput',
    'rawResult',
    'dc',
    'armorClass',
    'passiveScore',
    'statBlock',
    'prompt',
    'model',
    'memories',
    'memorySearchText',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasForbiddenKey(value: unknown): boolean {
    if (Array.isArray(value)) {
        return value.some((item) => hasForbiddenKey(item));
    }

    if (!isRecord(value)) {
        return false;
    }

    return Object.entries(value).some(([key, child]) =>
        FORBIDDEN_PAYLOAD_KEYS.has(key) || hasForbiddenKey(child),
    );
}

function isCategory(value: unknown): value is PlayerVisibleEventCategory {
    return typeof value === 'string'
        && PLAYER_VISIBLE_EVENT_CATEGORIES.includes(value as PlayerVisibleEventCategory);
}

function isVisibleValue(value: unknown): value is PlayerVisibleEventValue {
    return ['string', 'number', 'boolean'].includes(typeof value);
}

function isEntity(value: unknown): value is PlayerVisibleEventEntity {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.type === 'string'
        && typeof value.name === 'string'
        && (value.id === undefined || typeof value.id === 'string');
}

/**
 * Validates that a payload has only renderer-safe fields and no raw tool envelopes.
 */
export function isPlayerVisibleEventPayload(value: unknown): value is PlayerVisibleEventPayload {
    if (!isRecord(value) || hasForbiddenKey(value)) {
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
