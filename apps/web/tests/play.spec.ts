import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import PlayPage from '../pages/campaign/[id]/play.vue';

vi.mock('@urql/vue', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useSubscription: vi.fn(),
}));

vi.mock('~/graphql/session', () => ({
    ACTIVE_SESSION_QUERY: 'ACTIVE_SESSION_QUERY',
    APPLY_LEVEL_UP_MUTATION: 'APPLY_LEVEL_UP_MUTATION',
    GAME_EVENTS_QUERY: 'GAME_EVENTS_QUERY',
    START_SESSION_MUTATION: 'START_SESSION_MUTATION',
    SEND_PLAYER_INPUT_MUTATION: 'SEND_PLAYER_INPUT_MUTATION',
    DM_STREAM_SUBSCRIPTION: 'DM_STREAM_SUBSCRIPTION',
    CHARACTER_QUERY_FOR_PLAY: 'CHARACTER_QUERY_FOR_PLAY',
    CAMPAIGN_QUERY_FOR_PLAY: 'CAMPAIGN_QUERY_FOR_PLAY',
}));

import { useQuery, useMutation, useSubscription } from '@urql/vue';

interface SessionOverrides {
    sceneType?: string;
    levelUpPending?: boolean;
    combatSession?: object | null;
}

/** Configure useQuery/useMutation/useSubscription mocks for one component mount. */
function setupQueryMocks(sessionOverrides: SessionOverrides = {}, levelUpMutation?: ReturnType<typeof vi.fn>) {
    const session = {
        id: 'sess-1',
        sceneType: 'EXPLORATION',
        levelUpPending: false,
        combatSession: null,
        ...sessionOverrides,
    };

    vi.mocked(useQuery)
        .mockReturnValueOnce({
            // 1. CAMPAIGN_QUERY_FOR_PLAY
            data: ref({ campaign: { id: 'camp-1', name: 'Test Campaign' } }),
            fetching: ref(false),
            executeQuery: vi.fn().mockResolvedValue({}),
        } as any)
        .mockReturnValueOnce({
            // 2. ACTIVE_SESSION_QUERY
            data: ref({ activeSession: session }),
            fetching: ref(false),
            executeQuery: vi.fn().mockResolvedValue({}),
        } as any)
        .mockReturnValueOnce({
            // 3. GAME_EVENTS_QUERY
            data: ref(null),
            fetching: ref(false),
            executeQuery: vi.fn().mockResolvedValue({ data: { gameEvents: [] } }),
        } as any)
        .mockReturnValueOnce({
            // 4. CHARACTER_QUERY_FOR_PLAY
            data: ref(null),
            fetching: ref(false),
            executeQuery: vi.fn().mockResolvedValue({}),
        } as any);

    const mockMutationFn = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.mocked(useMutation)
        .mockReturnValueOnce({ executeMutation: mockMutationFn } as any) // START_SESSION_MUTATION
        .mockReturnValueOnce({ executeMutation: mockMutationFn } as any) // SEND_PLAYER_INPUT_MUTATION
        .mockReturnValueOnce({ executeMutation: levelUpMutation ?? mockMutationFn } as any); // APPLY_LEVEL_UP_MUTATION

    vi.mocked(useSubscription).mockReturnValue({ data: ref(null) } as any);
}

const globalStubs = {
    SessionCombatPanel: {
        template: '<div data-testid="combat-panel" />',
        props: ['combatSession', 'characterId', 'spellSlots', 'isStreaming'],
        emits: ['action'],
    },
    SessionCharacterSidebar: { template: '<div />', props: ['character', 'fetching'] },
    SessionTranscriptView: { template: '<div />', props: ['events', 'inProgressText'] },
    UIcon: { template: '<span />', props: ['name', 'class'] },
    UBadge: { template: '<span><slot /></span>', props: ['color', 'variant', 'size'] },
    UButton: {
        template: '<button :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
        props: ['disabled', 'loading', 'size', 'variant', 'color', 'icon', 'block'],
        emits: ['click'],
    },
    UTextarea: {
        template: '<textarea :disabled="disabled" />',
        props: ['disabled', 'modelValue', 'rows', 'autoresize', 'placeholder'],
        emits: ['update:modelValue', 'keydown'],
    },
    UInput: {
        template: '<input :type="type" :min="min" />',
        props: ['disabled', 'modelValue', 'type', 'min', 'class'],
        emits: ['update:modelValue'],
    },
};

describe('play page — layout transitions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not render CombatPanel when sceneType is EXPLORATION', async () => {
        setupQueryMocks({ sceneType: 'EXPLORATION', combatSession: null });
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        expect(wrapper.find('[data-testid="combat-panel"]').exists()).toBe(false);
    });

    it('does not render CombatPanel when sceneType is COMBAT but combatSession is null', async () => {
        setupQueryMocks({ sceneType: 'COMBAT', combatSession: null });
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        expect(wrapper.find('[data-testid="combat-panel"]').exists()).toBe(false);
    });

    it('renders CombatPanel when sceneType is COMBAT and combatSession exists', async () => {
        const combatSession = { id: 'cs-1', combatants: [], currentTurnIndex: 0, roundNumber: 1 };
        setupQueryMocks({ sceneType: 'COMBAT', combatSession });
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        expect(wrapper.find('[data-testid="combat-panel"]').exists()).toBe(true);
    });

    it('shows the current scene type label in the sidebar', async () => {
        setupQueryMocks({ sceneType: 'SOCIAL' });
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        expect(wrapper.text()).toContain('SOCIAL');
    });
});

describe('play page — level-up panel open/close', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('hides the level-up overlay when levelUpPending is false', async () => {
        setupQueryMocks({ levelUpPending: false });
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        expect(wrapper.text()).not.toContain('Level Up!');
    });

    it('shows the level-up overlay when levelUpPending is true', async () => {
        setupQueryMocks({ levelUpPending: true });
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        expect(wrapper.text()).toContain('Level Up!');
    });

    it('disables the player textarea when levelUpPending is true', async () => {
        setupQueryMocks({ levelUpPending: true });
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        const textarea = wrapper.find('textarea');
        expect(textarea.exists()).toBe(true);
        expect(textarea.attributes('disabled')).toBeDefined();
    });

    it('enables the player textarea when levelUpPending is false and not streaming', async () => {
        setupQueryMocks({ levelUpPending: false });
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        const textarea = wrapper.find('textarea');
        expect(textarea.exists()).toBe(true);
        expect(textarea.attributes('disabled')).toBeUndefined();
    });

    it('shows the Confirm Level Up submit button inside the overlay', async () => {
        setupQueryMocks({ levelUpPending: true });
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        expect(wrapper.text()).toContain('Confirm Level Up');
    });

    it('dismisses the level-up overlay on successful submission', async () => {
        const mockApplyLevelUp = vi.fn().mockResolvedValue({ data: true, error: null });
        setupQueryMocks({ levelUpPending: true }, mockApplyLevelUp);
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        expect(wrapper.text()).toContain('Level Up!');

        const buttons = wrapper.findAll('button');
        const confirmBtn = buttons.find((b) => b.text().includes('Confirm Level Up'));
        await confirmBtn!.trigger('click');
        await flushPromises();

        expect(wrapper.text()).not.toContain('Level Up!');
    });
});
