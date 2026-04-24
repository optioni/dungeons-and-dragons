import { useMutation, useQuery } from '@urql/vue';
import { flushPromises, mount } from '@vue/test-utils';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';
import { ref } from 'vue';

import WorldPage from '../pages/campaign/[id]/world.vue';

vi.mock('@urql/vue', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(),
}));

vi.mock('~/graphql/world', () => ({
    FACTIONS_QUERY: 'FACTIONS_QUERY',
    NPCS_QUERY: 'NPCS_QUERY',
    NPC_PROFILE_QUERY: 'NPC_PROFILE_QUERY',
    DIARY_ENTRIES_QUERY: 'DIARY_ENTRIES_QUERY',
    WORLD_EVENTS_QUERY: 'WORLD_EVENTS_QUERY',
    WORLD_MAP_QUERY: 'WORLD_MAP_QUERY',
}));

vi.mock('~/graphql/session', () => ({
    ACTIVE_SESSION_QUERY: 'ACTIVE_SESSION_QUERY',
    START_SESSION_MUTATION: 'START_SESSION_MUTATION',
    SEND_PLAYER_INPUT_MUTATION: 'SEND_PLAYER_INPUT_MUTATION',
}));

const WorldMapGraphStub = {
    name: 'WorldMapGraph',
    props: ['discoveredNodes', 'frontierNodes', 'edges', 'currentLocationId', 'previousNodeIds'],
    emits: ['nodeSelect'],
    template: '<div data-testid="world-map-graph" @click="$emit(\'nodeSelect\', \'42\', \'Destination\')"></div>',
};

const globalStubs = {
    NuxtLink: { template: '<a><slot /></a>' },
    WorldMapGraph: WorldMapGraphStub,
    UCard: { template: '<div class="stub-card"><slot name="header" /><slot /></div>' },
    UBadge: { template: '<span class="stub-badge"><slot /></span>', props: ['color', 'variant', 'size'] },
    UButton: {
        template: '<button class="stub-button" @click="$emit(\'click\')"><slot /></button>',
        props: ['variant', 'color', 'size', 'loading', 'icon', 'block'],
        emits: ['click'],
    },
    UIcon: { template: '<span class="stub-icon" />', props: ['name', 'class'] },
    UModal: {
        template: '<div v-if="open" class="stub-modal"><slot name="content" /></div>',
        props: ['open'],
        emits: ['update:open'],
    },
    UInput: {
        template: '<input class="stub-input" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        props: ['modelValue', 'placeholder', 'size', 'icon'],
        emits: ['update:modelValue'],
    },
};

function makeMapData(overrides: Record<string, unknown> = {}) {
    return {
        worldMap: {
            selectedScale: 'WORLD',
            availableScales: ['WORLD', 'REGIONAL'],
            currentLocationId: '10',
            discoveredNodes: [
                {
                    id: '10',
                    name: 'Riverford',
                    coordinates: { x: 0, y: 0 },
                    currentState: 'SAFE',
                    connectedLocationIds: ['20'],
                    hasActivityMarker: false,
                },
            ],
            frontierNodes: [
                { id: '20', coordinates: null, connectedDiscoveredIds: ['10'] },
            ],
            edges: [{ fromId: '10', toId: '20' }],
            ...overrides,
        },
    };
}

function setupMocks(options: {
    mapData?: Record<string, unknown> | null
    activeSession?: Record<string, unknown> | null
    sendPlayerInputResult?: Record<string, unknown>
    startSessionResult?: Record<string, unknown>
} = {}) {
    const {
        mapData = makeMapData(),
        activeSession = { id: 'sess-1', campaignId: '1' },
        sendPlayerInputResult = { data: { sendPlayerInput: true }, error: null },
        startSessionResult = { data: { startSession: { id: 'sess-new' } }, error: null },
    } = options;

    const executeQuery = vi.fn();
    const sendMutation = vi.fn().mockResolvedValue(sendPlayerInputResult);
    const startSessionMutation = vi.fn().mockResolvedValue(startSessionResult);

    vi.mocked(useQuery).mockImplementation(({ query }: { query: unknown }) => {
        if (query === 'WORLD_MAP_QUERY') {
            return {
                data: ref(mapData),
                fetching: ref(false),
                executeQuery,
            } as never;
        }
        if (query === 'ACTIVE_SESSION_QUERY') {
            return {
                data: ref(activeSession ? { activeSession } : { activeSession: null }),
                fetching: ref(false),
                executeQuery: vi.fn(),
            } as never;
        }
        return {
            data: ref(null),
            fetching: ref(false),
            executeQuery: vi.fn(),
        } as never;
    });

    vi.mocked(useMutation).mockImplementation((_query: unknown) => ({
        executeMutation: (_query as string) === 'START_SESSION_MUTATION'
            ? startSessionMutation
            : sendMutation,
    } as never));

    return { executeQuery, sendMutation, startSessionMutation };
}

describe('WorldPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // 8.5 — World overview panels are preserved alongside the map
    it('renders the map section and existing reference panels', async () => {
        setupMocks();

        const wrapper = mount(WorldPage, {
            global: { stubs: globalStubs },
        });

        await flushPromises();

        const text = wrapper.html();
        expect(text).toContain('world-map-graph');
        expect(text).toContain('Factions');
        expect(text).toContain('Known NPCs');
        expect(text).toContain('Diary');
        expect(text).toContain('Active World Events');
    });

    // 8.5 — Scale switcher uses only available scales from map response
    it('shows available scale buttons from the map response', async () => {
        setupMocks();

        const wrapper = mount(WorldPage, {
            global: { stubs: globalStubs },
        });

        await flushPromises();

        const text = wrapper.html();
        expect(text).toContain('WORLD');
        expect(text).toContain('REGIONAL');
    });

    // 8.5 — Empty map state shows message without hiding panels
    it('shows empty map state when no nodes are available while keeping panels', async () => {
        setupMocks({
            mapData: {
                worldMap: {
                    selectedScale: 'WORLD',
                    availableScales: [],
                    currentLocationId: null,
                    discoveredNodes: [],
                    frontierNodes: [],
                    edges: [],
                },
            },
        });

        const wrapper = mount(WorldPage, {
            global: { stubs: globalStubs },
        });

        await flushPromises();

        expect(wrapper.html()).toContain('No map data for this scale');
        expect(wrapper.html()).toContain('Factions');
    });

    // 8.5 — Travel confirmation opens when a discovered non-current node is selected
    it('opens travel confirmation dialog when a non-current discovered node is selected', async () => {
        setupMocks();

        const wrapper = mount(WorldPage, {
            global: { stubs: globalStubs },
        });

        await flushPromises();

        // Simulate the map component emitting nodeSelect for node '42' (not current '10')
        const mapGraph = wrapper.find('[data-testid="world-map-graph"]');
        await mapGraph.trigger('click');
        await flushPromises();

        expect(wrapper.html()).toContain('Travel to');
        expect(wrapper.html()).toContain('Destination');
    });

    // 8.5 — Travel confirmation calls sendPlayerInput
    it('submits travel through sendPlayerInput when confirmed', async () => {
        const { sendMutation } = setupMocks();
        const pushMock = vi.fn();
        vi.stubGlobal('useRouter', vi.fn(() => ({ push: pushMock })));

        const wrapper = mount(WorldPage, {
            global: { stubs: globalStubs },
        });

        await flushPromises();

        // Open dialog
        const mapGraph = wrapper.find('[data-testid="world-map-graph"]');
        await mapGraph.trigger('click');
        await flushPromises();

        // Click the Travel button (the second stub-button in the modal)
        const buttons = wrapper.findAll('.stub-button');
        const travelBtn = buttons.find((b) => b.text().includes('Travel'));
        await travelBtn?.trigger('click');
        await flushPromises();

        expect(sendMutation).toHaveBeenCalledWith(
            expect.objectContaining({ text: expect.stringContaining('Travel to') }),
        );
        expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('/play'));
    });

    // 8.5 — Error surface: failed sendPlayerInput shows message without mutating map
    it('shows error message when sendPlayerInput fails without closing the dialog', async () => {
        setupMocks({
            sendPlayerInputResult: { data: null, error: new Error('Network error') },
        });

        const wrapper = mount(WorldPage, {
            global: { stubs: globalStubs },
        });

        await flushPromises();

        const mapGraph = wrapper.find('[data-testid="world-map-graph"]');
        await mapGraph.trigger('click');
        await flushPromises();

        const buttons = wrapper.findAll('.stub-button');
        const travelBtn = buttons.find((b) => b.text().includes('Travel'));
        await travelBtn?.trigger('click');
        await flushPromises();

        expect(wrapper.html()).toContain('Failed to submit');
    });

    // 8.5 — Travel starts session when no active session exists
    it('starts a new session when no active session is available', async () => {
        const { startSessionMutation, sendMutation } = setupMocks({ activeSession: null });
        const pushMock = vi.fn();
        vi.stubGlobal('useRouter', vi.fn(() => ({ push: pushMock })));

        const wrapper = mount(WorldPage, {
            global: { stubs: globalStubs },
        });

        await flushPromises();

        const mapGraph = wrapper.find('[data-testid="world-map-graph"]');
        await mapGraph.trigger('click');
        await flushPromises();

        const buttons = wrapper.findAll('.stub-button');
        const travelBtn = buttons.find((b) => b.text().includes('Travel'));
        await travelBtn?.trigger('click');
        await flushPromises();

        expect(startSessionMutation).toHaveBeenCalled();
        expect(sendMutation).toHaveBeenCalled();
    });
});
