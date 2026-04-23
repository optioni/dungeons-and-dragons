<template>
    <div class="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center p-8 z-50">
        <div class="max-w-2xl w-full text-center space-y-8">
            <!-- Memorial icon -->
            <div class="flex justify-center">
                <u-icon name="i-lucide-skull"
                    class="text-6xl text-gray-500" />
            </div>

            <!-- Title -->
            <div class="space-y-2">
                <h1 class="text-3xl font-bold text-white tracking-wide">Campaign Ended</h1>

                <p class="text-gray-500 text-sm uppercase tracking-widest">In memoriam</p>
            </div>

            <!-- Epitaph -->
            <div class="bg-gray-900 border border-gray-700 rounded-xl p-6">
                <p class="text-gray-300 text-lg leading-relaxed italic">{{ props.epitaph }}</p>
            </div>

            <!-- Stats -->
            <div class="flex justify-center gap-12">
                <div class="text-center">
                    <p class="text-3xl font-bold text-white">{{ props.daysPlayed }}</p>

                    <p class="text-xs text-gray-500 uppercase tracking-wider mt-1">Days Adventured</p>
                </div>

                <div class="w-px bg-gray-800" />

                <div class="text-center">
                    <p class="text-3xl font-bold text-white">{{ props.questsCompleted }}</p>

                    <p class="text-xs text-gray-500 uppercase tracking-wider mt-1">Quests Completed</p>
                </div>
            </div>

            <!-- Start new campaign -->
            <u-button
                size="lg"
                icon="i-lucide-plus"
                @click="startNewCampaign"
            >
                Start New Campaign
            </u-button>
        </div>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    epitaph: string
    daysPlayed: number
    questsCompleted: number
}>();

const router = useRouter();

function startNewCampaign(): void {
    void router.push('/');
}
</script>
