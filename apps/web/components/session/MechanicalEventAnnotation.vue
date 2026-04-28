<template>
    <div
        class="relative flex items-center pl-8 my-2 min-h-11"
        :class="{ 'grimoire-entry': mounted }"
        data-testid="mechanical-event-annotation"
    >
        <div class="absolute left-0 top-0 bottom-0 w-6 flex justify-center text-grimoire-accent-dim/50">
            <session-message-border-glyph type="event"
                class="flex-none" />
        </div>

        <p class="font-['IM_Fell_English',serif] text-base italic text-grimoire-muted/70 leading-snug">
            {{ narrativeLine }}
        </p>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { type PlayerVisibleEventPayload } from '~/types/player-visible-event';

const props = defineProps<{
    content: PlayerVisibleEventPayload
}>();

const mounted = ref(false);
onMounted(() => { mounted.value = true; });

function article(name: string): string {
    return /^[aeiou]/i.test(name) ? 'an' : 'a';
}

const GENERIC_PLACEHOLDERS = new Set(['Item', 'Location', 'Quest', 'Objective', 'Character', 'Combatant', 'Dungeon', 'Room']);

const narrativeLine = computed((): string => {
    const {
        category, kind, title, summary, entities, values, 
    } = props.content;
    const rawName = entities?.[0]?.name;
    const primaryName = rawName && !GENERIC_PLACEHOLDERS.has(rawName) ? rawName : undefined;
    const quantity = typeof values?.quantity === 'number' ? values.quantity : 1;

    if (category === 'INVENTORY') {
        if (kind === 'ITEM_GAINED') {
            if (!primaryName) return quantity > 1 ? `You received ${quantity} items.` : 'You received an item.';
            return quantity > 1
                ? `You received ${quantity} ${primaryName}.`
                : `You received ${article(primaryName)} ${primaryName}.`;
        }
        if (kind === 'ITEM_LOST' || kind === 'ITEM_REMOVED' || kind === 'ITEM_USED') {
            const verb = kind === 'ITEM_USED' ? 'used' : 'lost';
            if (!primaryName) return quantity > 1 ? `You ${verb} ${quantity} items.` : `You ${verb} an item.`;
            return quantity > 1
                ? `You ${verb} ${quantity} ${primaryName}.`
                : `You ${verb} ${article(primaryName)} ${primaryName}.`;
        }
    }

    if (category === 'QUEST') {
        const name = primaryName ?? title;
        if (kind === 'QUEST_STARTED') return `New quest: ${name}.`;
        if (kind === 'QUEST_COMPLETED') return `Quest completed — ${name}.`;
        if (kind === 'OBJECTIVE_COMPLETED') return `${name} — objective complete.`;
    }

    if (category === 'DISCOVERY') {
        const name = primaryName ?? title;
        return `You discovered ${name}.`;
    }

    if (category === 'TRAVEL') {
        const name = primaryName ?? title;
        if (/ENTER/i.test(kind)) return `You entered ${name}.`;
        if (/LEAVE|EXIT|LEFT/i.test(kind)) return `You left ${name}.`;
    }

    if (category === 'RESOURCE') {
        const amount = typeof values?.amount === 'number' ? Math.abs(values.amount) : null;
        const isLoss = typeof values?.amount === 'number' && values.amount < 0;
        if (kind === 'HP_CHANGED' && amount !== null) {
            return isLoss
                ? `You took ${amount} damage.`
                : `You recovered ${amount} hit points.`;
        }
        if (kind === 'SPELL_SLOT_USED') {
            const level = values?.level ?? '';
            return `You expended ${level ? `a level ${level}` : 'a'} spell slot.`;
        }
    }

    return summary ? `${title} — ${summary}` : title;
});
</script>
