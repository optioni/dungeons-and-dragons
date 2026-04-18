<template>
    <div class="min-h-screen bg-gray-950 p-6">
        <div v-if="!queryCharId"
            class="text-center text-gray-400 py-20">
            No character selected.
        </div>

        <div v-else-if="charFetching"
            class="flex justify-center py-20">
            <u-icon name="i-lucide-loader-circle"
                class="animate-spin text-3xl" />
        </div>

        <div v-else-if="charError"
            class="text-center py-20">
            <u-alert color="error"
                variant="soft"
                description="Failed to load character sheet." />
        </div>

        <div v-else-if="character"
            class="max-w-4xl mx-auto space-y-6">
            <!-- Header -->
            <div class="flex items-start justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-white">{{ character.name }}</h1>

                    <p class="text-gray-400 mt-1">
                        {{ character.race?.name }} {{ character.class?.name }} · Level {{ character.level }}
                    </p>
                </div>

                <div v-if="character.isDead"
                    class="px-3 py-1 bg-red-900 border border-red-600 rounded text-red-200 text-sm font-bold">
                    DEAD
                </div>
            </div>

            <!-- Core stats -->
            <u-card>
                <template #header>
                    <h2 class="text-lg font-semibold">Core Stats</h2>
                </template>

                <div class="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center">
                    <div class="space-y-1">
                        <div class="text-xs text-gray-400 uppercase tracking-wider">HP</div>

                        <div class="text-2xl font-bold text-white">
                            {{ character.hp }}<span class="text-gray-500 text-base">/{{ character.maxHp }}</span>
                        </div>
                    </div>

                    <div class="space-y-1">
                        <div class="text-xs text-gray-400 uppercase tracking-wider">AC</div>

                        <div class="text-2xl font-bold text-white">{{ character.ac }}</div>
                    </div>

                    <div class="space-y-1">
                        <div class="text-xs text-gray-400 uppercase tracking-wider">Prof. Bonus</div>

                        <div class="text-2xl font-bold text-white">+{{ character.proficiencyBonus }}</div>
                    </div>

                    <div class="space-y-1">
                        <div class="text-xs text-gray-400 uppercase tracking-wider">Level</div>

                        <div class="text-2xl font-bold text-white">{{ character.level }}</div>
                    </div>

                    <div class="space-y-1">
                        <div class="text-xs text-gray-400 uppercase tracking-wider">XP</div>

                        <div class="text-2xl font-bold text-white">{{ character.xp }}</div>
                    </div>

                    <div class="space-y-1">
                        <div class="text-xs text-gray-400 uppercase tracking-wider">Hit Die</div>

                        <div class="text-2xl font-bold text-white">d{{ character.class?.hitDie }}</div>
                    </div>
                </div>

                <!-- Conditions -->
                <div v-if="character.conditions?.length"
                    class="mt-4 pt-4 border-t border-gray-700">
                    <div class="text-xs text-gray-400 uppercase tracking-wider mb-2">Conditions</div>

                    <div class="flex flex-wrap gap-2">
                        <u-badge v-for="cond in character.conditions"
                            :key="cond"
                            color="warning"
                            variant="soft">
                            {{ cond }}
                        </u-badge>
                    </div>
                </div>

                <!-- Death saves (only if hp ≤ 0 or at 0) -->
                <div v-if="character.hp <= 0 && !character.isDead"
                    class="mt-4 pt-4 border-t border-gray-700">
                    <div class="text-xs text-gray-400 uppercase tracking-wider mb-2">Death Saves</div>

                    <div class="flex gap-6">
                        <div>
                            <span class="text-xs text-gray-500 mr-2">Successes</span>

                            <span class="text-green-400 font-bold">{{ character.deathSaveSuccesses }}/3</span>
                        </div>

                        <div>
                            <span class="text-xs text-gray-500 mr-2">Failures</span>

                            <span class="text-red-400 font-bold">{{ character.deathSaveFailures }}/3</span>
                        </div>
                    </div>
                </div>
            </u-card>

            <!-- Ability scores -->
            <u-card>
                <template #header>
                    <h2 class="text-lg font-semibold">Ability Scores</h2>
                </template>

                <div class="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center">
                    <div
                        v-for="key in ABILITY_KEYS"
                        :key="key"
                        class="rounded-lg bg-gray-800 p-3 space-y-1"
                    >
                        <div class="text-xs text-gray-400 uppercase tracking-wider">{{ key }}</div>

                        <div class="text-2xl font-bold text-white">
                            {{ (character.abilityScores as Record<AbilityKey, number>)[key] }}
                        </div>

                        <div class="text-sm text-gray-400">
                            {{ abilityModifier((character.abilityScores as Record<AbilityKey, number>)[key]) }}
                        </div>
                    </div>
                </div>
            </u-card>

            <!-- Spell slots (only for spellcasters) -->
            <u-card v-if="hasSpellSlots">
                <template #header>
                    <h2 class="text-lg font-semibold">Spell Slots</h2>
                </template>

                <div class="space-y-3">
                    <div
                        v-for="slot in character.spellSlots as Array<{ level: number; total: number; used: number }>"
                        :key="slot.level"
                        class="flex items-center gap-4"
                    >
                        <div class="w-20 text-sm text-gray-400">Level {{ slot.level }}</div>

                        <div class="flex gap-1.5">
                            <div
                                v-for="i in slot.total"
                                :key="i"
                                class="w-4 h-4 rounded-full border-2"
                                :class="i <= slot.used
                                    ? 'bg-gray-700 border-gray-600'
                                    : 'bg-primary-500 border-primary-400'"
                            />
                        </div>

                        <div class="text-sm text-gray-400 ml-auto">{{ slot.total - slot.used }}/{{ slot.total }}</div>
                    </div>

                    <div v-if="character.preparedSpells?.length"
                        class="mt-4 pt-4 border-t border-gray-700">
                        <div class="text-xs text-gray-400 uppercase tracking-wider mb-2">Prepared Spells</div>

                        <div class="flex flex-wrap gap-2">
                            <u-badge v-for="spell in character.preparedSpells"
                                :key="spell"
                                color="info"
                                variant="soft">
                                {{ spell }}
                            </u-badge>
                        </div>
                    </div>
                </div>
            </u-card>

            <!-- Skill proficiencies -->
            <u-card>
                <template #header>
                    <h2 class="text-lg font-semibold">Skills</h2>
                </template>

                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div
                        v-for="skillName in SKILL_NAMES"
                        :key="skillName"
                        class="flex items-center gap-2 text-sm"
                    >
                        <div
                            class="w-3 h-3 rounded-full flex-shrink-0"
                            :class="{
                                'bg-primary-500': (character.skillProficiencies as Record<string, string>)[skillName] === 'proficient',
                                'bg-yellow-500': (character.skillProficiencies as Record<string, string>)[skillName] === 'expert',
                                'bg-gray-700 border border-gray-600': (character.skillProficiencies as Record<string, string>)[skillName] === 'none',
                            }"
                        />

                        <span :class="(character.skillProficiencies as Record<string, string>)[skillName] !== 'none' ? 'text-white' : 'text-gray-400'">{{ skillName }}</span>

                        <u-badge v-if="(character.skillProficiencies as Record<string, string>)[skillName] === 'expert'"
                            color="warning"
                            variant="soft"
                            size="xs">
                            E
                        </u-badge>
                    </div>
                </div>
            </u-card>

            <!-- Inventory -->
            <u-card>
                <template #header>
                    <h2 class="text-lg font-semibold">Inventory</h2>
                </template>

                <div v-if="invFetching"
                    class="flex justify-center py-6">
                    <u-icon name="i-lucide-loader-circle"
                        class="animate-spin" />
                </div>

                <div v-else-if="!inventory.length"
                    class="text-center text-gray-500 py-6">
                    No items in inventory.
                </div>

                <div v-else
                    class="space-y-2">
                    <div
                        v-for="ci in inventory"
                        :key="ci.id"
                        class="flex items-center gap-3 p-3 rounded-lg bg-gray-800"
                    >
                        <div class="flex-1 min-w-0">
                            <div class="font-medium text-white">{{ ci.item.name }}</div>

                            <div class="text-xs text-gray-400 mt-0.5 flex gap-3">
                                <span>{{ ci.item.itemType }}</span>

                                <span>{{ slotLabel(ci.slot) }}</span>

                                <span v-if="ci.condition">{{ ci.condition }}</span>
                            </div>
                        </div>

                        <u-button
                            v-if="ci.slot"
                            size="xs"
                            variant="soft"
                            color="neutral"
                            :loading="unequipping === ci.id"
                            @click="unequipItem(ci.id)"
                        >
                            Unequip
                        </u-button>
                    </div>
                </div>
            </u-card>

            <!-- Currency -->
            <u-card>
                <template #header>
                    <h2 class="text-lg font-semibold">Currency</h2>
                </template>

                <div class="flex gap-8 text-center">
                    <div>
                        <div class="text-2xl font-bold text-yellow-400">{{ character.goldPieces }}</div>

                        <div class="text-xs text-gray-400 uppercase tracking-wider">gp</div>
                    </div>

                    <div>
                        <div class="text-2xl font-bold text-gray-300">{{ character.silverPieces }}</div>

                        <div class="text-xs text-gray-400 uppercase tracking-wider">sp</div>
                    </div>

                    <div>
                        <div class="text-2xl font-bold text-amber-600">{{ character.copperPieces }}</div>

                        <div class="text-xs text-gray-400 uppercase tracking-wider">cp</div>
                    </div>
                </div>
            </u-card>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useQuery, useMutation } from '@urql/vue';

const route = useRoute();

// Character ID is passed as a query param: /campaign/[id]/character?characterId=X
const queryCharId = computed(() => (route.query.characterId as string) ?? null);

const CHARACTER_QUERY = `
  query Character($id: ID!) {
    character(id: $id) {
      id
      name
      level
      proficiencyBonus
      hp
      maxHp
      ac
      xp
      isDead
      deathSaveSuccesses
      deathSaveFailures
      conditions
      abilityScores
      spellSlots
      preparedSpells
      skillProficiencies
      goldPieces
      silverPieces
      copperPieces
      race {
        id
        name
      }
      class {
        id
        name
        hitDie
      }
    }
  }
`;

const CHARACTER_INVENTORY_QUERY = `
  query CharacterInventory($characterId: ID!) {
    characterInventory(characterId: $characterId) {
      id
      slot
      condition
      item {
        id
        name
        description
        itemType
        weight
        value
      }
    }
  }
`;

const UNEQUIP_MUTATION = `
  mutation UnequipItem($characterItemId: ID!) {
    unequipItem(characterItemId: $characterItemId) {
      id
      slot
    }
  }
`;

const pause = computed(() => !queryCharId.value);

const { data: charData, fetching: charFetching, error: charError, executeQuery: refetchChar } = useQuery({
    query: CHARACTER_QUERY,
    variables: computed(() => ({ id: queryCharId.value })),
    pause,
});

const { data: invData, fetching: invFetching, executeQuery: refetchInv } = useQuery({
    query: CHARACTER_INVENTORY_QUERY,
    variables: computed(() => ({ characterId: queryCharId.value })),
    pause,
});

const { executeMutation: executeUnequip } = useMutation(UNEQUIP_MUTATION);

const character = computed(() => charData.value?.character ?? null);
const inventory = computed(() => invData.value?.characterInventory ?? []);

const ABILITY_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
type AbilityKey = typeof ABILITY_KEYS[number];

const SKILL_NAMES = [
    'Acrobatics',
    'Animal Handling',
    'Arcana',
    'Athletics',
    'Deception',
    'History',
    'Insight',
    'Intimidation',
    'Investigation',
    'Medicine',
    'Nature',
    'Perception',
    'Performance',
    'Persuasion',
    'Religion',
    'Sleight of Hand',
    'Stealth',
    'Survival',
] as const;

function abilityModifier(score: number): string {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : String(mod);
}

/* eslint-disable @typescript-eslint/naming-convention */
const SLOT_LABELS: Record<string, string> = {
    MAIN_HAND: 'Main Hand',
    OFF_HAND: 'Off Hand',
    HEAD: 'Head',
    CHEST: 'Chest',
    HANDS: 'Hands',
    FEET: 'Feet',
    RING_1: 'Ring (1)',
    RING_2: 'Ring (2)',
    NECK: 'Neck',
    BACK: 'Back',
};
/* eslint-enable @typescript-eslint/naming-convention */

function slotLabel(slot: string | null): string {
    return slot ? (SLOT_LABELS[slot] ?? slot) : 'Carried';
}

const unequipping = ref<string | null>(null);

async function unequipItem(characterItemId: string): Promise<void> {
    unequipping.value = characterItemId;
    try {
        await executeUnequip({ characterItemId });
        await refetchInv({ requestPolicy: 'network-only' });
    } finally {
        unequipping.value = null;
    }
}

const hasSpellSlots = computed(() =>
    Array.isArray(character.value?.spellSlots) && character.value.spellSlots.length > 0,
);
</script>
