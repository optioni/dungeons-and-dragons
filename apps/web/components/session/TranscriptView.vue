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

            <!-- Dice roll card -->
            <session-dice-roll-card
                v-else-if="event.eventType === 'DICE_ROLL'"
                :content="event.content as { tool: 'check_skill' | 'check_ability' | 'roll_dice'; skill?: string; ability?: string; roll?: number; modifier?: number; total?: number; dc?: number; passed?: boolean; expression?: string; rolls?: number[] }"
            />

            <!-- Curated mechanical milestone annotation -->
            <session-mechanical-event-annotation
                v-else-if="event.eventType === 'PLAYER_VISIBLE_EVENT' && isTranscriptVisibleMechanicalEvent(event.content)"
                :content="event.content"
            />

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
            class="inner-monologue my-4 pl-4 py-2 border-l-2 border-grimoire-accent-dim/40 bg-grimoire-surface/40 rounded-r">
            <div
                class="prose prose-grimoire text-lg italic text-grimoire-muted leading-relaxed font-['IM_Fell_English',serif]"
                v-html="parseMarkdown(props.innerVoiceText ?? '')"
            />
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
import { computed, onMounted, ref } from 'vue';

import { parseMarkdown } from '~/composables/useMarkdown';
import { type GAME_EVENTS_QUERY } from '~/graphql/session';
import { isTranscriptVisibleMechanicalEvent } from '~/types/player-visible-event';

type GameEventNode = ResultOf<typeof GAME_EVENTS_QUERY>['gameEvents']['edges'][number]['node'];
type GameEvent = Omit<GameEventNode, 'content'> & {
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
