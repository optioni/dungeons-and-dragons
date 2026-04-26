<template>
    <div
        class="border-l-2 border-grimoire-accent-dim/40 pl-5 py-1 my-3"
        :class="{ 'grimoire-entry': mounted }"
        data-testid="mechanical-event-annotation"
    >
        <p class="font-['Cinzel',serif] text-xs uppercase tracking-widest text-grimoire-muted">
            {{ label }}
        </p>

        <p class="font-['IM_Fell_English',serif] text-base leading-snug text-grimoire-muted/80">
            {{ content.title }}
            <span v-if="content.summary"
                class="text-grimoire-muted/70">
                · {{ content.summary }}
            </span>
        </p>

        <dl v-if="valueEntries.length"
            class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-grimoire-muted/70">
            <div
                v-for="[key, value] in valueEntries"
                :key="key"
                class="flex gap-1.5"
            >
                <dt class="font-['Cinzel',serif] uppercase tracking-widest">{{ formatKey(key) }}</dt>
                <dd :class="typeof value === 'number' ? 'font-mono text-grimoire-text/80' : ''">
                    {{ formatValue(value) }}
                </dd>
            </div>
        </dl>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { type PlayerVisibleEventPayload, type PlayerVisibleEventValue } from '~/types/player-visible-event';

const props = defineProps<{
    content: PlayerVisibleEventPayload
}>();

const mounted = ref(false);
onMounted(() => { mounted.value = true; });

const label = computed(() => `${props.content.category} ${props.content.kind.replaceAll('_', ' ')}`);

const valueEntries = computed(() =>
    Object.entries(props.content.values ?? {}).filter(([, value]) =>
        ['string', 'number', 'boolean'].includes(typeof value),
    ),
);

function formatKey(key: string): string {
    return key.replaceAll(/([A-Z])/g, ' $1').replaceAll('_', ' ').trim();
}

function formatValue(value: PlayerVisibleEventValue): string {
    if (typeof value === 'boolean') {
        return value ? 'yes' : 'no';
    }

    return String(value);
}
</script>
