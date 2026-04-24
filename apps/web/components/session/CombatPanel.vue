<template>
    <div class="w-72 flex-shrink-0 flex flex-col bg-gray-900 border-r border-gray-800 overflow-y-auto">
        <!-- Header -->
        <div class="px-4 py-3 border-b border-gray-800">
            <div class="flex items-center justify-between">
                <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Combat</h2>

                <span class="text-xs text-gray-500">Round {{ combatSession.roundNumber }}</span>
            </div>
        </div>

        <!-- Initiative order -->
        <div class="px-3 py-2 space-y-1 flex-1">
            <div
                v-for="(combatant, index) in combatSession.combatants"
                :key="combatant.id"
                class="rounded-lg p-2 transition-colors duration-300"
                :class="index === combatSession.currentTurnIndex
                    ? 'bg-primary-900/40 ring-1 ring-primary-500'
                    : 'bg-gray-800/50'"
            >
                <!-- Name & initiative -->
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-1.5">
                        <span
                            v-if="index === combatSession.currentTurnIndex"
                            class="w-1.5 h-1.5 rounded-full bg-primary-400"
                        />

                        <span
                            v-else
                            class="w-1.5 h-1.5 rounded-full bg-gray-600"
                        />

                        <span class="text-xs font-medium text-gray-200 truncate max-w-32">
                            {{ combatant.name || combatant.id }}
                        </span>
                    </div>

                    <span class="text-xs text-gray-500 font-mono">{{ combatant.initiativeRoll }}</span>
                </div>

                <!-- HP bar -->
                <div class="space-y-0.5">
                    <div class="flex justify-between text-xs">
                        <span class="text-gray-500">HP</span>

                        <span class="text-gray-300 font-mono">
                            {{ combatant.currentHp }}<span class="text-gray-600">/{{ combatant.maxHp }}</span>
                        </span>
                    </div>

                    <div class="w-full bg-gray-700 rounded-full h-1.5">
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
                    <u-badge
                        v-for="cond in combatant.conditions"
                        :key="cond"
                        color="warning"
                        variant="soft"
                        size="xs"
                        class="text-xs"
                    >
                        {{ cond }}
                    </u-badge>
                </div>
            </div>
        </div>

        <!-- Player action economy (only on player's turn) -->
        <div
            v-if="playerCombatant && activeCombatant?.id === playerCombatant.id"
            class="px-3 py-2 border-t border-gray-800"
        >
            <p class="text-xs text-gray-400 uppercase tracking-wider mb-2">Actions</p>

            <div class="grid grid-cols-2 gap-1.5">
                <div
                    class="flex items-center gap-1.5 text-xs rounded px-2 py-1"
                    :class="playerCombatant.usedAction ? 'bg-gray-800 text-gray-600' : 'bg-gray-700 text-gray-200'"
                >
                    <span
                        class="w-2 h-2 rounded-full"
                        :class="playerCombatant.usedAction ? 'bg-gray-600' : 'bg-primary-400'"
                    />
                    Action
                </div>

                <div
                    class="flex items-center gap-1.5 text-xs rounded px-2 py-1"
                    :class="playerCombatant.usedBonusAction ? 'bg-gray-800 text-gray-600' : 'bg-gray-700 text-gray-200'"
                >
                    <span
                        class="w-2 h-2 rounded-full"
                        :class="playerCombatant.usedBonusAction ? 'bg-gray-600' : 'bg-yellow-400'"
                    />
                    Bonus
                </div>

                <div
                    class="flex items-center gap-1.5 text-xs rounded px-2 py-1"
                    :class="playerCombatant.usedReaction ? 'bg-gray-800 text-gray-600' : 'bg-gray-700 text-gray-200'"
                >
                    <span
                        class="w-2 h-2 rounded-full"
                        :class="playerCombatant.usedReaction ? 'bg-gray-600' : 'bg-blue-400'"
                    />
                    Reaction
                </div>

                <div class="flex items-center gap-1.5 text-xs rounded px-2 py-1 bg-gray-700 text-gray-200">
                    <span class="w-2 h-2 rounded-full bg-gray-400" />
                    {{ 30 - playerCombatant.movementUsed }}ft
                </div>
            </div>
        </div>

        <!-- Spell slot pips -->
        <div v-if="hasSpellSlots"
            class="px-3 py-2 border-t border-gray-800">
            <p class="text-xs text-gray-400 uppercase tracking-wider mb-2">Spell Slots</p>

            <div class="space-y-1.5">
                <div
                    v-for="slot in activeSpellSlots"
                    :key="slot.level"
                    class="flex items-center justify-between"
                >
                    <span class="text-xs text-gray-500">Lv {{ slot.level }}</span>

                    <div class="flex gap-0.5">
                        <span
                            v-for="i in slot.total"
                            :key="i"
                            class="w-3 h-3 rounded-full border transition-colors duration-300"
                            :class="i <= (slot.total - slot.used)
                                ? 'bg-primary-400 border-primary-400'
                                : 'bg-transparent border-gray-600'"
                        />
                    </div>
                </div>
            </div>
        </div>

        <!-- Quick action buttons -->
        <div class="px-3 py-2 border-t border-gray-800">
            <div class="flex flex-wrap gap-1.5">
                <u-button
                    v-for="action in quickActions"
                    :key="action.label"
                    size="xs"
                    variant="soft"
                    color="neutral"
                    :disabled="isStreaming"
                    @click="handleQuickAction(action.text)"
                >
                    {{ action.label }}
                </u-button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { type ResultOf } from 'gql.tada';

import { type ACTIVE_SESSION_QUERY } from '~/graphql/session';

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
};

const props = withDefaults(defineProps<Props>(), {
    characterId: undefined,
    spellSlots: () => [],
    isStreaming: false,
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
    if (percent > 50) return 'bg-green-500';
    if (percent > 25) return 'bg-yellow-500';
    return 'bg-red-500';
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

function handleQuickAction(text: string): void {
    emit('action', text);
}
</script>
