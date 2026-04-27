<template>
    <div class="min-h-screen grimoire-bg p-6">
        <!-- Navigation -->
        <div class="max-w-3xl mx-auto mb-8 relative z-10 grimoire-page-enter">
            <div class="flex items-center gap-4">
                <nuxt-link
                    :to="`/campaign/${campaignId}/play`"
                    class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted hover:text-grimoire-text transition-colors"
                >
                    ← Play
                </nuxt-link>

                <div class="flex gap-5 ml-auto">
                    <nuxt-link
                        :to="`/campaign/${campaignId}/quests`"
                        class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-accent"
                    >
                        Quests
                    </nuxt-link>

                    <nuxt-link
                        :to="`/campaign/${campaignId}/character`"
                        class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted hover:text-grimoire-text transition-colors"
                    >
                        Character
                    </nuxt-link>

                    <nuxt-link
                        :to="`/campaign/${campaignId}/world`"
                        class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted hover:text-grimoire-text transition-colors"
                    >
                        World
                    </nuxt-link>
                </div>
            </div>
        </div>

        <div class="max-w-3xl mx-auto relative z-10">
            <!-- Loading -->
            <div v-if="activeFetching"
                class="flex flex-col items-center gap-4 py-12 text-grimoire-muted">
                <span class="w-3 h-3 rounded-full bg-grimoire-accent grimoire-breathe" />

                <p class="font-['IM_Fell_English',serif] italic text-lg">Consulting the scroll...</p>
            </div>

            <template v-else>
                <!-- Active Quests -->
                <section class="mb-10">
                    <h2 class="font-['Cinzel',serif] text-xs tracking-[0.4em] uppercase text-grimoire-muted mb-6">
                        Active Quests
                    </h2>

                    <div v-if="activeQuests.length === 0"
                        class="font-['IM_Fell_English',serif] italic text-grimoire-muted py-10">
                        No quests yet. The road ahead is unwritten.
                    </div>

                    <div v-else
                        class="space-y-4">
                        <div v-for="quest in activeQuests"
                            :key="quest.id"
                            class="bg-grimoire-surface border border-grimoire-accent-dim/20 rounded-sm p-5 space-y-3">
                            <div class="flex items-start justify-between gap-3">
                                <h3 class="font-['IM_Fell_English',serif] text-base text-grimoire-text">
                                    {{ quest.title }}
                                </h3>

                                <span class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-accent border border-grimoire-accent-dim/50 px-2 py-0.5 rounded-sm flex-shrink-0">
                                    Active
                                </span>
                            </div>

                            <p class="font-['IM_Fell_English',serif] text-sm leading-relaxed text-grimoire-text/80">
                                {{ quest.description }}
                            </p>

                            <!-- Objectives -->
                            <div v-if="quest.objectives.length"
                                class="space-y-1.5 pt-1">
                                <div
                                    v-for="objective in [...quest.objectives].sort((a, b) => a.order - b.order)"
                                    :key="objective.id"
                                    class="flex items-start gap-2 text-sm"
                                >
                                    <span
                                        class="flex-shrink-0 mt-0.5"
                                        :class="objective.status === 'COMPLETE' ? 'text-grimoire-accent' : 'text-grimoire-muted'"
                                    >{{ objective.status === 'COMPLETE' ? '✦' : '◦' }}</span>

                                    <span :class="objective.status === 'COMPLETE' ? 'text-grimoire-muted/60 font-[\'IM_Fell_English\',serif] text-sm' : 'text-grimoire-text/80 font-[\'IM_Fell_English\',serif] text-sm'">
                                        {{ objective.description }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Completed / Failed Quests -->
                <section v-if="!completedFetching && finishedQuests.length">
                    <button
                        class="flex items-center gap-3 text-grimoire-muted hover:text-grimoire-text transition-colors mb-5"
                        type="button"
                        @click="showCompleted = !showCompleted"
                    >
                        <span class="font-['Cinzel',serif] text-xs tracking-widest uppercase">
                            Completed ({{ finishedQuests.length }})
                        </span>

                        <u-icon :name="showCompleted ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                            class="text-xs" />
                    </button>

                    <div v-if="showCompleted"
                        class="space-y-4">
                        <div v-for="quest in finishedQuests"
                            :key="quest.id"
                            class="bg-grimoire-surface border border-grimoire-accent-dim/10 rounded-sm p-5 space-y-3">
                            <div class="flex items-start justify-between gap-3">
                                <h3 class="font-['IM_Fell_English',serif] text-base text-grimoire-muted">
                                    {{ quest.title }}
                                </h3>

                                <span
                                    class="font-['Cinzel',serif] text-xs tracking-widest uppercase px-2 py-0.5 rounded-sm flex-shrink-0 border"
                                    :class="quest.status === 'COMPLETED'
                                        ? 'text-green-600 border-green-800/50'
                                        : 'text-red-600 border-red-800/50'"
                                >
                                    {{ quest.status === 'COMPLETED' ? 'Completed' : 'Failed' }}
                                </span>
                            </div>

                            <p class="font-['IM_Fell_English',serif] text-sm leading-relaxed text-grimoire-muted">
                                {{ quest.description }}
                            </p>

                            <!-- Objectives -->
                            <div v-if="quest.objectives.length"
                                class="space-y-1.5 pt-1">
                                <div
                                    v-for="objective in [...quest.objectives].sort((a, b) => a.order - b.order)"
                                    :key="objective.id"
                                    class="flex items-start gap-2 text-sm"
                                >
                                    <span class="flex-shrink-0 text-grimoire-muted/50 mt-0.5">
                                        {{ objective.status === 'COMPLETE' ? '✦' : '◦' }}
                                    </span>

                                    <span class="font-['IM_Fell_English',serif] text-sm text-grimoire-muted/70">
                                        {{ objective.description }}
                                    </span>
                                </div>
                            </div>

                            <!-- Rewards -->
                            <div
                                v-if="quest.status === 'COMPLETED' && (quest.rewardNarrative || quest.rewardXp || quest.rewardGold)"
                                class="pt-2 border-t border-grimoire-accent-dim/20 space-y-1"
                            >
                                <p class="font-['Cinzel',serif] text-xs uppercase tracking-widest text-grimoire-muted">
                                    Rewards
                                </p>

                                <p v-if="quest.rewardNarrative"
                                    class="font-['IM_Fell_English',serif] italic text-sm text-grimoire-accent/70">
                                    {{ quest.rewardNarrative }}
                                </p>

                                <div class="flex gap-4 font-mono text-sm text-grimoire-muted">
                                    <span v-if="quest.rewardXp">{{ quest.rewardXp }} XP</span>

                                    <span v-if="quest.rewardGold">{{ quest.rewardGold }} gp</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ResultOf } from 'gql.tada';

import { useQuery } from '@urql/vue';

import { QUESTS_QUERY } from '~/graphql/quests';

definePageMeta({});

const route = useRoute();
const campaignId = computed(() => route.params.id as string);

type Quest = ResultOf<typeof QUESTS_QUERY>['quests']['edges'][number]['node'];

const { data: activeData, fetching: activeFetching } = useQuery({
    query: QUESTS_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value, status: 'ACTIVE', first: 50 })),
});

const { data: completedData, fetching: completedFetching } = useQuery({
    query: QUESTS_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value, first: 50 })),
});

const activeQuests = computed(() =>
    (activeData.value?.quests?.edges ?? []).map((edge) => edge.node),
);

const finishedQuests = computed<Quest[]>(() =>
    (completedData.value?.quests?.edges ?? [])
        .map((edge) => edge.node)
        .filter((quest) => quest.status === 'COMPLETED' || quest.status === 'FAILED'),
);

const showCompleted = ref(false);
</script>
