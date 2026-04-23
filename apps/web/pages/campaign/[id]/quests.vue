<template>
    <div class="min-h-screen bg-gray-950 p-6">
        <!-- Header with navigation -->
        <div class="max-w-3xl mx-auto">
            <div class="flex items-center gap-4 mb-6">
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
                        :to="`/campaign/${campaignId}/character`"
                        class="text-gray-400 hover:text-white transition-colors text-sm"
                    >
                        Character
                    </nuxt-link>

                    <nuxt-link
                        :to="`/campaign/${campaignId}/quests`"
                        class="text-primary-400 font-medium text-sm"
                    >
                        Quests
                    </nuxt-link>
                </div>
            </div>

            <h1 class="text-2xl font-bold text-white mb-6">
                Quests
            </h1>

            <!-- Loading -->
            <div v-if="activeFetching"
                class="flex justify-center py-12">
                <u-icon name="i-lucide-loader-circle"
                    class="animate-spin text-3xl text-gray-400" />
            </div>

            <template v-else>
                <!-- Active Quests -->
                <section class="mb-8">
                    <h2 class="text-lg font-semibold text-gray-200 mb-3">
                        Active Quests
                    </h2>

                    <div v-if="activeQuests.length === 0"
                        class="text-center py-10 text-gray-500 border border-dashed border-gray-700 rounded-lg">
                        No active quests. The DM will assign quests as your adventure unfolds.
                    </div>

                    <div v-else
                        class="space-y-4">
                        <u-card v-for="quest in activeQuests"
                            :key="quest.id"
                            class="bg-gray-900 border-gray-700">
                            <div class="space-y-3">
                                <div class="flex items-start justify-between gap-3">
                                    <h3 class="text-white font-semibold text-base">
                                        {{ quest.title }}
                                    </h3>

                                    <u-badge color="primary"
                                        variant="soft"
                                        size="sm">
                                        Active
                                    </u-badge>
                                </div>

                                <p class="text-gray-400 text-sm leading-relaxed">
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
                                        <u-icon
                                            :name="objective.status === 'COMPLETE' ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                                            :class="objective.status === 'COMPLETE' ? 'text-green-400 mt-0.5' : 'text-gray-600 mt-0.5'"
                                        />

                                        <span :class="objective.status === 'COMPLETE' ? 'text-gray-400 line-through' : 'text-gray-300'">
                                            {{ objective.description }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </u-card>
                    </div>
                </section>

                <!-- Completed / Failed Quests -->
                <section v-if="!completedFetching && finishedQuests.length">
                    <button
                        class="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors mb-3 text-sm font-medium"
                        type="button"
                        @click="showCompleted = !showCompleted"
                    >
                        <u-icon :name="showCompleted ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" />
                        Completed ({{ finishedQuests.length }})
                    </button>

                    <div v-if="showCompleted"
                        class="space-y-4">
                        <u-card v-for="quest in finishedQuests"
                            :key="quest.id"
                            class="bg-gray-900 border-gray-700 opacity-75">
                            <div class="space-y-3">
                                <div class="flex items-start justify-between gap-3">
                                    <h3 class="text-gray-300 font-semibold text-base">
                                        {{ quest.title }}
                                    </h3>

                                    <u-badge
                                        :color="quest.status === 'COMPLETED' ? 'success' : 'error'"
                                        variant="soft"
                                        size="sm">
                                        {{ quest.status === 'COMPLETED' ? 'Completed' : 'Failed' }}
                                    </u-badge>
                                </div>

                                <p class="text-gray-500 text-sm leading-relaxed">
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
                                        <u-icon
                                            :name="objective.status === 'COMPLETE' ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
                                            :class="objective.status === 'COMPLETE' ? 'text-green-600 mt-0.5' : 'text-gray-700 mt-0.5'"
                                        />

                                        <span class="text-gray-500">
                                            {{ objective.description }}
                                        </span>
                                    </div>
                                </div>

                                <!-- Rewards (only on completed quests) -->
                                <div
                                    v-if="quest.status === 'COMPLETED' && (quest.rewardNarrative || quest.rewardXp || quest.rewardGold)"
                                    class="pt-2 border-t border-gray-700 space-y-1"
                                >
                                    <p class="text-xs text-gray-400 uppercase tracking-wider font-medium">
                                        Rewards
                                    </p>

                                    <p v-if="quest.rewardNarrative"
                                        class="text-sm text-amber-300/80">
                                        {{ quest.rewardNarrative }}
                                    </p>

                                    <div class="flex gap-4 text-sm text-gray-400">
                                        <span v-if="quest.rewardXp">{{ quest.rewardXp }} XP</span>

                                        <span v-if="quest.rewardGold">{{ quest.rewardGold }} gp</span>
                                    </div>
                                </div>
                            </div>
                        </u-card>
                    </div>
                </section>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useQuery } from '@urql/vue';

import { QUESTS_QUERY } from '~/graphql/quests';

definePageMeta({ middleware: 'require-auth' });

const route = useRoute();
const campaignId = computed(() => route.params.id as string);

interface QuestObjective {
    id: string
    description: string
    type: string
    status: 'INCOMPLETE' | 'COMPLETE'
    order: number
}

interface Quest {
    id: string
    title: string
    description: string
    status: 'ACTIVE' | 'COMPLETED' | 'FAILED'
    rewardNarrative: string | null
    rewardXp: number | null
    rewardGold: number | null
    objectives: QuestObjective[]
}

const { data: activeData, fetching: activeFetching } = useQuery({
    query: QUESTS_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value, status: 'ACTIVE', first: 50 })),
});

const { data: completedData, fetching: completedFetching } = useQuery({
    query: QUESTS_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value, first: 50 })),
});

const activeQuests = computed<Quest[]>(() =>
    (activeData.value?.quests?.edges ?? []).map((e: { node: Quest }) => e.node),
);

const finishedQuests = computed<Quest[]>(() =>
    (completedData.value?.quests?.edges ?? [])
        .map((e: { node: Quest }) => e.node)
        .filter((q: Quest) => q.status === 'COMPLETED' || q.status === 'FAILED'),
);

const showCompleted = ref(false);
</script>
