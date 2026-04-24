<template>
    <div class="min-h-screen bg-gray-950 p-4 md:p-6">
        <!-- Navigation -->
        <div class="max-w-6xl mx-auto mb-6">
            <div class="flex items-center gap-4">
                <nuxt-link
                    :to="`/campaign/${campaignId}/play`"
                    class="text-gray-400 hover:text-white transition-colors text-sm"
                >
                    <u-icon name="i-lucide-arrow-left"
                        class="mr-1" />
                    Back to Play
                </nuxt-link>

                <div class="flex gap-3 ml-auto">
                    <nuxt-link
                        :to="`/campaign/${campaignId}/quests`"
                        class="text-gray-400 hover:text-white transition-colors text-sm"
                    >
                        Quests
                    </nuxt-link>

                    <nuxt-link
                        :to="`/campaign/${campaignId}/character`"
                        class="text-gray-400 hover:text-white transition-colors text-sm"
                    >
                        Character
                    </nuxt-link>

                    <nuxt-link
                        :to="`/campaign/${campaignId}/world`"
                        class="text-primary-400 font-medium text-sm"
                    >
                        World
                    </nuxt-link>
                </div>
            </div>
        </div>

        <div class="max-w-6xl mx-auto space-y-6">
            <h1 class="text-3xl font-bold text-white">World Overview</h1>

            <!-- World Map Section (primary) -->
            <u-card>
                <template #header>
                    <div class="flex items-center justify-between flex-wrap gap-2">
                        <h2 class="text-lg font-semibold">Map</h2>

                        <!-- Scale switcher -->
                        <div class="flex gap-1">
                            <u-button
                                v-for="scale in availableScales"
                                :key="scale"
                                size="xs"
                                :variant="selectedScale === scale ? 'solid' : 'soft'"
                                color="neutral"
                                @click="setScale(scale)"
                            >
                                {{ scale }}
                            </u-button>
                        </div>
                    </div>
                </template>

                <!-- Fixed-height map container to prevent panel shift on scale changes -->
                <div class="relative w-full"
                    style="height: 400px;">
                    <div v-if="mapFetching"
                        class="absolute inset-0 flex items-center justify-center bg-gray-900 rounded">
                        <u-icon name="i-lucide-loader-circle"
                            class="animate-spin text-2xl text-gray-400" />
                    </div>

                    <div
                        v-else-if="!worldMap || (worldMap.discoveredNodes.length === 0 && worldMap.frontierNodes.length === 0)"
                        class="absolute inset-0 flex items-center justify-center bg-gray-900 rounded"
                    >
                        <p class="text-gray-500 text-sm">No map data for this scale yet.</p>
                    </div>

                    <world-map-graph
                        v-else
                        class="w-full h-full"
                        :discovered-nodes="worldMap.discoveredNodes"
                        :frontier-nodes="worldMap.frontierNodes"
                        :edges="worldMap.edges"
                        :current-location-id="worldMap.currentLocationId"
                        :previous-node-ids="previousNodeIds"
                        aria-label="Campaign world map"
                        @node-select="onMapNodeSelect"
                    />
                </div>
            </u-card>

            <!-- Reference panels (desktop: 2-col grid, mobile: stacked) -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Factions -->
                <u-card>
                    <template #header>
                        <h2 class="text-lg font-semibold">Factions</h2>
                    </template>

                    <div v-if="factionsFetching"
                        class="flex justify-center py-6">
                        <u-icon name="i-lucide-loader-circle"
                            class="animate-spin" />
                    </div>

                    <div v-else-if="!factions.length"
                        class="text-center text-gray-500 py-6">
                        No factions known yet.
                    </div>

                    <div v-else
                        class="space-y-4">
                        <div
                            v-for="faction in factions"
                            :key="faction.id"
                            class="rounded-lg bg-gray-800 p-4"
                        >
                            <div class="flex items-start gap-3">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="font-medium text-white">{{ faction.name }}</span>

                                        <u-badge
                                            v-if="faction.playerDisposition"
                                            :color="dispositionColor(faction.playerDisposition)"
                                            variant="soft"
                                            size="xs"
                                        >
                                            {{ faction.playerDisposition }}
                                        </u-badge>

                                        <span v-if="faction.powerLevel != null"
                                            class="text-xs text-gray-500">
                                            Power {{ faction.powerLevel }}/10
                                        </span>
                                    </div>

                                    <p v-if="faction.goals"
                                        class="text-sm text-gray-400 mt-1">
                                        {{ faction.goals }}
                                    </p>

                                    <p v-if="faction.territory"
                                        class="text-xs text-gray-500 mt-1">
                                        Territory: {{ faction.territory }}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </u-card>

                <!-- NPC Roster -->
                <u-card>
                    <template #header>
                        <h2 class="text-lg font-semibold">Known NPCs</h2>
                    </template>

                    <div v-if="npcsFetching"
                        class="flex justify-center py-6">
                        <u-icon name="i-lucide-loader-circle"
                            class="animate-spin" />
                    </div>

                    <div v-else-if="!npcs.length"
                        class="text-center text-gray-500 py-6">
                        No NPCs encountered yet.
                    </div>

                    <div v-else
                        class="space-y-2">
                        <button
                            v-for="npc in npcs"
                            :key="npc.id"
                            type="button"
                            class="w-full text-left rounded-lg bg-gray-800 px-4 py-3 hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                            @click="openNpcModal(npc.id)"
                        >
                            <div class="flex items-center gap-3 flex-wrap">
                                <span class="font-medium text-white">{{ npc.name }}</span>

                                <span v-if="npc.profession"
                                    class="text-xs text-gray-400">{{ npc.profession }}</span>

                                <u-badge
                                    v-if="npc.disposition"
                                    :color="dispositionColor(npc.disposition)"
                                    variant="soft"
                                    size="xs"
                                >
                                    {{ npc.disposition }}
                                </u-badge>

                                <u-badge
                                    v-if="npc.partyStatus && npc.partyStatus !== 'NONE'"
                                    color="success"
                                    variant="soft"
                                    size="xs"
                                >
                                    {{ npc.partyStatus }}
                                </u-badge>

                                <u-badge
                                    v-if="!npc.alive"
                                    color="error"
                                    variant="soft"
                                    size="xs"
                                >
                                    Deceased
                                </u-badge>
                            </div>
                        </button>

                        <div v-if="npcsPageInfo?.hasNextPage"
                            class="flex justify-center pt-2">
                            <u-button
                                variant="soft"
                                color="neutral"
                                size="sm"
                                :loading="npcsLoadingMore"
                                @click="loadMoreNpcs"
                            >
                                Load more NPCs
                            </u-button>
                        </div>
                    </div>
                </u-card>
            </div>

            <!-- Diary Entries -->
            <u-card>
                <template #header>
                    <h2 class="text-lg font-semibold">Diary</h2>
                </template>

                <div v-if="diaryFetching"
                    class="flex justify-center py-6">
                    <u-icon name="i-lucide-loader-circle"
                        class="animate-spin" />
                </div>

                <div v-else-if="!recentDiary.length"
                    class="text-center text-gray-500 py-6">
                    No diary entries yet.
                </div>

                <div v-else
                    class="space-y-3">
                    <!-- Diary search -->
                    <div class="pb-2">
                        <u-input
                            v-model="diarySearch"
                            placeholder="Search diary…"
                            size="sm"
                            icon="i-lucide-search"
                        />
                    </div>

                    <div
                        v-for="entry in filteredRecentDiary"
                        :key="entry.id"
                        class="rounded-lg bg-gray-800 p-4"
                    >
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-xs font-medium text-primary-400">{{ entry.inGameDate }}</span>

                            <u-badge
                                v-if="entry.entryType === 'MEMORIAL'"
                                color="error"
                                variant="soft"
                                size="xs"
                            >
                                Memorial
                            </u-badge>
                        </div>

                        <p class="text-sm text-gray-300">{{ entry.content }}</p>
                    </div>

                    <!-- Older entries collapsed section -->
                    <template v-if="filteredOlderDiary.length || diaryPageInfo?.hasNextPage">
                        <div class="pt-2">
                            <u-button
                                variant="ghost"
                                color="neutral"
                                size="sm"
                                class="w-full"
                                @click="showOlderDiary = !showOlderDiary"
                            >
                                {{ showOlderDiary ? 'Hide older entries' : 'Show older entries' }}
                            </u-button>
                        </div>

                        <template v-if="showOlderDiary">
                            <div
                                v-for="entry in filteredOlderDiary"
                                :key="entry.id"
                                class="rounded-lg bg-gray-900 border border-gray-800 p-4"
                            >
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="text-xs font-medium text-gray-400">{{ entry.inGameDate }}</span>
                                </div>

                                <p class="text-sm text-gray-400">{{ entry.content }}</p>
                            </div>

                            <div v-if="diaryPageInfo?.hasNextPage"
                                class="flex justify-center pt-1">
                                <u-button
                                    variant="soft"
                                    color="neutral"
                                    size="sm"
                                    :loading="diaryLoadingMore"
                                    @click="loadMoreDiary"
                                >
                                    Load more diary entries
                                </u-button>
                            </div>
                        </template>
                    </template>
                </div>
            </u-card>

            <!-- Active World Events -->
            <u-card>
                <template #header>
                    <h2 class="text-lg font-semibold">Active World Events</h2>
                </template>

                <div v-if="eventsFetching"
                    class="flex justify-center py-6">
                    <u-icon name="i-lucide-loader-circle"
                        class="animate-spin" />
                </div>

                <div v-else-if="!worldEvents.length"
                    class="text-center text-gray-500 py-6">
                    No active world events.
                </div>

                <div v-else
                    class="space-y-3">
                    <div
                        v-for="event in worldEvents"
                        :key="event.id"
                        class="rounded-lg bg-gray-800 p-4"
                    >
                        <div class="flex items-center gap-2 mb-1">
                            <u-badge
                                color="warning"
                                variant="soft"
                                size="xs"
                            >
                                {{ event.status }}
                            </u-badge>

                            <span v-if="event.deadlineInGameDate"
                                class="text-xs text-gray-500">
                                Deadline: {{ event.deadlineInGameDate }}
                            </span>
                        </div>

                        <p class="text-sm text-gray-300">{{ event.description }}</p>
                    </div>
                </div>
            </u-card>
        </div>

        <!-- NPC Profile Modal -->
        <u-modal v-model:open="npcModalOpen">
            <template #content>
                <u-card>
                    <template #header>
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-semibold">{{ selectedNpc?.name ?? 'NPC Profile' }}</h3>

                            <u-button
                                icon="i-lucide-x"
                                variant="ghost"
                                color="neutral"
                                size="sm"
                                @click="npcModalOpen = false"
                            />
                        </div>
                    </template>

                    <div v-if="npcProfileFetching"
                        class="flex justify-center py-8">
                        <u-icon name="i-lucide-loader-circle"
                            class="animate-spin" />
                    </div>

                    <div v-else-if="selectedNpc"
                        class="space-y-4">
                        <div class="flex flex-wrap gap-2">
                            <u-badge
                                v-if="selectedNpc.profession"
                                color="neutral"
                                variant="soft"
                            >
                                {{ selectedNpc.profession }}
                            </u-badge>

                            <u-badge
                                v-if="selectedNpc.disposition"
                                :color="dispositionColor(selectedNpc.disposition)"
                                variant="soft"
                            >
                                {{ selectedNpc.disposition }}
                            </u-badge>

                            <u-badge
                                v-if="selectedNpc.partyStatus && selectedNpc.partyStatus !== 'NONE'"
                                color="success"
                                variant="soft"
                            >
                                {{ selectedNpc.partyStatus }}
                            </u-badge>
                        </div>

                        <p v-if="selectedNpc.description"
                            class="text-sm text-gray-300">
                            {{ selectedNpc.description }}
                        </p>

                        <div v-if="selectedNpc.coreMotivation"
                            class="text-sm">
                            <span class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Motivation</span>

                            <span class="text-gray-300">{{ selectedNpc.coreMotivation }}</span>
                        </div>

                        <div v-if="selectedNpc.speechStyle"
                            class="text-sm">
                            <span class="text-xs text-gray-500 uppercase tracking-wider block mb-1">Speech Style</span>

                            <span class="text-gray-400 italic">{{ selectedNpc.speechStyle }}</span>
                        </div>

                        <div v-if="selectedNpc.relationships?.length"
                            class="text-sm">
                            <span class="text-xs text-gray-500 uppercase tracking-wider block mb-2">Relationships</span>

                            <div class="space-y-1">
                                <div
                                    v-for="rel in selectedNpc.relationships"
                                    :key="rel.id"
                                    class="flex items-center gap-2 text-xs"
                                >
                                    <u-badge
                                        color="neutral"
                                        variant="soft"
                                        size="xs"
                                    >
                                        {{ rel.type }}
                                    </u-badge>

                                    <span class="text-gray-400">NPC #{{ rel.targetNpcId }}</span>

                                    <span v-if="rel.description"
                                        class="text-gray-500">— {{ rel.description }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </u-card>
            </template>
        </u-modal>

        <!-- Travel Confirmation Dialog -->
        <u-modal v-model:open="travelDialogOpen">
            <template #content>
                <u-card>
                    <template #header>
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-semibold">Travel to {{ travelDestination?.name }}</h3>

                            <u-button
                                icon="i-lucide-x"
                                variant="ghost"
                                color="neutral"
                                size="sm"
                                @click="travelDialogOpen = false"
                            />
                        </div>
                    </template>

                    <p class="text-sm text-gray-300 mb-4">
                        Set out for <strong class="text-white">{{ travelDestination?.name }}</strong>?
                        The DM will narrate the journey, handle any encounters, and update your location.
                    </p>

                    <div v-if="travelError"
                        class="mb-4 p-3 rounded bg-red-900/50 border border-red-700 text-red-300 text-sm">
                        {{ travelError }}
                    </div>

                    <div class="flex gap-3 justify-end">
                        <u-button
                            variant="soft"
                            color="neutral"
                            @click="travelDialogOpen = false"
                        >
                            Cancel
                        </u-button>

                        <u-button
                            color="primary"
                            :loading="travelLoading"
                            @click="confirmTravel"
                        >
                            Travel
                        </u-button>
                    </div>
                </u-card>
            </template>
        </u-modal>
    </div>
</template>

<script setup lang="ts">
import { useMutation, useQuery } from '@urql/vue';
import { type ResultOf } from 'gql.tada';

import {
    ACTIVE_SESSION_QUERY,
    SEND_PLAYER_INPUT_MUTATION,
    START_SESSION_MUTATION,
} from '~/graphql/session';
import {
    FACTIONS_QUERY,
    NPCS_QUERY,
    NPC_PROFILE_QUERY,
    DIARY_ENTRIES_QUERY,
    WORLD_EVENTS_QUERY,
    WORLD_MAP_QUERY,
} from '~/graphql/world';

// ── Types ──────────────────────────────────────────────────────────────────

type WorldMapData = ResultOf<typeof WORLD_MAP_QUERY>['worldMap'];
type MapScale = WorldMapData['selectedScale'];
type NpcRosterItem = ResultOf<typeof NPCS_QUERY>['npcs']['edges'][number]['node'];
type NpcProfile = ResultOf<typeof NPC_PROFILE_QUERY>['npc'];
type DiaryEntry = ResultOf<typeof DIARY_ENTRIES_QUERY>['diaryEntries']['edges'][number]['node'];

// ── Route ─────────────────────────────────────────────────────────────────

const route = useRoute();
const router = useRouter();
const campaignId = computed(() => route.params.id as string);

// ── World Map ─────────────────────────────────────────────────────────────

const selectedScale = ref<MapScale>('WORLD');
const worldMap = ref<WorldMapData | null>(null);
const previousNodeIds = ref<Set<string>>(new Set<string>());

const { data: mapData, fetching: mapFetching, executeQuery: refetchMap } = useQuery({
    query: WORLD_MAP_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value, scale: selectedScale.value })),
    requestPolicy: 'network-only',
});

watch(mapData, (data) => {
    if (!data?.worldMap) return;

    // Capture current visible ids BEFORE updating for animation diffing
    if (worldMap.value) {
        const currentIds = new Set<string>();
        for (const n of worldMap.value.discoveredNodes) currentIds.add(n.id);
        for (const n of worldMap.value.frontierNodes) currentIds.add(n.id);
        previousNodeIds.value = currentIds;
    }

    worldMap.value = data.worldMap;
}, { immediate: true });

const availableScales = computed<MapScale[]>(() => worldMap.value?.availableScales ?? []);

function setScale(scale: MapScale): void {
    if (scale === selectedScale.value) return;
    // Capture current node ids before scale switch so no animation replays
    if (worldMap.value) {
        const ids = new Set<string>();
        for (const n of worldMap.value.discoveredNodes) ids.add(n.id);
        for (const n of worldMap.value.frontierNodes) ids.add(n.id);
        previousNodeIds.value = ids;
    }
    selectedScale.value = scale;
}

// Refetch map when returning from play (route change detection)
onActivated(() => {
    void refetchMap({ requestPolicy: 'network-only' });
});

// ── Travel Flow ───────────────────────────────────────────────────────────

const travelDialogOpen = ref(false);
const travelDestination = ref<{ id: string; name: string } | null>(null);
const travelLoading = ref(false);
const travelError = ref<string | null>(null);

const { data: activeSessionData } = useQuery({
    query: ACTIVE_SESSION_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value })),
});

const { executeMutation: startSessionMutation } = useMutation(START_SESSION_MUTATION);
const { executeMutation: sendPlayerInputMutation } = useMutation(SEND_PLAYER_INPUT_MUTATION);

function onMapNodeSelect(nodeId: string, name: string): void {
    // Prevent travel to current location
    if (nodeId === worldMap.value?.currentLocationId) return;
    travelDestination.value = { id: nodeId, name };
    travelError.value = null;
    travelDialogOpen.value = true;
}

async function confirmTravel(): Promise<void> {
    if (!travelDestination.value || travelLoading.value) return;
    travelError.value = null;
    travelLoading.value = true;

    try {
        // Resolve or start an active session
        let sessionId = activeSessionData.value?.activeSession?.id ?? null;

        if (!sessionId) {
            const sessionResult = await startSessionMutation({ campaignId: campaignId.value });
            if (sessionResult.error || !sessionResult.data?.startSession) {
                travelError.value = 'Could not start a session. Please try again.';
                return;
            }
            sessionId = sessionResult.data.startSession.id;
        }

        // Send the travel input through the DM session flow
        const inputResult = await sendPlayerInputMutation({
            sessionId,
            text: `Travel to ${travelDestination.value.name}.`,
        });

        if (inputResult.error) {
            travelError.value = 'Failed to submit travel request. Please try again.';
            return;
        }

        travelDialogOpen.value = false;
        // Navigate to play so the DM stream narrates the journey
        await router.push(`/campaign/${campaignId.value}/play`);
    } finally {
        travelLoading.value = false;
    }
}

// ── Factions ──────────────────────────────────────────────────────────────

const { data: factionsData, fetching: factionsFetching } = useQuery({
    query: FACTIONS_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value, first: 50 })),
});

const factions = computed(() =>
    (factionsData.value?.factions?.edges ?? []).map((edge) => edge.node),
);

// ── NPCs ──────────────────────────────────────────────────────────────────

const npcsAfter = ref<string | null>(null);
const allNpcs = ref<NpcRosterItem[]>([]);
const npcsPageInfo = ref<{ hasNextPage: boolean; endCursor: string | null } | null>(null);
const npcsLoadingMore = ref(false);

const { data: npcsData, fetching: npcsFetching } = useQuery({
    query: NPCS_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value, first: 20 })),
});

watch(npcsData, (data) => {
    if (!data) return;
    const edges = data.npcs?.edges ?? [];
    allNpcs.value = edges.map((edge) => edge.node);
    npcsPageInfo.value = data.npcs?.pageInfo ?? null;
});

const npcs = computed(() => allNpcs.value);

async function loadMoreNpcs(): Promise<void> {
    if (!npcsPageInfo.value?.endCursor || npcsLoadingMore.value) return;
    npcsLoadingMore.value = true;
    npcsAfter.value = npcsPageInfo.value.endCursor;
    npcsLoadingMore.value = false;
}

// ── NPC Profile Modal ─────────────────────────────────────────────────────

const npcModalOpen = ref(false);
const selectedNpcId = ref<string | null>(null);
const selectedNpc = ref<NpcProfile | null>(null);

const { data: npcProfileData, fetching: npcProfileFetching } = useQuery({
    query: NPC_PROFILE_QUERY,
    variables: computed(() => ({ id: selectedNpcId.value })),
    pause: computed(() => !selectedNpcId.value),
});

watch(npcProfileData, (data) => {
    if (data?.npc) {
        selectedNpc.value = data.npc;
    }
});

function openNpcModal(id: string): void {
    selectedNpcId.value = id;
    npcModalOpen.value = true;
}

// ── Diary ─────────────────────────────────────────────────────────────────

const DIARY_RECENT_COUNT = 7;
const allDiaryEntries = ref<DiaryEntry[]>([]);
const diaryPageInfo = ref<{ hasNextPage: boolean; endCursor: string | null } | null>(null);
const showOlderDiary = ref(false);
const diaryLoadingMore = ref(false);
const diarySearch = ref('');
const diaryAfter = ref<string | null>(null);
const diaryAppending = ref(false);

const { data: diaryData, fetching: diaryFetching, executeQuery: refetchDiary } = useQuery({
    query: DIARY_ENTRIES_QUERY,
    variables: computed(() => ({
        campaignId: campaignId.value,
        first: 20,
        after: diaryAfter.value,
    })),
});

watch(diaryData, (data) => {
    if (!data) return;
    const edges = data.diaryEntries?.edges ?? [];
    const entries = edges.map((edge) => edge.node);
    allDiaryEntries.value = diaryAppending.value
        ? [...allDiaryEntries.value, ...entries]
        : entries;
    diaryPageInfo.value = data.diaryEntries?.pageInfo ?? null;
    diaryAppending.value = false;
}, { immediate: true });

const filteredDiaryEntries = computed(() => {
    const q = diarySearch.value.trim().toLowerCase();
    if (!q) return allDiaryEntries.value;
    return allDiaryEntries.value.filter(
        (e) => e.content.toLowerCase().includes(q) || e.inGameDate.toLowerCase().includes(q),
    );
});

const recentDiary = computed(() => allDiaryEntries.value.slice(0, DIARY_RECENT_COUNT));
const filteredRecentDiary = computed(() => filteredDiaryEntries.value.slice(0, DIARY_RECENT_COUNT));
const filteredOlderDiary = computed(() => filteredDiaryEntries.value.slice(DIARY_RECENT_COUNT));

async function loadMoreDiary(): Promise<void> {
    if (!diaryPageInfo.value?.endCursor || diaryLoadingMore.value) return;
    diaryLoadingMore.value = true;
    diaryAppending.value = true;
    diaryAfter.value = diaryPageInfo.value.endCursor;

    try {
        await refetchDiary({ requestPolicy: 'network-only' });
    } finally {
        diaryLoadingMore.value = false;
    }
}

// ── World Events ──────────────────────────────────────────────────────────

const { data: eventsData, fetching: eventsFetching } = useQuery({
    query: WORLD_EVENTS_QUERY,
    variables: computed(() => ({
        campaignId: campaignId.value,
        status: 'ACTIVE',
        first: 50,
    })),
});

const worldEvents = computed(() =>
    (eventsData.value?.worldEvents?.edges ?? []).map((edge) => edge.node),
);

// ── Helpers ───────────────────────────────────────────────────────────────

function dispositionColor(disposition: string): 'success' | 'warning' | 'error' | 'neutral' {
    const lower = disposition.toLowerCase();
    if (['friendly', 'ally', 'companion', 'warm'].some((w) => lower.includes(w))) return 'success';
    if (['hostile', 'enemy', 'wary', 'bitter'].some((w) => lower.includes(w))) return 'error';
    if (['neutral'].some((w) => lower.includes(w))) return 'neutral';
    return 'warning';
}
</script>
