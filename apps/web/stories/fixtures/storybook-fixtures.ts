import { type PlayerVisibleEventPayload } from '../../types/player-visible-event';

export interface StoryGameEvent {
    id: string
    eventType: 'DM_NARRATIVE' | 'PLAYER_INPUT' | 'DICE_ROLL' | 'PLAYER_VISIBLE_EVENT'
    content: Record<string, unknown>
    createdAt: string
}

interface StoryCombatant {
    id: string
    type: 'CHARACTER' | 'NPC'
    name: string
    initiativeRoll: number
    currentHp: number
    maxHp: number
    conditions: string[]
    usedAction: boolean
    usedBonusAction: boolean
    usedReaction: boolean
    movementUsed: number
}

interface StoryCombatSession {
    id: string
    roundNumber: number
    currentTurnIndex: number
    combatants: StoryCombatant[]
}

interface StorySpellSlot {
    level: number
    total: number
    used: number
}

interface StoryWorldMapCoords {
    x: number
    y: number
}

interface StoryWorldMapNode {
    id: string
    name: string
    coordinates: StoryWorldMapCoords | null
    currentState: string | null
    connectedLocationIds: string[]
    hasActivityMarker: boolean
}

interface StoryWorldMapFrontierNode {
    id: string
    coordinates: StoryWorldMapCoords | null
    connectedDiscoveredIds: string[]
}

interface StoryWorldMapEdge {
    fromId: string
    toId: string
}

export const campaignId = 'campaign-storybook';
export const characterId = 'char-elyra';

export const sessionHeaderStates = {
    exploration: {
        campaignId,
        locationName: 'The Blackroot Road',
        sceneType: 'Exploration',
        inGameDate: '18 Eleint, 1492 DR',
        hp: 24,
        maxHp: 31,
    },
    combat: {
        campaignId,
        locationName: 'Ruined Watchtower',
        sceneType: 'Combat',
        inGameDate: '18 Eleint, 1492 DR',
        hp: 16,
        maxHp: 31,
    },
    rest: {
        campaignId,
        locationName: 'Wayside Shrine',
        sceneType: 'Rest',
        inGameDate: '19 Eleint, 1492 DR',
        hp: 31,
        maxHp: 31,
    },
    lowHp: {
        campaignId,
        locationName: 'Ashen Ford',
        sceneType: 'Combat',
        inGameDate: '18 Eleint, 1492 DR',
        hp: 6,
        maxHp: 31,
    },
    missingLocation: {
        campaignId,
        locationName: null,
        sceneType: 'Social',
        inGameDate: '18 Eleint, 1492 DR',
        hp: 22,
        maxHp: 31,
    },
};

export const mechanicalEvents = {
    combatStarted: {
        category: 'COMBAT',
        kind: 'COMBAT_STARTED',
        title: 'Combat begins',
        summary: 'Goblins spill from the brambles.',
    },
    questProgress: {
        category: 'QUEST',
        kind: 'OBJECTIVE_COMPLETED',
        title: 'Find the shrine key',
        entities: [{ type: 'Objective', id: 'obj-key', name: 'Find the shrine key' }],
    },
    worldEvent: {
        category: 'DISCOVERY',
        kind: 'LOCATION_DISCOVERED',
        title: 'Moonwell Hollow',
        entities: [{ type: 'Location', id: 'loc-moonwell', name: 'Moonwell Hollow' }],
    },
    rejectedPayload: {
        category: 'INVENTORY',
        kind: 'ITEM_GAINED',
        title: 'Item gained',
        entities: [{ type: 'Item', id: 'item-ember-vial', name: 'Ember Vial' }],
        values: { quantity: 2 },
    },
} satisfies Record<string, PlayerVisibleEventPayload>;

export const openingTranscriptEvents: StoryGameEvent[] = [
    {
        id: 'evt-opening-1',
        eventType: 'DM_NARRATIVE',
        createdAt: '2026-04-27T08:00:00.000Z',
        content: {
            narrative: 'A copper bell rings once in the fog. Beyond the milestone, the road sinks into black pines and the smell of rain.',
        },
    },
    {
        id: 'evt-opening-2',
        eventType: 'PLAYER_INPUT',
        createdAt: '2026-04-27T08:01:00.000Z',
        content: {
            text: 'I draw my cloak tight and look for tracks near the roadside mud.',
        },
    },
    {
        id: 'evt-opening-3',
        eventType: 'DICE_ROLL',
        createdAt: '2026-04-27T08:02:00.000Z',
        content: {
            tool: 'check_skill',
            skill: 'Survival',
            roll: 15,
            modifier: 4,
            total: 19,
            dc: 14,
            passed: true,
        },
    },
    {
        id: 'evt-opening-4',
        eventType: 'PLAYER_VISIBLE_EVENT',
        createdAt: '2026-04-27T08:03:00.000Z',
        content: mechanicalEvents.worldEvent,
    },
];

export const longTranscriptEvents: StoryGameEvent[] = Array.from({ length: 8 }, (_, index) => {
    const turn = index + 1;
    return turn % 2 === 0
        ? {
            id: `evt-long-player-${turn}`,
            eventType: 'PLAYER_INPUT',
            createdAt: `2026-04-27T08:${String(turn).padStart(2, '0')}:00.000Z`,
            content: { text: 'I keep my lantern low and ask what price the ferryman expects.' },
        }
        : {
            id: `evt-long-dm-${turn}`,
            eventType: 'DM_NARRATIVE',
            createdAt: `2026-04-27T08:${String(turn).padStart(2, '0')}:00.000Z`,
            content: {
                narrative: 'The river answers before the ferryman does. Black water paws at the dock posts, and a pale shape turns beneath the surface.',
            },
        };
});

export const suggestedActionTranscriptEvents: StoryGameEvent[] = [
    ...openingTranscriptEvents,
    {
        id: 'evt-suggestion',
        eventType: 'DM_NARRATIVE',
        createdAt: '2026-04-27T08:04:00.000Z',
        content: {
            narrative: 'The tracks split at the standing stone.\n\n- Follow the heavier trail toward the ravine.\n- Circle east to avoid an ambush.\n- Wait and listen for movement.',
        },
    },
];

/** One event per glyph type — use with innerVoiceText to see the full left-edge system */
export const allGlyphTranscriptEvents: StoryGameEvent[] = [
    {
        id: 'glyph-dm-1',
        eventType: 'DM_NARRATIVE',
        createdAt: '2026-04-27T09:00:00.000Z',
        content: {
            narrative: 'The vault door groans open. Inside: shelves of crumbling scrolls and a single black candle that burns without heat.',
        },
    },
    {
        id: 'glyph-player-1',
        eventType: 'PLAYER_INPUT',
        createdAt: '2026-04-27T09:01:00.000Z',
        content: { text: 'I reach for the candle and hold it up to read the scrolls.' },
    },
    {
        id: 'glyph-dice-skill',
        eventType: 'DICE_ROLL',
        createdAt: '2026-04-27T09:02:00.000Z',
        content: {
            tool: 'check_skill',
            skill: 'Arcana',
            roll: 14,
            modifier: 4,
            total: 18,
            dc: 15,
            passed: true,
        },
    },
    {
        id: 'glyph-dm-2',
        eventType: 'DM_NARRATIVE',
        createdAt: '2026-04-27T09:03:00.000Z',
        content: {
            narrative: 'The symbols are a binding contract — one soul exchanged for safe passage through the Moonveil. The signatory\'s name has been burned away.',
        },
    },
    {
        id: 'glyph-player-2',
        eventType: 'PLAYER_INPUT',
        createdAt: '2026-04-27T09:04:00.000Z',
        content: { text: 'I try to force the iron chest in the corner.' },
    },
    {
        id: 'glyph-dice-ability',
        eventType: 'DICE_ROLL',
        createdAt: '2026-04-27T09:05:00.000Z',
        content: {
            tool: 'check_ability',
            ability: 'Strength',
            roll: 4,
            modifier: 2,
            total: 6,
            dc: 14,
            passed: false,
        },
    },
    {
        id: 'glyph-dm-3',
        eventType: 'DM_NARRATIVE',
        createdAt: '2026-04-27T09:06:00.000Z',
        content: {
            narrative: 'The chest doesn\'t budge. A warding rune flares red along its rim and singes your fingertips.',
        },
    },
    {
        id: 'glyph-player-3',
        eventType: 'PLAYER_INPUT',
        createdAt: '2026-04-27T09:07:00.000Z',
        content: { text: 'I cast Detect Magic and sweep the room.' },
    },
    {
        id: 'glyph-dice-roll',
        eventType: 'DICE_ROLL',
        createdAt: '2026-04-27T09:08:00.000Z',
        content: {
            tool: 'roll_dice',
            expression: '2d6 + 2',
            rolls: [5, 4],
            total: 11,
        },
    },
    {
        id: 'glyph-dm-4',
        eventType: 'DM_NARRATIVE',
        createdAt: '2026-04-27T09:09:00.000Z',
        content: {
            narrative: 'Three auras. The chest radiates abjuration. The candle burns with divination. And faintly, from behind the far wall, something else pulses — transmutation, slow and deep.',
        },
    },
    {
        id: 'glyph-event-combat',
        eventType: 'PLAYER_VISIBLE_EVENT',
        createdAt: '2026-04-27T09:10:00.000Z',
        content: {
            category: 'COMBAT',
            kind: 'COMBAT_STARTED',
            title: 'Combat begins',
            summary: 'The wall cracks. A guardian construct lurches forward.',
        },
    },
    {
        id: 'glyph-event-quest',
        eventType: 'PLAYER_VISIBLE_EVENT',
        createdAt: '2026-04-27T09:11:00.000Z',
        content: {
            category: 'QUEST',
            kind: 'OBJECTIVE_COMPLETED',
            title: 'Read the binding contract',
            entities: [{ type: 'Objective', id: 'obj-contract', name: 'Read the binding contract' }],
        },
    },
    {
        id: 'glyph-event-discovery',
        eventType: 'PLAYER_VISIBLE_EVENT',
        createdAt: '2026-04-27T09:12:00.000Z',
        content: {
            category: 'DISCOVERY',
            kind: 'LOCATION_DISCOVERED',
            title: 'The Vault of Oaths',
            entities: [{ type: 'Location', id: 'loc-vault', name: 'The Vault of Oaths' }],
        },
    },
    {
        id: 'glyph-event-inventory',
        eventType: 'PLAYER_VISIBLE_EVENT',
        createdAt: '2026-04-27T09:13:00.000Z',
        content: {
            category: 'INVENTORY',
            kind: 'ITEM_GAINED',
            title: 'Item gained',
            entities: [{ type: 'Item', id: 'item-candle', name: 'Soulfire Candle' }],
            values: { quantity: 1 },
        },
    },
    {
        id: 'glyph-event-resource',
        eventType: 'PLAYER_VISIBLE_EVENT',
        createdAt: '2026-04-27T09:14:00.000Z',
        content: {
            category: 'RESOURCE',
            kind: 'HP_CHANGED',
            title: 'Singed',
            values: { amount: -3 },
        },
    },
];

export const emptyCombatSession: StoryCombatSession = {
    id: 'combat-empty',
    roundNumber: 1,
    currentTurnIndex: 0,
    combatants: [],
};

export const activeCombatSession: StoryCombatSession = {
    id: 'combat-active',
    roundNumber: 3,
    currentTurnIndex: 0,
    combatants: [
        {
            id: characterId,
            type: 'CHARACTER',
            name: 'Elyra Thorn',
            initiativeRoll: 18,
            currentHp: 22,
            maxHp: 31,
            conditions: [],
            usedAction: false,
            usedBonusAction: true,
            usedReaction: false,
            movementUsed: 10,
        },
        {
            id: 'npc-bandit-captain',
            type: 'NPC',
            name: 'Bandit Captain',
            initiativeRoll: 15,
            currentHp: 41,
            maxHp: 65,
            conditions: ['Frightened'],
            usedAction: true,
            usedBonusAction: false,
            usedReaction: false,
            movementUsed: 20,
        },
        {
            id: 'npc-wolf',
            type: 'NPC',
            name: 'Blackroot Wolf',
            initiativeRoll: 12,
            currentHp: 9,
            maxHp: 11,
            conditions: [],
            usedAction: false,
            usedBonusAction: false,
            usedReaction: true,
            movementUsed: 30,
        },
    ],
};

export const lowHpCombatSession: StoryCombatSession = {
    ...activeCombatSession,
    id: 'combat-low-hp',
    currentTurnIndex: 1,
    combatants: activeCombatSession.combatants.map((combatant) => (combatant.id === characterId
        ? { ...combatant, currentHp: 4, conditions: ['Prone'] }
        : combatant)),
};

export const hostileFriendlyCombatSession: StoryCombatSession = {
    ...activeCombatSession,
    id: 'combat-groups',
    currentTurnIndex: 2,
    combatants: [
        ...activeCombatSession.combatants,
        {
            id: 'npc-scout',
            type: 'NPC',
            name: 'Village Scout',
            initiativeRoll: 9,
            currentHp: 12,
            maxHp: 12,
            conditions: ['Blessed'],
            usedAction: false,
            usedBonusAction: false,
            usedReaction: false,
            movementUsed: 0,
        },
    ],
};

export const spellSlots: StorySpellSlot[] = [
    { level: 1, total: 4, used: 1 },
    { level: 2, total: 2, used: 2 },
];

export const combatEvents: PlayerVisibleEventPayload[] = [
    mechanicalEvents.combatStarted,
    {
        category: 'COMBAT',
        kind: 'DAMAGE_DEALT',
        title: 'Elyra hits the captain',
        values: { amount: 8 },
    },
    {
        category: 'RESOURCE',
        kind: 'HP_CHANGED',
        title: 'Elyra takes damage',
        values: { amount: -6 },
    },
];

export const worldMapStates = {
    undiscovered: {
        discoveredNodes: [],
        frontierNodes: [
            { id: 'frontier-north', coordinates: { x: 0, y: 1 }, connectedDiscoveredIds: [] },
            { id: 'frontier-east', coordinates: { x: 1, y: 0 }, connectedDiscoveredIds: [] },
        ],
        edges: [],
        currentLocationId: null,
    },
    partial: {
        discoveredNodes: [
            {
                id: 'loc-crossroads',
                name: 'Old Crossroads',
                coordinates: { x: 0, y: 0 },
                currentState: 'SAFE',
                connectedLocationIds: ['loc-shrine'],
                hasActivityMarker: false,
            },
            {
                id: 'loc-shrine',
                name: 'Wayside Shrine',
                coordinates: { x: 1, y: 1 },
                currentState: 'TENSE',
                connectedLocationIds: ['loc-crossroads'],
                hasActivityMarker: true,
            },
        ],
        frontierNodes: [
            { id: 'frontier-ford', coordinates: { x: 2, y: 1 }, connectedDiscoveredIds: ['loc-shrine'] },
        ],
        edges: [{ fromId: 'loc-crossroads', toId: 'loc-shrine' }],
        currentLocationId: 'loc-crossroads',
    },
    dense: {
        discoveredNodes: [
            ['loc-crossroads', 'Old Crossroads', 0, 0, 'SAFE', false],
            ['loc-shrine', 'Wayside Shrine', 1, 1, 'TENSE', true],
            ['loc-ford', 'Ashen Ford', 2, 1, 'HOSTILE', false],
            ['loc-hollow', 'Moonwell Hollow', 1, 2, 'RUINED', true],
            ['loc-market', 'Candle Market', -1, 1, 'SAFE', false],
            ['loc-watchtower', 'Ruined Watchtower', 2, -1, 'HOSTILE', false],
        ].map(([id, name, x, y, currentState, hasActivityMarker]) => ({
            id,
            name,
            coordinates: { x, y },
            currentState,
            connectedLocationIds: [],
            hasActivityMarker,
        })) as StoryWorldMapNode[],
        frontierNodes: [
            { id: 'frontier-marsh', coordinates: { x: 3, y: 2 }, connectedDiscoveredIds: ['loc-ford'] },
            { id: 'frontier-keep', coordinates: { x: -2, y: 1 }, connectedDiscoveredIds: ['loc-market'] },
        ] satisfies StoryWorldMapFrontierNode[],
        edges: [
            { fromId: 'loc-crossroads', toId: 'loc-shrine' },
            { fromId: 'loc-shrine', toId: 'loc-ford' },
            { fromId: 'loc-shrine', toId: 'loc-hollow' },
            { fromId: 'loc-crossroads', toId: 'loc-market' },
            { fromId: 'loc-ford', toId: 'loc-watchtower' },
        ] satisfies StoryWorldMapEdge[],
        currentLocationId: 'loc-shrine',
    },
};
