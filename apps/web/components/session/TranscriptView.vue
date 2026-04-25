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
                <div class="max-w-[85%] bg-gray-800 text-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm prose"
                    v-html="parseMarkdown((event.content as { narrative?: string }).narrative ?? '')" />
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

        <div v-if="props.innerVoiceText"
            class="flex justify-start">
            <div class="max-w-[85%] px-4 py-2 text-sm italic leading-relaxed whitespace-pre-wrap text-gray-400">
                {{ props.innerVoiceText }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { type ResultOf } from 'gql.tada';

import { parseMarkdown } from '~/composables/useMarkdown';
import { type GAME_EVENTS_QUERY } from '~/graphql/session';

type GameEvent = Omit<ResultOf<typeof GAME_EVENTS_QUERY>['gameEvents'][number], 'content'> & {
    content: Record<string, unknown>
};

type Props = {
    events: GameEvent[]
    inProgressText?: string
    innerVoiceText?: string
};

const props = withDefaults(defineProps<Props>(), {
    inProgressText: undefined,
    innerVoiceText: undefined,
});
</script>
