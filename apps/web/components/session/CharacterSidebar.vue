<script setup lang="ts">
interface SpellSlot {
    level: number;
    total: number;
    used: number;
}

interface Character {
    id: string;
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    ac: number;
    conditions: string[];
    spellSlots: SpellSlot[];
}

interface Props {
    character: Character | null;
    fetching?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    fetching: false,
});

const hasSpells = computed(() =>
    props.character?.spellSlots?.some((s) => s.total > 0) ?? false,
);

const hpPercentage = computed(() => {
    if (!props.character) return 0;
    return Math.round((props.character.hp / props.character.maxHp) * 100);
});

const hpColor = computed(() => {
    if (hpPercentage.value > 50) return 'bg-green-500';
    if (hpPercentage.value > 25) return 'bg-yellow-500';
    return 'bg-red-500';
});
</script>

<template>
    <div class="bg-gray-900 rounded-xl p-4 space-y-4 min-w-48">
        <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Character</h3>

        <div v-if="props.fetching"
            class="flex items-center justify-center py-4">
            <u-icon name="i-lucide-loader-circle"
                class="animate-spin text-gray-500" />
        </div>

        <template v-else-if="props.character">
            <!-- Name & Level -->
            <div>
                <p class="font-semibold text-white text-sm">{{ props.character.name }}</p>

                <p class="text-xs text-gray-400">Level {{ props.character.level }}</p>
            </div>

            <!-- HP bar -->
            <div class="space-y-1">
                <div class="flex justify-between text-xs">
                    <span class="text-gray-400">HP</span>

                    <span class="text-white font-mono">{{ props.character.hp }}<span class="text-gray-500">/{{ props.character.maxHp }}</span></span>
                </div>

                <div class="w-full bg-gray-700 rounded-full h-2">
                    <div class="h-2 rounded-full transition-all duration-300"
                        :class="hpColor"
                        :style="{ width: `${hpPercentage}%` }" />
                </div>
            </div>

            <!-- AC -->
            <div class="flex items-center justify-between text-sm">
                <span class="text-gray-400">AC</span>

                <span class="text-white font-mono">{{ props.character.ac }}</span>
            </div>

            <!-- Conditions -->
            <div v-if="props.character.conditions?.length"
                class="space-y-1">
                <p class="text-xs text-gray-400 uppercase tracking-wider">Conditions</p>

                <div class="flex flex-wrap gap-1">
                    <u-badge v-for="cond in props.character.conditions"
                        :key="cond"
                        color="warning"
                        variant="soft"
                        size="xs">
                        {{ cond }}
                    </u-badge>
                </div>
            </div>

            <!-- Spell slots -->
            <div v-if="hasSpells"
                class="space-y-1">
                <p class="text-xs text-gray-400 uppercase tracking-wider">Spell Slots</p>

                <div class="space-y-1">
                    <div v-for="slot in props.character.spellSlots.filter((s) => s.total > 0)"
                        :key="slot.level"
                        class="flex items-center justify-between text-xs">
                        <span class="text-gray-500">Lv {{ slot.level }}</span>

                        <div class="flex gap-0.5">
                            <span v-for="i in slot.total"
                                :key="i"
                                class="w-3 h-3 rounded-full border"
                                :class="i <= (slot.total - slot.used)
                                    ? 'bg-primary-400 border-primary-400'
                                    : 'bg-transparent border-gray-600'" />
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <p v-else
            class="text-xs text-gray-500 italic">No character</p>
    </div>
</template>
