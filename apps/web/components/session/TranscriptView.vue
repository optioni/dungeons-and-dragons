<template>
    <div class="space-y-4">
        <template v-for="event in props.events"
            :key="event.id">
            <!-- Player input bubble -->
            <div v-if="event.eventType === 'PLAYER_INPUT'"
                class="flex justify-end">
                <div class="max-w-[75%] bg-primary-700 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
                    {{ (event.content as { text?: string }).text ?? '' }}
                </div>
            </div>

            <!-- DM narrative message -->
            <div v-else-if="event.eventType === 'DM_NARRATIVE'"
                class="flex justify-start">
                <div class="max-w-[85%] bg-gray-800 text-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                    {{ (event.content as { narrative?: string }).narrative ?? '' }}
                </div>
            </div>
        </template>

        <!-- In-progress DM message (optimistic, while streaming) -->
        <div v-if="props.inProgressText"
            class="flex justify-start">
            <div class="max-w-[85%] bg-gray-800 text-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap relative">
                {{ props.inProgressText }}
                <span class="inline-block w-1.5 h-4 bg-primary-400 animate-pulse ml-0.5 align-middle" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
interface GameEvent {
    id: string
    eventType: 'PLAYER_INPUT' | 'DM_NARRATIVE' | 'TOOL_CALL' | 'SYSTEM'
    content: Record<string, unknown>
    createdAt: string
}

interface Props {
    events: GameEvent[]
    inProgressText?: string
}

const props = withDefaults(defineProps<Props>(), {
    inProgressText: undefined,
});
</script>
