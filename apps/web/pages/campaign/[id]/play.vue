<template>
    <div class="h-screen bg-gray-950 flex overflow-hidden">
        <!-- Loading state -->
        <div v-if="campaignFetching || (!sessionId && !campaign)"
            class="flex-1 flex items-center justify-center">
            <div class="flex items-center gap-3 text-gray-400">
                <u-icon name="i-lucide-loader-circle"
                    class="animate-spin text-2xl" />
                Loading session...
            </div>
        </div>

        <!-- Campaign end screen -->
        <session-campaign-end-screen
            v-else-if="campaignEnded && campaignEndPayload"
            :epitaph="campaignEndPayload.epitaph"
            :days-played="campaignEndPayload.daysPlayed"
            :quests-completed="campaignEndPayload.questsCompleted"
        />

        <!-- Main play layout -->
        <template v-else-if="!campaignEnded">
            <!-- Combat panel: slides in from left when sceneType = COMBAT -->
            <transition
                enter-active-class="transition-all duration-300 ease-out"
                enter-from-class="-translate-x-full opacity-0"
                enter-to-class="translate-x-0 opacity-100"
                leave-active-class="transition-all duration-300 ease-in"
                leave-from-class="translate-x-0 opacity-100"
                leave-to-class="-translate-x-full opacity-0"
            >
                <session-combat-panel
                    v-if="isCombat && combatSession"
                    :combat-session="combatSession"
                    :character-id="characterId ?? undefined"
                    :spell-slots="character?.spellSlots"
                    :is-streaming="isStreaming"
                    @action="handleQuickAction"
                />
            </transition>

            <!-- Sidebar -->
            <div class="w-56 flex-shrink-0 border-r border-gray-800 p-3 overflow-y-auto">
                <session-character-sidebar
                    :character="character"
                    :fetching="characterFetching" />

                <!-- Scene indicator -->
                <div class="mt-4 pt-4 border-t border-gray-800">
                    <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Scene</p>

                    <u-badge color="primary"
                        variant="soft"
                        size="sm">
                        {{ sceneType }}
                    </u-badge>
                </div>

                <!-- Navigation -->
                <div class="mt-4 pt-4 border-t border-gray-800 space-y-1">
                    <nuxt-link
                        :to="`/campaign/${campaignId}/character`"
                        class="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors px-2 py-1 rounded"
                        active-class="text-white bg-gray-800"
                    >
                        <u-icon name="i-lucide-user" />
                        Character
                    </nuxt-link>

                    <nuxt-link
                        :to="`/campaign/${campaignId}/quests`"
                        class="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors px-2 py-1 rounded"
                        active-class="text-white bg-gray-800"
                    >
                        <u-icon name="i-lucide-scroll-text" />
                        Quests
                    </nuxt-link>
                </div>
            </div>

            <!-- Narrative column -->
            <div class="flex-1 flex flex-col overflow-hidden relative">
                <!-- Campaign name header -->
                <div class="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
                    <h1 class="text-sm font-semibold text-gray-200">{{ campaign?.name }}</h1>

                    <div v-if="isStreaming"
                        class="flex items-center gap-1.5 text-xs text-primary-400">
                        <u-icon name="i-lucide-loader-circle"
                            class="animate-spin" />
                        DM is responding...
                    </div>
                </div>

                <!-- Transcript scroll area -->
                <div ref="transcriptRef"
                    class="flex-1 overflow-y-auto px-6 py-4">
                    <session-transcript-view
                        :events="persistedEvents"
                        :in-progress-text="inProgressNarrative || undefined"
                        :inner-voice-text="innerVoiceText || undefined" />
                </div>

                <!-- Death-save status -->
                <div v-if="isDying"
                    class="px-6 py-2 border-t border-red-900 bg-red-950/50"
                    data-testid="death-save-ui">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <u-icon name="i-lucide-skull"
                                class="text-red-400 text-sm" />

                            <span class="text-xs text-red-300 font-semibold uppercase tracking-wider">Death Saves</span>
                        </div>

                        <div class="flex items-center gap-4">
                            <div class="flex items-center gap-1">
                                <span class="text-xs text-gray-400 mr-1">Success</span>

                                <span
                                    v-for="i in 3"
                                    :key="`ds${i}`"
                                    class="w-3 h-3 rounded-full border transition-colors"
                                    :class="i <= (character?.deathSaveSuccesses ?? 0)
                                        ? 'bg-green-500 border-green-500'
                                        : 'bg-transparent border-gray-600'"
                                />
                            </div>

                            <div class="flex items-center gap-1">
                                <span class="text-xs text-gray-400 mr-1">Failure</span>

                                <span
                                    v-for="i in 3"
                                    :key="`df${i}`"
                                    class="w-3 h-3 rounded-full border transition-colors"
                                    :class="i <= (character?.deathSaveFailures ?? 0)
                                        ? 'bg-red-500 border-red-500'
                                        : 'bg-transparent border-gray-600'"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Suggested action chips -->
                <div v-if="suggestedActions.length"
                    class="px-6 pb-2 flex flex-wrap gap-2">
                    <u-button v-for="action in suggestedActions"
                        :key="action"
                        size="xs"
                        variant="soft"
                        color="primary"
                        @click="handleSuggestedAction(action)">
                        {{ action }}
                    </u-button>
                </div>

                <!-- Input area -->
                <div class="border-t border-gray-800 px-6 py-3">
                    <div class="flex gap-3 items-end">
                        <u-textarea
                            v-model="playerInput"
                            class="flex-1"
                            placeholder="What do you do?"
                            :disabled="inputDisabled"
                            :rows="2"
                            autoresize
                            @keydown.enter.exact.prevent="handleSend" />

                        <u-button
                            icon="i-lucide-send"
                            :disabled="inputDisabled || !playerInput.trim()"
                            :loading="isStreaming"
                            @click="handleSend" />
                    </div>

                    <p class="text-xs text-gray-600 mt-1">Press Enter to send · Shift+Enter for new line</p>
                </div>

                <!-- Level-up panel overlay -->
                <transition
                    enter-active-class="transition-opacity duration-200"
                    enter-from-class="opacity-0"
                    enter-to-class="opacity-100"
                    leave-active-class="transition-opacity duration-200"
                    leave-from-class="opacity-100"
                    leave-to-class="opacity-0"
                >
                    <div
                        v-if="levelUpPending"
                        class="absolute inset-0 bg-gray-950/90 backdrop-blur-sm flex items-center justify-center p-6"
                    >
                        <div class="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-5">
                            <div class="text-center">
                                <u-icon name="i-lucide-star"
                                    class="text-yellow-400 text-3xl mb-2" />

                                <h2 class="text-lg font-bold text-white">Level Up!</h2>

                                <p class="text-sm text-gray-400">
                                    You are now level {{ (character?.level ?? 0) + 1 }}
                                </p>
                            </div>

                            <!-- HP increase -->
                            <div class="space-y-2">
                                <label class="text-xs text-gray-400 uppercase tracking-wider">
                                    Hit Points Gained
                                </label>

                                <p class="text-xs text-gray-500">
                                    Roll your class hit die and add your CON modifier.
                                </p>

                                <u-input
                                    v-model.number="levelUpHpRolled"
                                    type="number"
                                    :min="1"
                                    class="w-24"
                                />
                            </div>

                            <!-- ASI or Feat toggle -->
                            <div v-if="(character?.level ?? 0) % 4 === 3"
                                class="space-y-3">
                                <label class="text-xs text-gray-400 uppercase tracking-wider">
                                    Ability Score Improvement
                                </label>

                                <div class="flex gap-3">
                                    <u-button
                                        size="xs"
                                        :variant="!levelUpUseFeat ? 'solid' : 'soft'"
                                        @click="levelUpUseFeat = false"
                                    >
                                        Ability Scores
                                    </u-button>

                                    <u-button
                                        size="xs"
                                        :variant="levelUpUseFeat ? 'solid' : 'soft'"
                                        @click="levelUpUseFeat = true"
                                    >
                                        Feat
                                    </u-button>
                                </div>

                                <!-- ASI selector -->
                                <div v-if="!levelUpUseFeat"
                                    class="space-y-2">
                                    <p class="text-xs text-gray-500">
                                        Distribute {{ 2 - asiTotal }} remaining point(s) across abilities.
                                    </p>

                                    <div class="grid grid-cols-3 gap-2">
                                        <div
                                            v-for="ability in ABILITIES"
                                            :key="ability"
                                            class="flex flex-col items-center gap-1"
                                        >
                                            <span class="text-xs text-gray-500">{{ ability }}</span>

                                            <div class="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    class="w-5 h-5 rounded text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
                                                    :disabled="(levelUpAsi[ability] ?? 0) === 0"
                                                    @click="setAsi(ability, (levelUpAsi[ability] ?? 0) - 1)"
                                                >
                                                    -
                                                </button>

                                                <span class="w-4 text-center text-sm text-white">{{ levelUpAsi[ability] ?? 0 }}</span>

                                                <button
                                                    type="button"
                                                    class="w-5 h-5 rounded text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 disabled:opacity-40"
                                                    :disabled="asiTotal >= 2"
                                                    @click="setAsi(ability, (levelUpAsi[ability] ?? 0) + 1)"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Feat input -->
                                <div v-else>
                                    <u-input
                                        v-model="levelUpFeat"
                                        placeholder="Enter feat name..."
                                    />
                                </div>
                            </div>

                            <!-- Error -->
                            <p v-if="levelUpError"
                                class="text-xs text-red-400">
                                {{ levelUpError }}
                            </p>

                            <!-- Submit -->
                            <u-button
                                block
                                color="primary"
                                :disabled="levelUpHpRolled < 1"
                                @click="handleLevelUpSubmit"
                            >
                                Confirm Level Up
                            </u-button>
                        </div>
                    </div>
                </transition>

                <!-- Spell-preparation overlay -->
                <transition
                    enter-active-class="transition-opacity duration-200"
                    enter-from-class="opacity-0"
                    enter-to-class="opacity-100"
                    leave-active-class="transition-opacity duration-200"
                    leave-from-class="opacity-100"
                    leave-to-class="opacity-0"
                >
                    <div
                        v-if="spellPrepPending"
                        class="absolute inset-0 bg-gray-950/90 backdrop-blur-sm flex items-center justify-center p-6"
                    >
                        <div class="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-2xl space-y-5">
                            <div class="text-center">
                                <u-icon name="i-lucide-book-open-check"
                                    class="text-sky-400 text-3xl mb-2" />

                                <h2 class="text-lg font-bold text-white">Prepare Spells</h2>

                                <p class="text-sm text-gray-400">
                                    Choose up to {{ maxPreparedSpells }} spells for {{ character?.name }}.
                                </p>
                            </div>

                            <div class="flex items-center justify-between text-xs text-gray-400">
                                <span>{{ selectedPreparedSpells.length }}/{{ maxPreparedSpells }} selected</span>

                                <span v-if="spellOptionsFetching">Loading spell list…</span>
                            </div>

                            <div class="max-h-96 overflow-y-auto border border-gray-800 rounded-xl divide-y divide-gray-800">
                                <button
                                    v-for="spell in availablePreparedSpells"
                                    :key="spell.index"
                                    type="button"
                                    class="w-full px-4 py-3 text-left hover:bg-gray-800/70 transition-colors disabled:opacity-50"
                                    :disabled="!selectedPreparedSpells.includes(spell.index)
                                        && maxPreparedSpells > 0
                                        && selectedPreparedSpells.length >= maxPreparedSpells"
                                    @click="togglePreparedSpell(spell.index)"
                                >
                                    <div class="flex items-center justify-between gap-4">
                                        <div>
                                            <p class="text-sm font-medium text-white">{{ spell.name }}</p>

                                            <p class="text-xs text-gray-500">Level {{ spell.level }}</p>
                                        </div>

                                        <u-badge
                                            :color="selectedPreparedSpells.includes(spell.index) ? 'primary' : 'neutral'"
                                            variant="soft"
                                            size="sm"
                                        >
                                            {{ selectedPreparedSpells.includes(spell.index) ? 'Prepared' : 'Available' }}
                                        </u-badge>
                                    </div>
                                </button>
                            </div>

                            <u-alert
                                v-if="spellPrepError"
                                color="error"
                                variant="soft"
                                :description="spellPrepError"
                            />

                            <div class="flex justify-end">
                                <u-button
                                    color="primary"
                                    :disabled="spellOptionsFetching"
                                    @click="handlePrepareSpellsSubmit"
                                >
                                    Confirm Prepared Spells
                                </u-button>
                            </div>
                        </div>
                    </div>
                </transition>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { useQuery, useMutation, useSubscription } from '@urql/vue';
import { type ResultOf } from 'gql.tada';

import { type CombatSession } from '~/components/session/CombatPanel.vue';
import {
    ACTIVE_SESSION_QUERY,
    APPLY_LEVEL_UP_MUTATION,
    PREPARE_SPELLS_MUTATION,
    GAME_EVENTS_QUERY,
    START_SESSION_MUTATION,
    SEND_PLAYER_INPUT_MUTATION,
    DM_STREAM_SUBSCRIPTION,
    CHARACTER_QUERY_FOR_PLAY,
    CAMPAIGN_QUERY_FOR_PLAY,
    SPELL_OPTIONS_QUERY,
} from '~/graphql/session';

definePageMeta({ middleware: 'require-auth' });

const route = useRoute();
const router = useRouter();
const campaignId = computed(() => route.params.id as string);

type ActiveSession = NonNullable<ResultOf<typeof ACTIVE_SESSION_QUERY>['activeSession']>;
type PersistedGameEvent = Omit<ResultOf<typeof GAME_EVENTS_QUERY>['gameEvents'][number], 'content'> & {
    content: Record<string, unknown>
};
type SpellOption = ResultOf<typeof SPELL_OPTIONS_QUERY>['srdSpells']['edges'][number]['node'];

// ── Campaign ─────────────────────────────────────────────────────────────────
const { data: campaignData, fetching: campaignFetching } = useQuery({
    query: CAMPAIGN_QUERY_FOR_PLAY,
    variables: computed(() => ({ id: campaignId.value })),
});

const campaign = computed(() => campaignData.value?.campaign ?? null);

watch(
    () => campaignFetching.value,
    (fetching) => {
        if (!fetching && !campaign.value) {
            router.push('/');
        }
    },
);

// ── Campaign End Screen ───────────────────────────────────────────────────────
interface CampaignEndPayload {
    epitaph: string
    daysPlayed: number
    questsCompleted: number
}

const campaignEndPayload = ref<CampaignEndPayload | null>(null);

const campaignEnded = computed(
    () => campaignEndPayload.value !== null || campaign.value?.status === 'ENDED',
);

watch(
    [() => campaignFetching.value, campaign],
    ([fetching, camp]) => {
        if (!fetching && camp?.status === 'ENDED' && !campaignEndPayload.value) {
            campaignEndPayload.value = {
                epitaph: camp.endReason ?? 'The chronicle of this campaign has been sealed.',
                daysPlayed: 0,
                questsCompleted: 0,
            };
        }
    },
);

// ── Session ───────────────────────────────────────────────────────────────────
const sessionId = ref<string | null>(null);
const sceneType = ref<string>('EXPLORATION');
const levelUpPending = ref(false);
const spellPrepPending = ref(false);
const combatSession = ref<CombatSession | null>(null);
const characterId = ref<string | null>(null);

const { data: activeSessionData, executeQuery: refetchActiveSession } = useQuery({
    query: ACTIVE_SESSION_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value })),
    pause: computed(() => !campaign.value || campaignEnded.value),
});

const { executeMutation: startSessionMutation } = useMutation(START_SESSION_MUTATION);

function applySessionData(session: ActiveSession): void {
    sessionId.value = session.id;
    characterId.value = session.characterId;
    sceneType.value = session.sceneType;
    levelUpPending.value = session.levelUpPending;
    combatSession.value = session.combatSession as CombatSession | null;
}

watch(
    () => activeSessionData.value,
    async (data) => {
        if (data?.activeSession) {
            applySessionData(data.activeSession);
        } else if (data !== undefined) {
            const result = await startSessionMutation({ campaignId: campaignId.value });
            if (result.data?.startSession) {
                applySessionData(result.data.startSession);
            }
        }
    },
    { immediate: true },
);

const isCombat = computed(() => sceneType.value === 'COMBAT');

// ── Events / Transcript ───────────────────────────────────────────────────────
const persistedEvents = ref<PersistedGameEvent[]>([]);
const inProgressNarrative = ref('');
const innerVoiceText = ref('');
const lastSeenSequence = ref(0);

const { executeQuery: refetchEvents } = useQuery({
    query: GAME_EVENTS_QUERY,
    variables: computed(() => ({ sessionId: sessionId.value })),
    pause: computed(() => !sessionId.value),
    context: { requestPolicy: 'network-only' },
});

watch(sessionId, async (id) => {
    if (!id) return;
    const { data } = await refetchEvents({ requestPolicy: 'network-only' });
    persistedEvents.value = (data?.gameEvents ?? []) as PersistedGameEvent[];
});

// ── DM Stream Subscription ───────────────────────────────────────────────────
const isStreaming = ref(false);
const suggestedActions = ref<string[]>([]);

const { data: streamData } = useSubscription({
    query: DM_STREAM_SUBSCRIPTION,
    variables: computed(() => ({ sessionId: sessionId.value })),
    pause: computed(() => !sessionId.value),
});

watch(streamData, async (data) => {
    const chunk = data?.dmStream;
    if (!chunk) return;

    if (chunk.sequence <= lastSeenSequence.value) return;
    lastSeenSequence.value = chunk.sequence;

    switch (chunk.type) {
        case 'NARRATIVE_CHUNK':
            isStreaming.value = true;
            inProgressNarrative.value += chunk.text ?? '';
            break;

        case 'INNER_VOICE':
            innerVoiceText.value += chunk.text ?? '';
            break;

        case 'TOOL_RESULT':
            break;

        case 'SUGGESTED_ACTION':
            if (chunk.action) suggestedActions.value.push(chunk.action);
            break;

        case 'CAMPAIGN_ENDED':
            campaignEndPayload.value = chunk.toolResult as CampaignEndPayload;
            break;

        case 'STATUS':
            if (chunk.sceneType) sceneType.value = chunk.sceneType;
            if (chunk.status === 'LEVEL_UP_PENDING') levelUpPending.value = true;
            if (chunk.status === 'SPELL_PREP_PENDING') spellPrepPending.value = true;
            break;

        case 'DONE':
            if (!isStreaming.value && !inProgressNarrative.value) {
                break;
            }

            isStreaming.value = false;
            const { data: eventsData } = await refetchEvents({ requestPolicy: 'network-only' });
            persistedEvents.value = (eventsData?.gameEvents ?? []) as PersistedGameEvent[];
            inProgressNarrative.value = '';
            // Refetch session to pick up levelUpPending and combatSession changes
            const { data: sessionData } = await refetchActiveSession({ requestPolicy: 'network-only' });
            if (sessionData?.activeSession) {
                applySessionData(sessionData.activeSession);
            }
            await refetchCharacter({ requestPolicy: 'network-only' });
            break;
    }
});

// ── Player Input ──────────────────────────────────────────────────────────────
const playerInput = ref('');
const { executeMutation: sendInput } = useMutation(SEND_PLAYER_INPUT_MUTATION);

const inputDisabled = computed(() => isStreaming.value || levelUpPending.value || spellPrepPending.value);

async function handleSend() {
    const text = playerInput.value.trim();
    if (!text || inputDisabled.value || !sessionId.value) return;

    persistedEvents.value.push({
        id: `local-${Date.now()}`,
        sessionId: sessionId.value,
        eventType: 'PLAYER_INPUT',
        content: { text },
        createdAt: new Date().toISOString(),
    });
    playerInput.value = '';
    innerVoiceText.value = '';
    suggestedActions.value = [];
    lastSeenSequence.value = 0;

    await sendInput({ sessionId: sessionId.value, text });
}

function handleSuggestedAction(action: string) {
    playerInput.value = action;
}

function handleQuickAction(text: string) {
    playerInput.value = text;
}

// ── Level Up Panel ───────────────────────────────────────────────────────────
const { executeMutation: applyLevelUpMutation } = useMutation(APPLY_LEVEL_UP_MUTATION);
const { executeMutation: prepareSpellsMutation } = useMutation(PREPARE_SPELLS_MUTATION);
const levelUpHpRolled = ref(1);
const levelUpAsi = ref<Record<string, number>>({});
const levelUpFeat = ref('');
const levelUpUseFeat = ref(false);
const levelUpError = ref('');
const spellPrepError = ref('');
const selectedPreparedSpells = ref<string[]>([]);

async function handleLevelUpSubmit() {
    if (!sessionId.value) return;
    levelUpError.value = '';

    const result = await applyLevelUpMutation({
        sessionId: sessionId.value,
        hitPointsRolled: levelUpHpRolled.value,
        abilityScoreImprovements: levelUpUseFeat.value ? null : levelUpAsi.value,
        feat: levelUpUseFeat.value ? levelUpFeat.value : null,
    });

    if (result.error) {
        levelUpError.value = result.error.message;
        return;
    }

    levelUpPending.value = false;
    levelUpHpRolled.value = 1;
    levelUpAsi.value = {};
    levelUpFeat.value = '';
    levelUpUseFeat.value = false;
}

const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
const asiTotal = computed(() => Object.values(levelUpAsi.value).reduce((a, b) => a + b, 0));

function setAsi(ability: string, val: number) {
    if (val === 0) {
        const next = { ...levelUpAsi.value };
        delete next[ability];
        levelUpAsi.value = next;
    } else {
        levelUpAsi.value = { ...levelUpAsi.value, [ability]: val };
    }
}

// ── Character Sidebar ─────────────────────────────────────────────────────────
const { data: characterData, fetching: characterFetching, executeQuery: refetchCharacter } = useQuery({
    query: CHARACTER_QUERY_FOR_PLAY,
    variables: computed(() => ({ id: characterId.value })),
    pause: computed(() => !characterId.value),
});

const character = computed(() => characterData.value?.character ?? null);

const isDying = computed(() => {
    if (!character.value) return false;
    return character.value.hp === 0 && !character.value.isDead;
});

const { data: spellOptionsData, fetching: spellOptionsFetching } = useQuery({
    query: SPELL_OPTIONS_QUERY,
    variables: { first: 400 },
    pause: computed(() => !spellPrepPending.value || !character.value?.class?.name),
});

const availablePreparedSpells = computed<SpellOption[]>(() => {
    const className = character.value?.class?.name;
    if (!className) {
        return [];
    }

    const edges = spellOptionsData.value?.srdSpells?.edges ?? [];
    return edges
        .map((edge) => edge.node)
        .filter((spell: SpellOption | null | undefined): spell is SpellOption => Boolean(spell))
        .filter((spell) => spell.classes.includes(className))
        .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name));
});

const spellcastingAbilityModifier = computed(() => {
    const abilityKey = character.value?.class?.spellcastingAbility as typeof ABILITIES[number] | undefined;
    if (!abilityKey) {
        return 0;
    }

    const score = character.value?.abilityScores?.[abilityKey];
    return typeof score === 'number' ? Math.floor((score - 10) / 2) : 0;
});

const maxPreparedSpells = computed(() => {
    if (!character.value?.class?.index || !['wizard', 'cleric', 'druid'].includes(character.value.class.index)) {
        return 0;
    }

    return Math.max(1, character.value.level + spellcastingAbilityModifier.value);
});

watch(
    () => spellPrepPending.value,
    (pending) => {
        if (!pending) {
            selectedPreparedSpells.value = [];
            spellPrepError.value = '';
            return;
        }

        selectedPreparedSpells.value = [...(character.value?.preparedSpells ?? [])];
    },
    { immediate: true },
);

function togglePreparedSpell(spellIndex: string): void {
    if (selectedPreparedSpells.value.includes(spellIndex)) {
        selectedPreparedSpells.value = selectedPreparedSpells.value.filter((spell) => spell !== spellIndex);
        return;
    }

    if (maxPreparedSpells.value > 0 && selectedPreparedSpells.value.length >= maxPreparedSpells.value) {
        return;
    }

    selectedPreparedSpells.value = [...selectedPreparedSpells.value, spellIndex];
}

async function handlePrepareSpellsSubmit(): Promise<void> {
    if (!sessionId.value) return;
    spellPrepError.value = '';

    const result = await prepareSpellsMutation({
        sessionId: sessionId.value,
        spells: selectedPreparedSpells.value,
    });

    if (result.error) {
        spellPrepError.value = result.error.message;
        return;
    }

    spellPrepPending.value = false;
    selectedPreparedSpells.value = [];
    await refetchCharacter({ requestPolicy: 'network-only' });
}

// ── Scroll to bottom on new content ──────────────────────────────────────────
const transcriptRef = ref<HTMLElement | null>(null);

watch(
    [persistedEvents, inProgressNarrative],
    () => {
        nextTick(() => {
            if (transcriptRef.value) {
                transcriptRef.value.scrollTop = transcriptRef.value.scrollHeight;
            }
        });
    },
    { deep: true },
);
</script>
