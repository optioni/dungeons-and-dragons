<template>
    <div class="space-y-0">
        <template v-for="(event, eventIndex) in props.events"
            :key="event.id">
            <!-- Ornamental divider: before a DM narrative that follows a player input -->
            <session-ornamental-divider
                v-if="event.eventType === 'DM_NARRATIVE' && eventIndex > 0
                    && props.events[eventIndex - 1]?.eventType === 'PLAYER_INPUT'"
            />

            <!-- DM narrative block -->
            <div
                v-if="event.eventType === 'DM_NARRATIVE'"
                class="relative pl-7 py-0.5 my-5"
                :class="{
                    'first-dm-narrative': firstDmEventId === event.id,
                    'grimoire-entry': mounted,
                }"
            >
                <div class="absolute left-0 top-0 bottom-0 w-5 flex flex-col items-center text-grimoire-accent-dim">
                    <session-message-border-glyph type="dm" class="flex-none" />
                    <div class="flex-1 w-px bg-grimoire-accent-dim/50" />
                </div>

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
            <div
                v-else-if="event.eventType === 'PLAYER_INPUT'"
                class="relative mb-6 pl-7"
                :class="{ 'grimoire-entry': mounted }"
            >
                <div class="absolute left-0 top-0 bottom-0 w-5 flex flex-col items-center text-grimoire-accent-dim/70">
                    <session-message-border-glyph type="player" class="flex-none" />
                    <div class="flex-1 w-px bg-grimoire-accent-dim/30" />
                </div>

                <div class="mb-1">
                    <span class="font-['Cinzel',serif] tracking-widest text-xs text-grimoire-accent uppercase">
                        {{ props.characterName ?? 'You' }}
                    </span>
                </div>

                <p class="m-0 font-['IM_Fell_English',serif] text-lg italic leading-relaxed text-grimoire-text/75">
                    <span class="not-italic text-grimoire-accent-dim mr-0.5 select-none">&ldquo;</span>

                    {{ (event.content as { text?: string }).text ?? '' }}<span class="not-italic text-grimoire-accent-dim ml-0.5 select-none">&rdquo;</span>
                </p>
            </div>
        </template>

        <!-- Inner monologue annotation -->
        <div v-if="props.innerVoiceText"
            class="inner-monologue relative my-4 pl-7 py-2 bg-grimoire-surface/40 rounded-r">
            <div class="absolute left-0 top-1 bottom-0 w-5 flex flex-col items-center text-grimoire-accent-dim/60">
                <session-message-border-glyph type="inner-voice" class="flex-none" />
                <div class="flex-1 w-px bg-grimoire-accent-dim/20" />
            </div>

            <div
                class="prose prose-grimoire text-lg italic text-grimoire-muted leading-relaxed font-['IM_Fell_English',serif]"
                v-html="parseMarkdown(props.innerVoiceText ?? '')"
            />
        </div>

        <!-- In-progress DM message (streaming) -->
        <div v-if="props.inProgressText"
            class="relative pl-7 py-0.5 my-5">
            <div class="absolute left-0 top-0 bottom-0 w-5 flex flex-col items-center text-grimoire-accent-dim">
                <session-message-border-glyph type="dm" class="flex-none" />
                <div class="flex-1 w-px bg-grimoire-accent-dim/50" />
            </div>

            <div
                class="prose prose-grimoire font-['IM_Fell_English',serif] text-[1.125rem] leading-relaxed text-grimoire-text"
                v-html="parseMarkdown(props.inProgressText ?? '')"
            />
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
