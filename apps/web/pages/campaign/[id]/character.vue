<template>
    <div class="min-h-screen bg-gray-950 p-6">
        <!-- Navigation -->
        <div class="max-w-4xl mx-auto mb-6">
            <div class="flex items-center gap-4">
                <nuxt-link
                    :to="`/campaign/${campaignId}/play`"
                    class="text-gray-400 hover:text-white transition-colors text-sm"
                >
                    <u-icon name="i-lucide-arrow-left"
                        class="mr-1" />
                    Back to Play
                </nuxt-link>

                <div class="flex gap-3 ml-auto">
                    <nuxt-link
                        :to="`/campaign/${campaignId}/quests`"
                        class="text-gray-400 hover:text-white transition-colors text-sm"
                    >
                        Quests
                    </nuxt-link>

                    <nuxt-link
                        :to="`/campaign/${campaignId}/character`"
                        class="text-primary-400 font-medium text-sm"
                    >
                        Character
                    </nuxt-link>

                    <nuxt-link
                        :to="`/campaign/${campaignId}/world`"
                        class="text-gray-400 hover:text-white transition-colors text-sm"
                    >
                        World
                    </nuxt-link>
                </div>
            </div>
        </div>

        <div v-if="charFetching"
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

                <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-4 text-center">
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
                        <div class="text-xs text-gray-400 uppercase tracking-wider">Initiative</div>

                        <div class="text-2xl font-bold text-white">{{ signedModifier(abilityModifier((character.abilityScores as Record<AbilityKey, number>).DEX)) }}</div>
                    </div>

                    <div class="space-y-1">
                        <div class="text-xs text-gray-400 uppercase tracking-wider">Speed</div>

                        <div class="text-2xl font-bold text-white">{{ character.race?.speed ?? '—' }}ft</div>
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
                        <div class="text-xs text-gray-400 uppercase tracking-wider">Hit Dice</div>

                        <div class="text-2xl font-bold text-white">{{ character.hitDiceRemaining }}<span class="text-gray-500 text-base">/{{ character.level }}</span></div>
                    </div>
                </div>

                <!-- Conditions -->
                <div v-if="character.conditions?.length"
                    class="mt-4 pt-4 border-t border-gray-700">
                    <div class="text-xs text-gray-400 uppercase tracking-wider mb-2">Active Conditions</div>

                    <div class="flex flex-wrap gap-2">
                        <u-badge v-for="cond in character.conditions"
                            :key="cond"
                            color="warning"
                            variant="soft">
                            {{ cond }}
                        </u-badge>
                    </div>
                </div>

                <!-- Death saves (only if hp ≤ 0 and alive) -->
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
                            {{ signedModifier(abilityModifier((character.abilityScores as Record<AbilityKey, number>)[key])) }}
                        </div>
                    </div>
                </div>
            </u-card>

            <!-- Skills -->
            <u-card>
                <template #header>
                    <h2 class="text-lg font-semibold">Skills &amp; Saving Throws</h2>
                </template>

                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div
                        v-for="skillEntry in skillRows"
                        :key="skillEntry.name"
                        class="flex items-center gap-2 text-sm"
                    >
                        <div
                            class="w-3 h-3 rounded-full flex-shrink-0"
                            :class="{
                                'bg-primary-500': skillEntry.proficiency === 'proficient',
                                'bg-yellow-500': skillEntry.proficiency === 'expert',
                                'bg-gray-700 border border-gray-600': skillEntry.proficiency === 'none',
                            }"
                        />

                        <span :class="skillEntry.proficiency !== 'none' ? 'text-white' : 'text-gray-400'">
                            {{ skillEntry.name }}
                        </span>

                        <span class="ml-auto text-gray-300 tabular-nums">{{ signedModifier(skillEntry.bonus) }}</span>

                        <u-badge v-if="skillEntry.proficiency === 'expert'"
                            color="warning"
                            variant="soft"
                            size="xs">
                            E
                        </u-badge>
                    </div>
                </div>
            </u-card>

            <!-- Spell slots (only for spellcasters) -->
            <u-card v-if="hasSpellSlots">
                <template #header>
                    <h2 class="text-lg font-semibold">Spellcasting</h2>
                </template>

                <div class="space-y-3">
                    <div
                        v-for="slot in character.spellSlots as SpellSlot[]"
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
                        class="rounded-lg bg-gray-800 p-3"
                    >
                        <div class="flex items-start gap-3">
                            <div class="flex-1 min-w-0">
                                <div class="font-medium text-white">{{ ci.item.name }}</div>

                                <div class="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-3">
                                    <span>{{ ci.item.itemType }}</span>

                                    <span>{{ slotLabel(ci.slot) }}</span>

                                    <span v-if="ci.condition">{{ ci.condition }}</span>

                                    <span v-if="ci.item.weight != null">{{ ci.item.weight }} lb</span>

                                    <span v-if="ci.item.value != null">{{ ci.item.value }} cp</span>
                                </div>

                                <div v-if="ci.item.description"
                                    class="text-xs text-gray-500 mt-1">
                                    {{ ci.item.description }}
                                </div>

                                <!-- Combat stats from SRD equipment -->
                                <div v-if="ci.item.srdEquipment?.damage"
                                    class="text-xs text-gray-300 mt-1">
                                    Damage: {{ formatDamage(ci.item.srdEquipment.damage) }}
                                    <span v-if="ci.item.srdEquipment.properties?.length"
                                        class="text-gray-500 ml-2">
                                        {{ ci.item.srdEquipment.properties.join(', ') }}
                                    </span>
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

        <div v-else
            class="text-center text-gray-400 py-20">
            No character found for this campaign.
        </div>
    </div>
</template>

<script setup lang="ts">
import { useQuery, useMutation } from '@urql/vue';
import {
    CHARACTER_BY_CAMPAIGN_QUERY,
    CHARACTER_QUERY,
    CHARACTER_INVENTORY_QUERY,
    UNEQUIP_MUTATION,
} from '~/graphql/character';

const route = useRoute();
const campaignId = computed(() => route.params.id as string);

// Support ?characterId= deep links; otherwise resolve from campaign context
const queryCharId = computed(() => (route.query.characterId as string) ?? null);

const charVariables = computed(() =>
    queryCharId.value
        ? { id: queryCharId.value }
        : { campaignId: campaignId.value },
);

const { data: charDataById, fetching: fetchingById, error: errorById } = useQuery({
    query: CHARACTER_QUERY,
    variables: computed(() => ({ id: queryCharId.value })),
    pause: computed(() => !queryCharId.value),
});

const { data: charDataByCampaign, fetching: fetchingByCampaign, error: errorByCampaign } = useQuery({
    query: CHARACTER_BY_CAMPAIGN_QUERY,
    variables: computed(() => ({ campaignId: campaignId.value })),
    pause: computed(() => Boolean(queryCharId.value)),
});

const character = computed(() =>
    queryCharId.value
        ? (charDataById.value?.character ?? null)
        : (charDataByCampaign.value?.characterByCampaign ?? null),
);

const characterId = computed(() => character.value?.id?.toString() ?? null);
const charFetching = computed(() => fetchingById.value || fetchingByCampaign.value);
const charError = computed(() => errorById.value || errorByCampaign.value);

const { data: invData, fetching: invFetching, executeQuery: refetchInv } = useQuery({
    query: CHARACTER_INVENTORY_QUERY,
    variables: computed(() => ({ characterId: characterId.value })),
    pause: computed(() => !characterId.value),
});

const { executeMutation: executeUnequip } = useMutation(UNEQUIP_MUTATION);

const inventory = computed(() => invData.value?.characterInventory ?? []);

const ABILITY_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
type AbilityKey = typeof ABILITY_KEYS[number];

interface SpellSlot {
    level: number
    total: number
    used: number
}

interface SrdEquipment {
    id: string
    name: string
    category: string
    damage: Record<string, unknown> | null
    properties: string[]
}

interface SkillRow {
    name: string
    proficiency: string
    bonus: number
}

const SKILL_ABILITY_MAP: Record<string, AbilityKey> = {
    Acrobatics: 'DEX',
    'Animal Handling': 'WIS',
    Arcana: 'INT',
    Athletics: 'STR',
    Deception: 'CHA',
    History: 'INT',
    Insight: 'WIS',
    Intimidation: 'CHA',
    Investigation: 'INT',
    Medicine: 'WIS',
    Nature: 'INT',
    Perception: 'WIS',
    Performance: 'CHA',
    Persuasion: 'CHA',
    Religion: 'INT',
    'Sleight of Hand': 'DEX',
    Stealth: 'DEX',
    Survival: 'WIS',
};

function abilityModifier(score: number): number {
    return Math.floor((score - 10) / 2);
}

function signedModifier(mod: number): string {
    return mod >= 0 ? `+${mod}` : String(mod);
}

const skillRows = computed((): SkillRow[] => {
    if (!character.value) return [];
    const scores = character.value.abilityScores as Record<AbilityKey, number>;
    const profs = character.value.skillProficiencies as Record<string, string>;
    const profBonus = character.value.proficiencyBonus as number;

    return Object.entries(SKILL_ABILITY_MAP).map(([skill, ability]) => {
        const proficiency = profs[skill] ?? 'none';
        const base = abilityModifier(scores[ability]);
        const bonus = proficiency === 'expert'
            ? base + profBonus * 2
            : proficiency === 'proficient'
                ? base + profBonus
                : base;
        return { name: skill, proficiency, bonus };
    });
});

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

function formatDamage(damage: Record<string, unknown> | null): string {
    if (!damage) return '';
    const dice = damage['damage_dice'] as string | undefined;
    const type = (damage['damage_type'] as { name?: string } | undefined)?.name;
    if (dice && type) return `${dice} ${type}`;
    return dice ?? '';
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
    Array.isArray(character.value?.spellSlots) && (character.value.spellSlots as SpellSlot[]).length > 0,
);
</script>
