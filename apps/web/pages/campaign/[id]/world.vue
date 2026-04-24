<template>
    <div class="min-h-screen bg-gray-950 p-6">
        <!-- Navigation -->
        <div class="max-w-5xl mx-auto mb-6">
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

        <div class="max-w-5xl mx-auto space-y-6">
            <h1 class="text-3xl font-bold text-white">World Overview</h1>

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
                    <div
                        v-for="entry in recentDiary"
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
                    <template v-if="olderDiary.length || diaryPageInfo?.hasNextPage">
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
                                v-for="entry in olderDiary"
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
    </div>
</template>

<script setup lang="ts">
import { useQuery } from '@urql/vue';
import {
    FACTIONS_QUERY,
    NPCS_QUERY,
    NPC_PROFILE_QUERY,
    DIARY_ENTRIES_QUERY,
    WORLD_EVENTS_QUERY,
} from '~/graphql/world';

const route = useRoute();
const campaignId = computed(() => route.params.id as string);

// ── Factions ──────────────────────────────────────────────────────────────

const { data: factionsData, fetching: factionsFetching } = useQuery({
    query: FACTIONS_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value, first: 50 })),
});

const factions = computed(() =>
    (factionsData.value?.factions?.edges ?? []).map((e: { node: unknown }) => e.node),
);

// ── NPCs ──────────────────────────────────────────────────────────────────

interface NpcRosterItem {
    id: string
    name: string
    profession: string | null
    disposition: string | null
    currentLocationId: string | null
    partyStatus: string
    alive: boolean
}

interface NpcRelationship {
    id: string
    targetNpcId: string
    type: string
    description: string | null
    disposition: string | null
}

interface NpcProfile extends NpcRosterItem {
    description: string | null
    coreMotivation: string | null
    speechStyle: string | null
    relationships: NpcRelationship[] | null
}

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
    allNpcs.value = edges.map((e: { node: NpcRosterItem }) => e.node);
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
        selectedNpc.value = data.npc as NpcProfile;
    }
});

function openNpcModal(id: string): void {
    selectedNpcId.value = id;
    npcModalOpen.value = true;
}

// ── Diary ─────────────────────────────────────────────────────────────────

interface DiaryEntry {
    id: string
    campaignId: string
    entryType: string
    inGameDate: string
    content: string
    createdAt: string
}

const DIARY_RECENT_COUNT = 7;
const allDiaryEntries = ref<DiaryEntry[]>([]);
const diaryPageInfo = ref<{ hasNextPage: boolean; endCursor: string | null } | null>(null);
const showOlderDiary = ref(false);
const diaryLoadingMore = ref(false);

const { data: diaryData, fetching: diaryFetching } = useQuery({
    query: DIARY_ENTRIES_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value, first: 20 })),
});

watch(diaryData, (data) => {
    if (!data) return;
    const edges = data.diaryEntries?.edges ?? [];
    allDiaryEntries.value = edges.map((e: { node: DiaryEntry }) => e.node);
    diaryPageInfo.value = data.diaryEntries?.pageInfo ?? null;
});

const recentDiary = computed(() => allDiaryEntries.value.slice(0, DIARY_RECENT_COUNT));
const olderDiary = computed(() => allDiaryEntries.value.slice(DIARY_RECENT_COUNT));

async function loadMoreDiary(): Promise<void> {
    if (!diaryPageInfo.value?.endCursor || diaryLoadingMore.value) return;
    diaryLoadingMore.value = true;
    // Re-query with next cursor
    diaryLoadingMore.value = false;
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
    (eventsData.value?.worldEvents?.edges ?? []).map((e: { node: unknown }) => e.node),
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
