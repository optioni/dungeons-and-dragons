<template>
    <div
        class="h-screen flex flex-col overflow-hidden grimoire-bg play-page"
        :class="{ 'is-combat': isCombat }"
    >
        <!-- Loading state -->
        <div v-if="campaignFetching || (!sessionId && !campaign)"
            class="flex-1 flex items-center justify-center">
            <div class="flex flex-col items-center gap-4 text-grimoire-muted relative z-10">
                <span class="w-3 h-3 rounded-full bg-grimoire-accent grimoire-breathe" />

                <p class="font-['IM_Fell_English',serif] italic text-lg">The grimoire stirs...</p>
            </div>
        </div>

        <!-- Campaign end screen -->
        <session-campaign-end-screen
            v-else-if="campaignEnded && campaignEndPayload"
            :epitaph="campaignEndPayload.epitaph"
            :days-played="campaignEndPayload.daysPlayed"
            :quests-completed="campaignEndPayload.questsCompleted"
            :character-name="character?.name ?? null"
        />

        <!-- Main play layout -->
        <template v-else-if="!campaignEnded">
            <!-- Book header spanning full width -->
            <session-play-header
                :location-name="campaign?.currentLocationName"
                :scene-type="sceneType"
                :in-game-date="campaign?.inGameDate"
                :hp="character?.hp"
                :max-hp="character?.maxHp"
                :campaign-id="campaignId"
            />

            <!-- Content row: combat panel + narrative column -->
            <div class="flex flex-1 overflow-hidden relative z-10">
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
                        :combat-events="recentCombatEvents"
                        @action="handleQuickAction"
                    />
                </transition>

                <!-- Narrative column -->
                <div class="flex-1 flex flex-col overflow-hidden">
                    <!-- Death-save status -->
                    <div v-if="isDying"
                        class="px-6 py-2 border-b border-red-900 bg-red-950/30 relative z-10"
                        data-testid="death-save-ui">
                        <div class="flex items-center justify-between max-w-2xl mx-auto">
                            <div class="flex items-center gap-2">
                                <span class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-red-300">Death Saves</span>
                            </div>

                            <div class="flex items-center gap-4">
                                <div class="flex items-center gap-1">
                                    <span class="font-['Cinzel',serif] text-xs text-grimoire-muted mr-1">Success</span>

                                    <span
                                        v-for="i in 3"
                                        :key="`ds${i}`"
                                        class="w-3 h-3 rounded-full border transition-colors"
                                        :class="i <= (character?.deathSaveSuccesses ?? 0)
                                            ? 'bg-emerald-700 border-emerald-700'
                                            : 'bg-transparent border-grimoire-muted/30'"
                                    />
                                </div>

                                <div class="flex items-center gap-1">
                                    <span class="font-['Cinzel',serif] text-xs text-grimoire-muted mr-1">Failure</span>

                                    <span
                                        v-for="i in 3"
                                        :key="`df${i}`"
                                        class="w-3 h-3 rounded-full border transition-colors"
                                        :class="i <= (character?.deathSaveFailures ?? 0)
                                            ? 'bg-red-800 border-red-800'
                                            : 'bg-transparent border-grimoire-muted/30'"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Transcript scroll area -->
                    <div ref="transcriptRef"
                        class="flex-1 overflow-y-auto">
                        <div class="max-w-2xl mx-auto px-8 py-8">
                            <div ref="topSentinelRef"
                                class="h-px"
                                aria-hidden="true" />

                            <session-transcript-view
                                :events="persistedEvents"
                                :in-progress-text="inProgressNarrative || undefined"
                                :inner-voice-text="innerVoiceText || undefined"
                                :character-name="character?.name ?? null"
                            />
                        </div>
                    </div>

                    <!-- Suggested actions -->
                    <div v-if="suggestedActions.length"
                        class="pb-3 relative z-10">
                        <div class="max-w-2xl mx-auto px-8">
                            <p v-if="pendingCheck"
                                class="font-['Cinzel',serif] text-[0.65rem] uppercase tracking-widest text-grimoire-accent-dim/70 mb-2">
                                {{ pendingCheck.skill ?? pendingCheck.ability }} check · DC {{ pendingCheck.dc }}
                            </p>

                            <div class="flex flex-col gap-1">
                                <button
                                    v-for="action in suggestedActions"
                                    :key="action"
                                    class="group relative text-left w-full pl-5 py-0.5"
                                    type="button"
                                    @click="handleSuggestedAction(action)"
                                >
                                    <span class="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-grimoire-accent/60 group-hover:text-grimoire-accent transition-colors duration-150 select-none">✦</span>

                                    <span class="font-['IM_Fell_English',serif] italic text-[1.05rem] text-grimoire-text/70 group-hover:text-grimoire-text transition-colors duration-150 leading-snug">{{ action }}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Streaming indicator — anchored above the input area -->
                    <div v-if="isStreaming"
                        class="px-8 py-1.5 relative z-10">
                        <div class="max-w-2xl mx-auto">
                            <span class="font-['IM_Fell_English',serif] italic text-sm text-grimoire-accent/50">
                                ▎<span class="grimoire-cursor-blink">_</span>
                            </span>
                        </div>
                    </div>

                    <!-- Input area -->
                    <div class="border-t border-grimoire-accent-dim/20 py-5 bg-grimoire-surface relative z-10">
                        <div class="max-w-2xl mx-auto px-8">
                            <textarea
                                v-model="playerInput"
                                aria-label="Player action"
                                class="w-full bg-transparent text-grimoire-text text-[1.125rem]
                                       font-['IM_Fell_English',serif] resize-none outline-none
                                       border-l-2 border-transparent pl-5
                                       placeholder:italic placeholder:text-grimoire-muted/50
                                       focus:border-grimoire-accent transition-colors duration-200
                                       disabled:opacity-40"
                                placeholder="What do you do, adventurer?"
                                :disabled="inputDisabled"
                                rows="2"
                                @keydown.enter.exact.prevent="handleSend"
                            />

                            <div class="flex justify-end mt-2">
                                <button
                                    class="font-['Cinzel',serif] text-xs tracking-widest uppercase
                                           text-grimoire-accent/60 hover:text-grimoire-accent
                                           transition-colors duration-150 disabled:opacity-30"
                                    type="button"
                                    data-testid="send-button"
                                    :disabled="inputDisabled || !playerInput.trim()"
                                    @click="handleSend"
                                >
                                    Act ↵
                                </button>
                            </div>
                        </div>
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
                            class="absolute inset-0 bg-grimoire-bg/90 backdrop-blur-sm flex items-center justify-center p-6 z-20"
                        >
                            <div class="bg-grimoire-surface border border-grimoire-accent-dim/30 rounded-sm p-6 w-full max-w-md space-y-5">
                                <div class="text-center">
                                    <u-icon name="i-lucide-star"
                                        class="text-grimoire-accent text-3xl mb-2" />

                                    <h2 class="font-['IM_Fell_English',serif] text-2xl text-grimoire-text">Level Up!</h2>

                                    <p class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted mt-1">
                                        You are now level {{ (character?.level ?? 0) + 1 }}
                                    </p>
                                </div>

                                <!-- HP increase -->
                                <div class="space-y-2">
                                    <label class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-wider">
                                        Hit Points Gained
                                    </label>

                                    <p class="font-['IM_Fell_English',serif] text-sm text-grimoire-muted/70 italic">
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
                                    <label class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-wider">
                                        Ability Score Improvement
                                    </label>

                                    <div class="flex gap-3">
                                        <button
                                            type="button"
                                            class="font-['Cinzel',serif] text-xs tracking-widest uppercase px-3 py-1.5 rounded-sm border transition-colors duration-150"
                                            :class="!levelUpUseFeat
                                                ? 'bg-grimoire-accent text-grimoire-bg border-grimoire-accent'
                                                : 'text-grimoire-muted border-grimoire-accent-dim/30 hover:border-grimoire-accent-dim/60'"
                                            @click="levelUpUseFeat = false"
                                        >
                                            Ability Scores
                                        </button>

                                        <button
                                            type="button"
                                            class="font-['Cinzel',serif] text-xs tracking-widest uppercase px-3 py-1.5 rounded-sm border transition-colors duration-150"
                                            :class="levelUpUseFeat
                                                ? 'bg-grimoire-accent text-grimoire-bg border-grimoire-accent'
                                                : 'text-grimoire-muted border-grimoire-accent-dim/30 hover:border-grimoire-accent-dim/60'"
                                            @click="levelUpUseFeat = true"
                                        >
                                            Feat
                                        </button>
                                    </div>

                                    <!-- ASI selector -->
                                    <div v-if="!levelUpUseFeat"
                                        class="space-y-2">
                                        <p class="font-['IM_Fell_English',serif] text-xs italic text-grimoire-muted/70">
                                            Distribute {{ 2 - asiTotal }} remaining point(s) across abilities.
                                        </p>

                                        <div class="grid grid-cols-3 gap-2">
                                            <div
                                                v-for="ability in ABILITIES"
                                                :key="ability"
                                                class="flex flex-col items-center gap-1"
                                            >
                                                <span class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase">{{ ability }}</span>

                                                <div class="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        class="w-5 h-5 rounded-sm text-xs text-grimoire-muted bg-grimoire-raised hover:bg-grimoire-surface disabled:opacity-40"
                                                        :disabled="(levelUpAsi[ability] ?? 0) === 0"
                                                        @click="setAsi(ability, (levelUpAsi[ability] ?? 0) - 1)"
                                                    >
                                                        -
                                                    </button>

                                                    <span class="w-4 text-center text-sm font-mono text-grimoire-text">{{ levelUpAsi[ability] ?? 0 }}</span>

                                                    <button
                                                        type="button"
                                                        class="w-5 h-5 rounded-sm text-xs text-grimoire-muted bg-grimoire-raised hover:bg-grimoire-surface disabled:opacity-40"
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
                                    class="font-['IM_Fell_English',serif] text-sm italic text-red-400">
                                    {{ levelUpError }}
                                </p>

                                <!-- Submit -->
                                <button
                                    type="button"
                                    class="w-full py-3 bg-grimoire-accent text-grimoire-bg font-['Cinzel',serif]
                                           text-sm tracking-widest uppercase hover:bg-grimoire-accent/90
                                           transition-colors duration-200 disabled:opacity-40 rounded-sm"
                                    :disabled="levelUpHpRolled < 1"
                                    @click="handleLevelUpSubmit"
                                >
                                    Confirm Level Up
                                </button>
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
                            class="absolute inset-0 bg-grimoire-bg/90 backdrop-blur-sm flex items-center justify-center p-6 z-20"
                        >
                            <div class="bg-grimoire-surface border border-grimoire-accent-dim/30 rounded-sm p-6 w-full max-w-2xl space-y-5">
                                <div class="text-center">
                                    <u-icon name="i-lucide-book-open-check"
                                        class="text-grimoire-accent text-3xl mb-2" />

                                    <h2 class="font-['IM_Fell_English',serif] text-2xl text-grimoire-text">Prepare Spells</h2>

                                    <p class="font-['IM_Fell_English',serif] italic text-sm text-grimoire-muted mt-1">
                                        Choose up to {{ maxPreparedSpells }} spells for {{ character?.name }}.
                                    </p>
                                </div>

                                <div class="flex items-center justify-between font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-widest">
                                    <span>{{ selectedPreparedSpells.length }}/{{ maxPreparedSpells }} selected</span>

                                    <span v-if="spellOptionsFetching">Loading spell list…</span>
                                </div>

                                <div class="max-h-96 overflow-y-auto border border-grimoire-accent-dim/20 rounded-sm divide-y divide-grimoire-surface">
                                    <button
                                        v-for="spell in availablePreparedSpells"
                                        :key="spell.index"
                                        type="button"
                                        class="w-full px-4 py-3 text-left hover:bg-grimoire-raised/70 transition-colors disabled:opacity-50"
                                        :disabled="!selectedPreparedSpells.includes(spell.index)
                                            && maxPreparedSpells > 0
                                            && selectedPreparedSpells.length >= maxPreparedSpells"
                                        @click="togglePreparedSpell(spell.index)"
                                    >
                                        <div class="flex items-center justify-between gap-4">
                                            <div>
                                                <p class="font-['IM_Fell_English',serif] text-base text-grimoire-text">{{ spell.name }}</p>

                                                <p class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-wider">Level {{ spell.level }}</p>
                                            </div>

                                            <span
                                                class="font-['Cinzel',serif] text-xs tracking-widest uppercase px-2 py-0.5 rounded-sm border"
                                                :class="selectedPreparedSpells.includes(spell.index)
                                                    ? 'text-grimoire-accent border-grimoire-accent-dim/50'
                                                    : 'text-grimoire-muted border-grimoire-muted/20'"
                                            >
                                                {{ selectedPreparedSpells.includes(spell.index) ? 'Prepared' : 'Available' }}
                                            </span>
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
                                    <button
                                        type="button"
                                        class="py-2.5 px-6 bg-grimoire-accent text-grimoire-bg font-['Cinzel',serif]
                                               text-xs tracking-widest uppercase hover:bg-grimoire-accent/90
                                               transition-colors duration-200 disabled:opacity-40 rounded-sm"
                                        :disabled="spellOptionsFetching"
                                        @click="handlePrepareSpellsSubmit"
                                    >
                                        Confirm Prepared Spells
                                    </button>
                                </div>
                            </div>
                        </div>
                    </transition>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { useQuery, useMutation, useSubscription } from '@urql/vue';
import { type ResultOf } from 'gql.tada';
import { nextTick, onMounted, onUnmounted } from 'vue';

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
import { isPlayerVisibleEventPayload, type PlayerVisibleEventPayload } from '~/types/player-visible-event';

definePageMeta({});

const route = useRoute();
const router = useRouter();
const campaignId = computed(() => route.params.id as string);

type ActiveSession = NonNullable<ResultOf<typeof ACTIVE_SESSION_QUERY>['activeSession']>;
type GameEventsConnection = ResultOf<typeof GAME_EVENTS_QUERY>['gameEvents'];
type GameEventNode = GameEventsConnection['edges'][number]['node'];
type PersistedGameEvent = Omit<GameEventNode, 'content'> & {
    content: Record<string, unknown>
};
type SpellOption = ResultOf<typeof SPELL_OPTIONS_QUERY>['srdSpells']['edges'][number]['node'];

// ── Campaign ─────────────────────────────────────────────────────────────────
const { data: campaignData, fetching: campaignFetching, executeQuery: refetchCampaign } = useQuery({
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
const innerVoiceText = ref('');

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
            if (data.activeSession.lastInnerVoice) {
                innerVoiceText.value = data.activeSession.lastInnerVoice;
            }
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
const GAME_EVENTS_PAGE_SIZE = 60;
const persistedEvents = ref<PersistedGameEvent[]>([]);
const inProgressNarrative = ref('');
const lastSeenSequence = ref(0);
const earliestCursor = ref<string | null>(null);
const hasPreviousPage = ref(false);
const isLoadingEarlier = ref(false);
const eventsBeforeCursor = ref<string | null>(null);
const transcriptRef = ref<HTMLElement | null>(null);
const topSentinelRef = ref<HTMLElement | null>(null);
const suppressNextTranscriptAutoScroll = ref(false);

let rafScrollId: number | null = null;

function scrollToBottom(): void {
    if (rafScrollId !== null) cancelAnimationFrame(rafScrollId);
    rafScrollId = requestAnimationFrame(() => {
        rafScrollId = null;
        if (transcriptRef.value) {
            transcriptRef.value.scrollTop = transcriptRef.value.scrollHeight;
        }
    });
}

const { executeQuery: refetchEvents } = useQuery({
    query: GAME_EVENTS_QUERY,
    variables: computed(() => ({
        sessionId: sessionId.value,
        last: GAME_EVENTS_PAGE_SIZE,
        before: eventsBeforeCursor.value,
    })),
    pause: true,
    context: { requestPolicy: 'network-only' },
});

function getEventNodes(connection: GameEventsConnection | null | undefined): PersistedGameEvent[] {
    return (connection?.edges ?? []).map((edge) => edge.node as PersistedGameEvent);
}

function rehydrateSuggestedActions(events: PersistedGameEvent[]): void {
    for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        if (event.eventType === 'PLAYER_INPUT') break;
        if (event.eventType === 'TOOL_CALL') {
            const content = event.content as { toolName?: string; toolInput?: { actions?: unknown }; toolResult?: { success?: boolean } };
            if (
                content.toolName === 'suggest_actions'
                && content.toolResult?.success === true
                && Array.isArray(content.toolInput?.actions)
            ) {
                suggestedActions.value = (content.toolInput.actions as unknown[])
                    .filter((a): a is string => typeof a === 'string');
                break;
            }
        }
    }
}

function applyEventConnection(connection: GameEventsConnection | null | undefined): void {
    persistedEvents.value = getEventNodes(connection);
    earliestCursor.value = connection?.pageInfo.startCursor ?? null;
    hasPreviousPage.value = connection?.pageInfo.hasPreviousPage ?? false;
    rehydrateSuggestedActions(persistedEvents.value);
}

const visibleMechanicalEvents = computed(() =>
    persistedEvents.value
        .filter((event) => event.eventType === 'PLAYER_VISIBLE_EVENT')
        .map((event) => event.content)
        .filter(isPlayerVisibleEventPayload),
);

const recentCombatEvents = computed<PlayerVisibleEventPayload[]>(() =>
    visibleMechanicalEvents.value.filter((event) => event.category === 'COMBAT').slice(-8),
);

async function fetchEventsPage(before: string | null = null): Promise<GameEventsConnection | null | undefined> {
    eventsBeforeCursor.value = before;
    const { data } = await refetchEvents({ requestPolicy: 'network-only' });
    eventsBeforeCursor.value = null;
    return data.value?.gameEvents;
}

watch(sessionId, async (id) => {
    if (!id) return;
    applyEventConnection(await fetchEventsPage());
});

async function loadEarlierEvents(): Promise<void> {
    if (!hasPreviousPage.value || !earliestCursor.value || isLoadingEarlier.value || !transcriptRef.value) {
        return;
    }

    isLoadingEarlier.value = true;
    const scrollEl = transcriptRef.value;
    const previousScrollHeight = scrollEl.scrollHeight;

    try {
        const connection = await fetchEventsPage(earliestCursor.value);
        const earlierEvents = getEventNodes(connection);
        const existingIds = new Set(persistedEvents.value.map((event) => event.id));

        suppressNextTranscriptAutoScroll.value = true;
        persistedEvents.value = [
            ...earlierEvents.filter((event) => !existingIds.has(event.id)),
            ...persistedEvents.value,
        ];
        earliestCursor.value = connection?.pageInfo.startCursor ?? earliestCursor.value;
        hasPreviousPage.value = connection?.pageInfo.hasPreviousPage ?? false;

        await nextTick();
        scrollEl.scrollTop += scrollEl.scrollHeight - previousScrollHeight;
    } finally {
        suppressNextTranscriptAutoScroll.value = false;
        isLoadingEarlier.value = false;
    }
}

let topSentinelObserver: IntersectionObserver | null = null;

onMounted(() => {
    if (!topSentinelRef.value || !transcriptRef.value || typeof IntersectionObserver === 'undefined') {
        return;
    }

    topSentinelObserver = new IntersectionObserver(
        (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                void loadEarlierEvents();
            }
        },
        { root: transcriptRef.value },
    );
    topSentinelObserver.observe(topSentinelRef.value);
});

onUnmounted(() => {
    topSentinelObserver?.disconnect();
    topSentinelObserver = null;
});

// ── DM Stream Subscription ───────────────────────────────────────────────────
const isStreaming = ref(false);
const suggestedActions = ref<string[]>([]);
const pendingCheck = ref<{ skill?: string; ability?: string; dc: number } | null>(null);

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

        case 'PENDING_CHECK':
            if (chunk.pendingCheck) pendingCheck.value = chunk.pendingCheck as { skill?: string; ability?: string; dc: number };
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
            suppressNextTranscriptAutoScroll.value = true;

            {
                const connection = await fetchEventsPage();
                const newEvents = getEventNodes(connection);
                const existingIds = new Set(persistedEvents.value.map((e) => e.id));
                persistedEvents.value = [
                    ...persistedEvents.value,
                    ...newEvents.filter((e) => !existingIds.has(e.id)),
                ];
                earliestCursor.value = connection?.pageInfo.startCursor ?? earliestCursor.value;
                hasPreviousPage.value = connection?.pageInfo.hasPreviousPage ?? false;
                rehydrateSuggestedActions(persistedEvents.value);
            }

            inProgressNarrative.value = '';
            await nextTick();
            suppressNextTranscriptAutoScroll.value = false;
            scrollToBottom();

            const { data: sessionData } = await refetchActiveSession({ requestPolicy: 'network-only' });
            if (sessionData.value?.activeSession) {
                applySessionData(sessionData.value.activeSession);
            }
            await refetchCampaign({ requestPolicy: 'network-only' });
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
    pendingCheck.value = null;
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

// ── Character ─────────────────────────────────────────────────────────────────
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

watch(
    [persistedEvents, inProgressNarrative],
    () => {
        if (suppressNextTranscriptAutoScroll.value) return;
        scrollToBottom();
    },
);
</script>
