<template>
    <div class="space-y-0">
        <template v-for="(event, eventIndex) in props.events" :key="event.id">
            <!-- Ornamental divider: before a DM narrative that follows a player input -->
            <session-ornamental-divider
                v-if="event.eventType === 'DM_NARRATIVE' && eventIndex > 0
                    && props.events[eventIndex - 1]?.eventType === 'PLAYER_INPUT'"
            />

            <!-- DM narrative block -->
            <div
                v-if="event.eventType === 'DM_NARRATIVE'"
                class="border-l-2 border-grimoire-accent-dim pl-5 py-0.5 my-5"
                :class="{
                    'first-dm-narrative': firstDmEventId === event.id,
                    'grimoire-entry': mounted,
                }"
            >
                <div
                    class="prose prose-grimoire font-['IM_Fell_English',serif] text-[1.125rem] leading-relaxed text-grimoire-text"
                    v-html="parseMarkdown((event.content as { narrative?: string }).narrative ?? '')"
                />
            </div>

            <!-- Player input annotation -->
            <p
                v-else-if="event.eventType === 'PLAYER_INPUT'"
                class="text-sm italic text-grimoire-muted ml-6 mb-5"
                :class="{ 'grimoire-entry': mounted }"
            >
                <span class="not-italic font-['Cinzel',serif] tracking-widest text-xs text-grimoire-accent-dim mr-2 uppercase">
                    {{ props.characterName ?? 'You' }}
                </span>
                {{ (event.content as { text?: string }).text ?? '' }}
            </p>
        </template>

        <!-- Inner monologue annotation -->
        <div v-if="props.innerVoiceText"
            class="ml-6 my-3 pl-3 border-l border-grimoire-surface">
            <p class="text-xs italic text-grimoire-muted/70 leading-relaxed">
                <span class="not-italic text-grimoire-accent-dim/50 mr-1">⟨</span>
                {{ props.innerVoiceText }}
                <span class="not-italic text-grimoire-accent-dim/50 ml-1">⟩</span>
            </p>
        </div>

        <!-- In-progress DM message (streaming) -->
        <div v-if="props.inProgressText"
            class="border-l-2 border-grimoire-accent-dim pl-5 py-0.5 my-5">
            <div
                class="prose prose-grimoire font-['IM_Fell_English',serif] text-[1.125rem] leading-relaxed text-grimoire-text whitespace-pre-wrap"
            >
                {{ props.inProgressText }}
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
    characterName?: string | null
};

const props = withDefaults(defineProps<Props>(), {
    inProgressText: undefined,
    innerVoiceText: undefined,
    characterName: null,
});

const mounted = ref(false);
onMounted(() => { mounted.value = true; });

const firstDmEventId = computed(() => {
    const first = props.events.find((e) => e.eventType === 'DM_NARRATIVE');
    return first?.id ?? null;
});
</script>
