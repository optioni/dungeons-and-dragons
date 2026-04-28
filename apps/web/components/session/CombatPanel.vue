<template>
    <div class="w-72 shrink-0 flex flex-col bg-grimoire-combat border-r border-grimoire-accent-dim/20 overflow-y-auto grimoire-combat-panel">
        <!-- Header -->
        <div class="px-4 py-3 border-b border-grimoire-accent-dim/20 relative z-10">
            <div class="flex items-center justify-between">
                <h2 class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted">Combat</h2>

                <span class="font-mono text-xs text-grimoire-muted">Round {{ combatSession.roundNumber }}</span>
            </div>
        </div>

        <!-- Initiative order -->
        <div class="px-3 py-2 space-y-1 flex-1 relative z-10">
            <div
                v-for="(combatant, index) in combatSession.combatants"
                :key="combatant.id"
                class="rounded-sm p-2 transition-colors duration-300"
                :class="index === combatSession.currentTurnIndex
                    ? 'bg-grimoire-accent/10 ring-1 ring-grimoire-accent/40'
                    : 'bg-grimoire-surface/50'"
            >
                <!-- Name & initiative -->
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-1.5">
                        <span
                            v-if="index === combatSession.currentTurnIndex"
                            class="w-1.5 h-1.5 rounded-full bg-grimoire-accent"
                        />

                        <span
                            v-else
                            class="w-1.5 h-1.5 rounded-full bg-grimoire-muted/30"
                        />

                        <span class="font-['IM_Fell_English',serif] text-sm text-grimoire-text truncate max-w-32">
                            {{ combatant.name || combatant.id }}
                        </span>
                    </div>

                    <span class="font-mono text-xs text-grimoire-muted">{{ combatant.initiativeRoll }}</span>
                </div>

                <!-- HP bar -->
                <div class="space-y-0.5">
                    <div class="flex justify-between text-xs">
                        <span class="font-['Cinzel',serif] text-xs uppercase tracking-widest text-grimoire-muted">HP</span>

                        <span class="font-mono text-grimoire-text/80">
                            {{ combatant.currentHp }}<span class="text-grimoire-muted">/{{ combatant.maxHp }}</span>
                        </span>
                    </div>

                    <div class="w-full bg-grimoire-raised rounded-full h-1.5">
                        <div
                            class="h-1.5 rounded-full transition-all duration-500"
                            :class="hpBarColor(hpPercent(combatant))"
                            :style="{ width: `${hpPercent(combatant)}%` }"
                        />
                    </div>
                </div>

                <!-- Conditions -->
                <div v-if="combatant.conditions.length"
                    class="flex flex-wrap gap-0.5 mt-1">
                    <span
                        v-for="cond in combatant.conditions"
                        :key="cond"
                        data-testid="condition-tag"
                        class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-accent border border-grimoire-accent-dim/50 px-1.5 py-0.5 rounded-sm"
                    >
                        {{ cond }}
                    </span>
                </div>
            </div>
        </div>

        <!-- Recent combat events -->
        <div v-if="combatEvents.length"
            class="px-3 py-2 border-t border-grimoire-accent-dim/20 relative z-10"
            data-testid="combat-event-feed">
            <p class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted mb-2">Recent</p>

            <div class="space-y-1">
                <div
                    v-for="event in combatEvents.slice(-6)"
                    :key="`${event.kind}-${event.title}-${event.summary ?? ''}`"
                    class="flex items-start justify-between gap-2 border-l border-grimoire-accent-dim/30 pl-2 py-0.5"
                    data-testid="combat-event-row"
                >
                    <div class="min-w-0">
                        <p class="font-['Cinzel',serif] text-xs uppercase tracking-widest text-grimoire-muted">
                            {{ event.kind.replaceAll('_', ' ') }}
                        </p>

                        <p class="font-['IM_Fell_English',serif] text-sm leading-tight text-grimoire-text/80 truncate">
                            {{ event.title }}
                        </p>
                    </div>

                    <span v-if="combatEventAmount(event) !== null"
                        class="font-mono text-xs text-grimoire-text/80">
                        {{ combatEventAmount(event) }}
                    </span>
                </div>
            </div>
        </div>

        <!-- Player action economy (only on player's turn) -->
        <div
            v-if="playerCombatant && activeCombatant?.id === playerCombatant.id"
            class="px-3 py-2 border-t border-grimoire-accent-dim/20 relative z-10"
        >
            <p class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted mb-2">Actions</p>

            <div class="grid grid-cols-2 gap-1.5">
                <div
                    class="flex items-center gap-1.5 text-xs rounded-sm px-2 py-1"
                    :class="playerCombatant.usedAction ? 'bg-grimoire-raised text-grimoire-muted/40' : 'bg-grimoire-surface text-grimoire-text'"
                >
                    <span
                        class="w-2 h-2 rounded-full"
                        :class="playerCombatant.usedAction ? 'bg-grimoire-muted/30' : 'bg-grimoire-accent'"
                    />
                    Action
                </div>

                <div
                    class="flex items-center gap-1.5 text-xs rounded-sm px-2 py-1"
                    :class="playerCombatant.usedBonusAction ? 'bg-grimoire-raised text-grimoire-muted/40' : 'bg-grimoire-surface text-grimoire-text'"
                >
                    <span
                        class="w-2 h-2 rounded-full"
                        :class="playerCombatant.usedBonusAction ? 'bg-grimoire-muted/30' : 'bg-amber-500'"
                    />
                    Bonus
                </div>

                <div
                    class="flex items-center gap-1.5 text-xs rounded-sm px-2 py-1"
                    :class="playerCombatant.usedReaction ? 'bg-grimoire-raised text-grimoire-muted/40' : 'bg-grimoire-surface text-grimoire-text'"
                >
                    <span
                        class="w-2 h-2 rounded-full"
                        :class="playerCombatant.usedReaction ? 'bg-grimoire-muted/30' : 'bg-slate-400'"
                    />
                    Reaction
                </div>

                <div class="flex items-center gap-1.5 text-xs rounded-sm px-2 py-1 bg-grimoire-surface text-grimoire-text">
                    <span class="w-2 h-2 rounded-full bg-grimoire-muted/50" />
                    {{ 30 - playerCombatant.movementUsed }}ft
                </div>
            </div>
        </div>

        <!-- Spell slot pips -->
        <div v-if="hasSpellSlots"
            class="px-3 py-2 border-t border-grimoire-accent-dim/20 relative z-10">
            <p class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted mb-2">Spell Slots</p>

            <div class="space-y-1.5">
                <div
                    v-for="slot in activeSpellSlots"
                    :key="slot.level"
                    class="flex items-center justify-between"
                >
                    <span class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-widest">Lv {{ slot.level }}</span>

                    <div class="flex gap-0.5">
                        <span
                            v-for="i in slot.total"
                            :key="i"
                            class="w-3 h-3 rounded-full border transition-colors duration-300"
                            :class="i <= (slot.total - slot.used)
                                ? 'bg-grimoire-accent border-grimoire-accent'
                                : 'bg-transparent border-grimoire-muted/30'"
                        />
                    </div>
                </div>
            </div>
        </div>

        <!-- Quick action buttons -->
        <div class="px-3 py-2 border-t border-grimoire-accent-dim/20 relative z-10">
            <div class="flex flex-wrap gap-1.5">
                <button
                    v-for="action in quickActions"
                    :key="action.label"
                    type="button"
                    class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted
                           hover:text-grimoire-text transition-colors duration-150 disabled:opacity-30
                           border border-grimoire-accent-dim/20 hover:border-grimoire-accent-dim/50
                           px-2 py-1 rounded-sm"
                    :disabled="isStreaming"
                    @click="handleQuickAction(action.text)"
                >
                    {{ action.label }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { type ResultOf } from 'gql.tada';
import { computed } from 'vue';

import { type ACTIVE_SESSION_QUERY } from '~/graphql/session';
import { type PlayerVisibleEventPayload } from '~/types/player-visible-event';

export type Combatant = {
    id: string
    type: 'CHARACTER' | 'NPC'
    name: string
    initiativeRoll: number
    currentHp: number
    maxHp: number
    conditions: string[]
    usedAction: boolean
    usedBonusAction: boolean
    usedReaction: boolean
    movementUsed: number
};

type ActiveSession = NonNullable<ResultOf<typeof ACTIVE_SESSION_QUERY>['activeSession']>;

export type CombatSession = Omit<NonNullable<ActiveSession['combatSession']>, 'combatants'> & {
    combatants: Combatant[]
};

export type SpellSlot = {
    level: number
    total: number
    used: number
};

type Props = {
    combatSession: CombatSession
    characterId?: string
    spellSlots?: SpellSlot[]
    isStreaming?: boolean
    combatEvents?: PlayerVisibleEventPayload[]
};

const props = withDefaults(defineProps<Props>(), {
    characterId: undefined,
    spellSlots: () => [],
    isStreaming: false,
    combatEvents: () => [],
});

const emit = defineEmits<{
    action: [text: string]
}>();

const quickActions = [
    { label: 'Attack', text: 'I attack with my weapon.' },
    { label: 'Cast Spell', text: 'I cast a spell.' },
    { label: 'Dash', text: 'I use my action to Dash.' },
    { label: 'Dodge', text: 'I take the Dodge action.' },
    { label: 'Other', text: 'I take an action: ' },
];

function hpPercent(combatant: Combatant): number {
    if (combatant.maxHp === 0) return 0;
    return Math.round((combatant.currentHp / combatant.maxHp) * 100);
}

function hpBarColor(percent: number): string {
    if (percent > 50) {
        return 'bg-grimoire-accent';
    }
    if (percent > 25) {
        return 'bg-orange-600';
    }
    return 'bg-red-700 grimoire-breathe';
}

const activeCombatant = computed(() =>
    props.combatSession.combatants[props.combatSession.currentTurnIndex] ?? null,
);

const playerCombatant = computed(() =>
    props.characterId
        ? props.combatSession.combatants.find((c) => c.type === 'CHARACTER' && c.id === props.characterId) ?? null
        : null,
);

const hasSpellSlots = computed(() =>
    (props.spellSlots ?? []).some((s) => s.total > 0),
);

const activeSpellSlots = computed(() =>
    (props.spellSlots ?? []).filter((s) => s.total > 0),
);

function combatEventAmount(event: PlayerVisibleEventPayload): number | null {
    const amount = event.values?.amount;
    return typeof amount === 'number' ? amount : null;
}

function handleQuickAction(text: string): void {
    emit('action', text);
}
</script>
