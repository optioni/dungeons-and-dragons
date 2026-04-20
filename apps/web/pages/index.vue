<template>
    <div class="min-h-screen bg-gray-950 p-6">
        <div class="max-w-4xl mx-auto space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-white">Campaigns</h1>

                    <p class="text-gray-400 mt-1">Your D&amp;D adventures</p>
                </div>

                <u-button
                    icon="i-lucide-plus"
                    @click="showCreateModal = true"
                >
                    New Campaign
                </u-button>
            </div>

            <!-- Loading state -->
            <div v-if="fetching"
                class="flex justify-center py-20">
                <u-icon name="i-lucide-loader-circle"
                    class="animate-spin text-3xl text-gray-400" />
            </div>

            <!-- Error state -->
            <u-alert v-else-if="error"
                color="error"
                variant="soft"
                description="Failed to load campaigns." />

            <!-- Empty state -->
            <div v-else-if="campaigns.length === 0"
                class="text-center py-20 space-y-4">
                <u-icon name="i-lucide-map"
                    class="text-6xl text-gray-700 mx-auto block" />

                <p class="text-gray-400">No campaigns yet. Start your first adventure!</p>

                <u-button
                    icon="i-lucide-plus"
                    @click="showCreateModal = true"
                >
                    Create Campaign
                </u-button>
            </div>

            <!-- Campaign cards -->
            <div v-else
                class="grid gap-4 sm:grid-cols-2">
                <u-card
                    v-for="campaign in campaigns"
                    :key="campaign.id as string"
                    :class="campaign.status === 'ENDED' ? 'opacity-70' : 'hover:ring-1 hover:ring-primary-500 transition-all cursor-pointer'"
                >
                    <div class="flex items-start justify-between gap-4">
                        <div class="flex-1 min-w-0">
                            <h2 class="text-lg font-semibold text-white truncate">
                                {{ campaign.name }}
                            </h2>

                            <div class="flex items-center gap-2 mt-1">
                                <!-- Memorial badge for ended campaigns -->
                                <u-badge
                                    v-if="campaign.status === 'ENDED'"
                                    color="neutral"
                                    variant="soft"
                                    size="sm"
                                    icon="i-lucide-skull"
                                >
                                    Ended
                                </u-badge>

                                <u-badge
                                    v-else
                                    :color="statusColor(campaign.setupStatus as string)"
                                    variant="soft"
                                    size="sm"
                                >
                                    {{ statusLabel(campaign.setupStatus as string) }}
                                </u-badge>
                            </div>

                            <p v-if="campaign.inGameDate"
                                class="text-xs text-gray-500 mt-2 truncate">
                                {{ campaign.inGameDate }}
                            </p>
                        </div>

                        <div
                            v-if="campaign.status !== 'ENDED'"
                            class="flex-shrink-0"
                        >
                            <u-button
                                v-if="campaign.setupStatus !== 'READY_TO_PLAY'"
                                size="sm"
                                variant="ghost"
                                icon="i-lucide-settings"
                                @click="resumeSetup(campaign.id as string)"
                            >
                                Continue Setup
                            </u-button>

                            <u-button
                                v-else
                                size="sm"
                                icon="i-lucide-play"
                                @click="playCampaign(campaign.id as string)"
                            >
                                Play
                            </u-button>
                        </div>
                    </div>
                </u-card>
            </div>
        </div>

        <!-- Create campaign modal -->
        <u-modal v-model:open="showCreateModal"
            title="New Campaign">
            <template #body>
                <u-form
                    class="space-y-4"
                    @submit.prevent="submitCreate">
                    <u-form-field label="Campaign name"
                        name="name">
                        <u-input
                            v-model="newCampaignName"
                            placeholder="The Shadow of Valdris..."
                            autofocus
                            @input="createError = ''"
                        />
                    </u-form-field>

                    <u-alert v-if="createError"
                        color="error"
                        variant="soft"
                        :description="createError" />

                    <div class="flex gap-3 justify-end">
                        <u-button
                            variant="ghost"
                            @click="showCreateModal = false">
                            Cancel
                        </u-button>

                        <u-button
                            type="submit"
                            :disabled="!newCampaignName.trim()"
                            :loading="creating"
                        >
                            Create
                        </u-button>
                    </div>
                </u-form>
            </template>
        </u-modal>
    </div>
</template>

<script setup lang="ts">
import { useQuery, useMutation } from '@urql/vue';

const router = useRouter();

// ── Queries ────────────────────────────────────────────────────────────────────
const CAMPAIGNS_QUERY = `
  query Campaigns {
    campaigns(first: 50) {
      edges {
        node {
          id
          name
          setupStatus
          status
          inGameDate
          createdAt
        }
      }
    }
  }
`;

const { data, fetching, error, executeQuery } = useQuery({ query: CAMPAIGNS_QUERY });

const campaigns = computed(() =>
    data.value?.campaigns?.edges?.map((e: { node: Record<string, unknown> }) => e.node) ?? [],
);

// ── Create campaign ────────────────────────────────────────────────────────────
const CREATE_CAMPAIGN_MUTATION = `
  mutation CreateCampaign($input: CreateCampaignInput!) {
    createCampaign(input: $input) {
      id
    }
  }
`;

const showCreateModal = ref(false);
const newCampaignName = ref('');
const createError = ref('');
const creating = ref(false);
const { executeMutation: executeCreate } = useMutation(CREATE_CAMPAIGN_MUTATION);

async function submitCreate(): Promise<void> {
    if (!newCampaignName.value.trim()) return;

    creating.value = true;
    createError.value = '';

    try {
        const result = await executeCreate({ input: { name: newCampaignName.value.trim() } });

        if (result.error) {
            createError.value = result.error.graphQLErrors[0]?.message ?? 'Failed to create campaign';
            return;
        }

        showCreateModal.value = false;
        newCampaignName.value = '';
        const newId = result.data?.createCampaign?.id as string;

        // Navigate straight to setup
        await router.push(`/campaign/${newId}/setup`);
    } finally {
        creating.value = false;
    }
}

// ── Navigation ─────────────────────────────────────────────────────────────────
function resumeSetup(id: string): void {
    void router.push(`/campaign/${id}/setup`);
}

function playCampaign(id: string): void {
    // TODO: navigate to campaign gameplay route once SessionModule exists
    void router.push(`/campaign/${id}/setup`);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function statusLabel(status: string): string {
    switch (status) {
        case 'DRAFT': return 'Draft';
        case 'CONCEPTS_GENERATED': return 'Concept selected';
        case 'READY_TO_PLAY': return 'Ready to play';
        default: return status;
    }
}

function statusColor(status: string): 'neutral' | 'warning' | 'success' {
    switch (status) {
        case 'READY_TO_PLAY': return 'success';
        case 'CONCEPTS_GENERATED': return 'warning';
        default: return 'neutral';
    }
}

// Refresh list when the modal closes without creating (user navigated back)
watch(showCreateModal, (open) => {
    if (!open) void executeQuery({ requestPolicy: 'network-only' });
});
</script>
