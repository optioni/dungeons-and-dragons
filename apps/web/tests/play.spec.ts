import { useMutation, useQuery, useSubscription } from '@urql/vue';
import { flushPromises, mount } from '@vue/test-utils';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';
import { nextTick, ref } from 'vue';

import PlayPage from '../pages/campaign/[id]/play.vue';

vi.mock('@urql/vue', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useSubscription: vi.fn(),
}));

vi.mock('~/graphql/session', () => ({
    ACTIVE_SESSION_QUERY: 'ACTIVE_SESSION_QUERY',
    APPLY_LEVEL_UP_MUTATION: 'APPLY_LEVEL_UP_MUTATION',
    PREPARE_SPELLS_MUTATION: 'PREPARE_SPELLS_MUTATION',
    GAME_EVENTS_QUERY: 'GAME_EVENTS_QUERY',
    START_SESSION_MUTATION: 'START_SESSION_MUTATION',
    SEND_PLAYER_INPUT_MUTATION: 'SEND_PLAYER_INPUT_MUTATION',
    DM_STREAM_SUBSCRIPTION: 'DM_STREAM_SUBSCRIPTION',
    CHARACTER_QUERY_FOR_PLAY: 'CHARACTER_QUERY_FOR_PLAY',
    CAMPAIGN_QUERY_FOR_PLAY: 'CAMPAIGN_QUERY_FOR_PLAY',
    SPELL_OPTIONS_QUERY: 'SPELL_OPTIONS_QUERY',
}));

interface SessionOverrides {
    sceneType?: string
    levelUpPending?: boolean
    combatSession?: object | null
}

interface CharacterOverrides {
    hp?: number
    maxHp?: number
    isDead?: boolean
    deathSaveSuccesses?: number
    deathSaveFailures?: number
    level?: number
}

interface QueryMockOptions {
    initialEvents?: Record<string, unknown>[]
    completedEvents?: Record<string, unknown>[]
    sendInputMutation?: ReturnType<typeof vi.fn>
}

/** Configure useQuery/useMutation/useSubscription mocks for one component mount. */
function setupQueryMocks(
    sessionOverrides: SessionOverrides = {},
    levelUpMutation?: ReturnType<typeof vi.fn>,
    characterOverrides: CharacterOverrides = {},
    options: QueryMockOptions = {},
) {
    const streamRef = ref<any>(null);
    const refetchEvents = vi.fn().mockResolvedValue({
        data: { gameEvents: options.completedEvents ?? [] },
    });
    const sendInputMutation = options.sendInputMutation ?? vi.fn().mockResolvedValue({ data: { sendPlayerInput: true }, error: null });
    const session = {
        id: 'sess-1',
        characterId: 'char-1',
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
            data: ref(options.initialEvents ? { gameEvents: options.initialEvents } : null),
            fetching: ref(false),
            executeQuery: refetchEvents,
        } as any)
        .mockReturnValueOnce({
            // 4. CHARACTER_QUERY_FOR_PLAY
            data: ref({
                character: {
                    id: 'char-1',
                    name: 'Test Hero',
                    level: 3,
                    abilityScores: {
                        STR: 10, DEX: 10, CON: 14, INT: 16, WIS: 12, CHA: 8,
                    },
                    hp: 20,
                    maxHp: 20,
                    ac: 14,
                    conditions: [],
                    spellSlots: [],
                    preparedSpells: [],
                    deathSaveSuccesses: 0,
                    deathSaveFailures: 0,
                    isDead: false,
                    class: {
                        name: 'Wizard',
                        index: 'wizard',
                        spellcastingAbility: 'INT',
                    },
                    ...characterOverrides,
                },
            }),
            fetching: ref(false),
            executeQuery: vi.fn().mockResolvedValue({}),
        } as any)
        .mockReturnValueOnce({
            // 5. SPELL_OPTIONS_QUERY
            data: ref({ srdSpells: { edges: [] } }),
            fetching: ref(false),
            executeQuery: vi.fn().mockResolvedValue({}),
        } as any);

    const mockMutationFunction = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.mocked(useMutation)
        .mockReturnValueOnce({ executeMutation: mockMutationFunction } as any) // START_SESSION_MUTATION
        .mockReturnValueOnce({ executeMutation: sendInputMutation } as any) // SEND_PLAYER_INPUT_MUTATION
        .mockReturnValueOnce({ executeMutation: levelUpMutation ?? mockMutationFunction } as any) // APPLY_LEVEL_UP_MUTATION
        .mockReturnValueOnce({ executeMutation: mockMutationFunction } as any); // PREPARE_SPELLS_MUTATION

    vi.mocked(useSubscription).mockReturnValue({ data: streamRef } as any);

    return { streamRef, refetchEvents, sendInputMutation };
}

const globalStubs = {
    SessionCombatPanel: {
        template: '<div data-testid="combat-panel" />',
        props: ['combatSession', 'characterId', 'spellSlots', 'isStreaming'],
        emits: ['action'],
    },
    SessionCharacterSidebar: { template: '<div />', props: ['character', 'fetching'] },
    SessionCampaignEndScreen: { template: '<div />' },
    SessionTranscriptView: {
        template: `
          <div>
            <div v-if="inProgressText" data-testid="in-progress">{{ inProgressText }}</div>
            <div v-if="innerVoiceText" data-testid="inner-voice">{{ innerVoiceText }}</div>
          </div>
        `,
        props: ['events', 'inProgressText', 'innerVoiceText'],
    },
    NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
    UIcon: { template: '<span />', props: ['name', 'class'] },
    UAlert: { template: '<div>{{ description }}</div>', props: ['description', 'color', 'variant'] },
    UBadge: { template: '<span><slot /></span>', props: ['color', 'variant', 'size'] },
    UButton: {
        template: '<button :data-icon="icon" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
        props: ['disabled', 'loading', 'size', 'variant', 'color', 'icon', 'block'],
        emits: ['click'],
    },
    UTextarea: {
        template: '<textarea :disabled="disabled" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @keydown="$emit(\'keydown\', $event)" />',
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

describe('play page — inner voice stream handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('accumulates INNER_VOICE chunks separately from the main narrative', async () => {
        const { streamRef } = setupQueryMocks();
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        streamRef.value = { dmStream: { sequence: 1, type: 'INNER_VOICE', text: 'A warning prickles at the edge of thought.', sessionId: 'sess-1' } };
        await nextTick();

        expect(wrapper.find('[data-testid="inner-voice"]').text()).toContain('A warning prickles at the edge of thought.');
        expect(wrapper.find('[data-testid="in-progress"]').exists()).toBe(false);
    });

    it('ignores a second DONE chunk when the session is already idle', async () => {
        const { streamRef } = setupQueryMocks();
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        streamRef.value = { dmStream: { sequence: 1, type: 'DONE', sessionId: 'sess-1' } };
        await flushPromises();
        streamRef.value = { dmStream: { sequence: 2, type: 'DONE', sessionId: 'sess-1' } };
        await flushPromises();

        expect(wrapper.find('textarea').attributes('disabled')).toBeUndefined();
    });
});

describe('play page — deterministic core loop smoke', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resumes a session, accepts player input, completes the stream, and exposes updated state links', async () => {
        const completedEvents = [
            {
                id: 'event-1',
                sessionId: 'sess-1',
                eventType: 'PLAYER_INPUT',
                content: { text: 'Check the sealed door' },
                createdAt: '2026-04-24T00:00:00.000Z',
            },
            {
                id: 'event-2',
                sessionId: 'sess-1',
                eventType: 'DM_NARRATIVE',
                content: { narrative: 'The door hums and the runes fade.' },
                createdAt: '2026-04-24T00:00:01.000Z',
            },
        ];
        const { streamRef, sendInputMutation, refetchEvents } = setupQueryMocks(
            { sceneType: 'EXPLORATION' },
            undefined,
            {},
            { completedEvents },
        );
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        const textarea = wrapper.find('textarea');
        await textarea.setValue('Check the sealed door');
        const sendButton = wrapper.find('[data-icon="i-lucide-send"]');
        await sendButton?.trigger('click');
        await flushPromises();

        expect(sendInputMutation).toHaveBeenCalledWith({
            sessionId: 'sess-1',
            text: 'Check the sealed door',
        });
        expect(wrapper.text()).toContain('Character');
        expect(wrapper.text()).toContain('Quests');

        streamRef.value = { dmStream: { sequence: 1, type: 'NARRATIVE_CHUNK', text: 'The door hums', sessionId: 'sess-1' } };
        await nextTick();
        expect(wrapper.find('[data-testid="in-progress"]').text()).toContain('The door hums');

        streamRef.value = { dmStream: { sequence: 2, type: 'DONE', sessionId: 'sess-1' } };
        await flushPromises();

        expect(refetchEvents).toHaveBeenCalledWith({ requestPolicy: 'network-only' });
        expect(wrapper.find('[data-testid="in-progress"]').exists()).toBe(false);
        expect(wrapper.find('textarea').attributes('disabled')).toBeUndefined();
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
        const confirmButton = buttons.find((b) => b.text().includes('Confirm Level Up'));
        await confirmButton!.trigger('click');
        await flushPromises();

        expect(wrapper.text()).not.toContain('Level Up!');
    });
});

describe('play page — death-save UI visibility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not render death-save UI when character HP is above 0', async () => {
        setupQueryMocks({}, undefined, { hp: 20, isDead: false });
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        expect(wrapper.find('[data-testid="death-save-ui"]').exists()).toBe(false);
    });

    it('renders death-save UI when character HP is 0 and not dead', async () => {
        setupQueryMocks({}, undefined, { hp: 0, isDead: false, deathSaveSuccesses: 0, deathSaveFailures: 0 });
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        expect(wrapper.find('[data-testid="death-save-ui"]').exists()).toBe(true);
    });

    it('does not render death-save UI when character is dead (isDead = true)', async () => {
        setupQueryMocks({}, undefined, { hp: 0, isDead: true });
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        expect(wrapper.find('[data-testid="death-save-ui"]').exists()).toBe(false);
    });

    it('shows death-save success and failure labels when dying', async () => {
        setupQueryMocks({}, undefined, { hp: 0, isDead: false, deathSaveSuccesses: 1, deathSaveFailures: 2 });
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        const deathSaveElement = wrapper.find('[data-testid="death-save-ui"]');
        expect(deathSaveElement.text()).toContain('Success');
        expect(deathSaveElement.text()).toContain('Failure');
    });

    it('death-save UI coexists with combat layout when sceneType is COMBAT', async () => {
        const combatSession = { id: 'cs-1', combatants: [], currentTurnIndex: 0, roundNumber: 1 };
        setupQueryMocks({ sceneType: 'COMBAT', combatSession }, undefined, { hp: 0, isDead: false });
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        expect(wrapper.find('[data-testid="combat-panel"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="death-save-ui"]').exists()).toBe(true);
    });

    it('player input remains enabled during death-save state', async () => {
        setupQueryMocks({}, undefined, { hp: 0, isDead: false });
        const wrapper = mount(PlayPage, { global: { stubs: globalStubs } });
        await flushPromises();

        const textarea = wrapper.find('textarea');
        expect(textarea.attributes('disabled')).toBeUndefined();
    });
});
