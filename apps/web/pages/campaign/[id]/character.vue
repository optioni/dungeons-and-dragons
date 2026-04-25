<template>
    <div class="min-h-screen grimoire-bg p-6">
        <!-- Navigation -->
        <div class="max-w-4xl mx-auto mb-8 relative z-10 grimoire-page-enter">
            <div class="flex items-center gap-4">
                <nuxt-link
                    :to="`/campaign/${campaignId}/play`"
                    class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted hover:text-grimoire-text transition-colors"
                >
                    ← Play
                </nuxt-link>

                <div class="flex gap-5 ml-auto">
                    <nuxt-link
                        :to="`/campaign/${campaignId}/quests`"
                        class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted hover:text-grimoire-text transition-colors"
                    >
                        Quests
                    </nuxt-link>

                    <nuxt-link
                        :to="`/campaign/${campaignId}/character`"
                        class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-accent"
                    >
                        Character
                    </nuxt-link>

                    <nuxt-link
                        :to="`/campaign/${campaignId}/world`"
                        class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted hover:text-grimoire-text transition-colors"
                    >
                        World
                    </nuxt-link>
                </div>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="charFetching"
            class="flex flex-col items-center gap-4 py-20 text-grimoire-muted relative z-10">
            <span class="w-3 h-3 rounded-full bg-grimoire-accent grimoire-breathe" />
            <p class="font-['IM_Fell_English',serif] italic text-lg">Reading the chronicle...</p>
        </div>

        <!-- Error -->
        <div v-else-if="charError"
            class="text-center py-20 relative z-10">
            <u-alert color="error"
                variant="soft"
                description="Failed to load character sheet." />
        </div>

        <div v-else-if="character"
            class="max-w-4xl mx-auto space-y-0 relative z-10">
            <!-- Header -->
            <div class="pb-6 border-b border-grimoire-accent-dim/20 flex items-start justify-between">
                <div>
                    <h1 class="font-['IM_Fell_English',serif] text-4xl text-grimoire-text">{{ character.name }}</h1>

                    <p class="font-['Cinzel',serif] text-sm tracking-wider uppercase text-grimoire-muted mt-1">
                        {{ character.race?.name }} {{ character.class?.name }} · Level {{ character.level }}
                    </p>
                </div>

                <div v-if="character.isDead"
                    class="px-3 py-1 bg-red-900 border border-red-600 rounded-sm font-['Cinzel',serif] text-red-200 text-xs tracking-widest uppercase">
                    Dead
                </div>
            </div>

            <!-- Core stats -->
            <div class="py-6 border-b border-grimoire-accent-dim/20">
                <h2 class="font-['Cinzel',serif] text-xs tracking-[0.4em] uppercase text-grimoire-muted mb-4">Core Stats</h2>

                <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-4 text-center">
                    <div class="space-y-1">
                        <div class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-widest">HP</div>

                        <div class="font-mono text-2xl text-grimoire-accent">
                            {{ character.hp }}<span class="text-grimoire-muted text-base">/{{ character.maxHp }}</span>
                        </div>
                    </div>

                    <div class="space-y-1">
                        <div class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-widest">AC</div>

                        <div class="font-mono text-2xl text-grimoire-accent">{{ character.ac }}</div>
                    </div>

                    <div class="space-y-1">
                        <div class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-widest">Initiative</div>

                        <div class="font-mono text-2xl text-grimoire-accent">{{ signedModifier(abilityModifier((character.abilityScores as Record<AbilityKey, number>).DEX)) }}</div>
                    </div>

                    <div class="space-y-1">
                        <div class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-widest">Speed</div>

                        <div class="font-mono text-2xl text-grimoire-accent">{{ character.race?.speed ?? '—' }}<span class="text-grimoire-muted text-sm">ft</span></div>
                    </div>

                    <div class="space-y-1">
                        <div class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-widest">Prof.</div>

                        <div class="font-mono text-2xl text-grimoire-accent">+{{ character.proficiencyBonus }}</div>
                    </div>

                    <div class="space-y-1">
                        <div class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-widest">Level</div>

                        <div class="font-mono text-2xl text-grimoire-accent">{{ character.level }}</div>
                    </div>

                    <div class="space-y-1">
                        <div class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-widest">XP</div>

                        <div class="font-mono text-2xl text-grimoire-accent">{{ character.xp }}</div>
                    </div>

                    <div class="space-y-1">
                        <div class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-widest">Hit Dice</div>

                        <div class="font-mono text-2xl text-grimoire-accent">{{ character.hitDiceRemaining }}<span class="text-grimoire-muted text-base">/{{ character.level }}</span></div>
                    </div>
                </div>

                <!-- Conditions -->
                <div v-if="character.conditions?.length"
                    class="mt-4 pt-4 border-t border-grimoire-accent-dim/20">
                    <div class="font-['Cinzel',serif] text-xs uppercase tracking-widest text-grimoire-muted mb-2">Active Conditions</div>

                    <div class="flex flex-wrap gap-2">
                        <span v-for="cond in character.conditions"
                            :key="cond"
                            class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-accent border border-grimoire-accent-dim/50 px-2 py-0.5 rounded-sm">
                            {{ cond }}
                        </span>
                    </div>
                </div>

                <!-- Death saves -->
                <div v-if="character.hp <= 0 && !character.isDead"
                    class="mt-4 pt-4 border-t border-grimoire-accent-dim/20">
                    <div class="font-['Cinzel',serif] text-xs uppercase tracking-widest text-grimoire-muted mb-2">Death Saves</div>

                    <div class="flex gap-6">
                        <div>
                            <span class="font-['Cinzel',serif] text-xs text-grimoire-muted mr-2 uppercase tracking-widest">Successes</span>

                            <span class="font-mono text-green-400">{{ character.deathSaveSuccesses }}/3</span>
                        </div>

                        <div>
                            <span class="font-['Cinzel',serif] text-xs text-grimoire-muted mr-2 uppercase tracking-widest">Failures</span>

                            <span class="font-mono text-red-400">{{ character.deathSaveFailures }}/3</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Ability scores -->
            <div class="py-6 border-b border-grimoire-accent-dim/20">
                <h2 class="font-['Cinzel',serif] text-xs tracking-[0.4em] uppercase text-grimoire-muted mb-4">Ability Scores</h2>

                <div class="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center">
                    <div
                        v-for="key in ABILITY_KEYS"
                        :key="key"
                        class="rounded-sm bg-grimoire-surface p-3 space-y-1 border-t-2 border-grimoire-accent-dim/30"
                    >
                        <div class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-widest">{{ key }}</div>

                        <div class="font-mono text-2xl text-grimoire-accent">
                            {{ (character.abilityScores as Record<AbilityKey, number>)[key] }}
                        </div>

                        <div class="font-mono text-sm text-grimoire-muted">
                            {{ signedModifier(abilityModifier((character.abilityScores as Record<AbilityKey, number>)[key])) }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Skills -->
            <div class="py-6 border-b border-grimoire-accent-dim/20">
                <h2 class="font-['Cinzel',serif] text-xs tracking-[0.4em] uppercase text-grimoire-muted mb-4">Skills &amp; Saving Throws</h2>

                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div
                        v-for="skillEntry in skillRows"
                        :key="skillEntry.name"
                        class="flex items-center gap-2 text-sm"
                    >
                        <div
                            class="w-3 h-3 rounded-full flex-shrink-0"
                            :class="{
                                'bg-grimoire-accent': skillEntry.proficiency === 'proficient',
                                'bg-yellow-500': skillEntry.proficiency === 'expert',
                                'bg-grimoire-surface border border-grimoire-muted/30': skillEntry.proficiency === 'none',
                            }"
                        />

                        <span class="font-['IM_Fell_English',serif]" :class="skillEntry.proficiency !== 'none' ? 'text-grimoire-text' : 'text-grimoire-muted'">
                            {{ skillEntry.name }}
                        </span>

                        <span class="ml-auto font-mono text-grimoire-muted tabular-nums">{{ signedModifier(skillEntry.bonus) }}</span>

                        <span v-if="skillEntry.proficiency === 'expert'"
                            class="font-['Cinzel',serif] text-xs text-yellow-500 uppercase tracking-widest">
                            E
                        </span>
                    </div>
                </div>
            </div>

            <!-- Spell slots -->
            <div v-if="hasSpellSlots" class="py-6 border-b border-grimoire-accent-dim/20">
                <h2 class="font-['Cinzel',serif] text-xs tracking-[0.4em] uppercase text-grimoire-muted mb-4">Spellcasting</h2>

                <div class="space-y-3">
                    <div
                        v-for="slot in character.spellSlots as SpellSlot[]"
                        :key="slot.level"
                        class="flex items-center gap-4"
                    >
                        <div class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-widest w-20">Level {{ slot.level }}</div>

                        <div class="flex gap-1.5">
                            <div
                                v-for="i in slot.total"
                                :key="i"
                                class="w-4 h-4 rounded-full border-2 transition-colors"
                                :class="i <= slot.used
                                    ? 'bg-grimoire-raised border-grimoire-muted/20'
                                    : 'bg-grimoire-accent border-grimoire-accent'"
                            />
                        </div>

                        <div class="font-mono text-sm text-grimoire-muted ml-auto">{{ slot.total - slot.used }}/{{ slot.total }}</div>
                    </div>

                    <div v-if="character.preparedSpells?.length"
                        class="mt-4 pt-4 border-t border-grimoire-accent-dim/20">
                        <div class="font-['Cinzel',serif] text-xs uppercase tracking-widest text-grimoire-muted mb-2">Prepared Spells</div>

                        <div class="flex flex-wrap gap-2">
                            <span v-for="spell in character.preparedSpells"
                                :key="spell"
                                class="font-['IM_Fell_English',serif] text-sm text-grimoire-text border border-grimoire-accent-dim/30 px-2 py-0.5 rounded-sm">
                                {{ spell }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Inventory -->
            <div class="py-6 border-b border-grimoire-accent-dim/20">
                <h2 class="font-['Cinzel',serif] text-xs tracking-[0.4em] uppercase text-grimoire-muted mb-4">Inventory</h2>

                <div v-if="invFetching"
                    class="flex flex-col items-center gap-4 py-6 text-grimoire-muted">
                    <span class="w-3 h-3 rounded-full bg-grimoire-accent grimoire-breathe" />
                    <p class="font-['IM_Fell_English',serif] italic">Consulting the pack...</p>
                </div>

                <div v-else-if="!inventory.length"
                    class="font-['IM_Fell_English',serif] italic text-grimoire-muted py-6">
                    The pack is empty.
                </div>

                <div v-else
                    class="space-y-2">
                    <div
                        v-for="ci in inventory"
                        :key="ci.id"
                        class="rounded-sm bg-grimoire-surface p-3"
                    >
                        <div class="flex items-start gap-3">
                            <div class="flex-1 min-w-0">
                                <div class="font-['IM_Fell_English',serif] text-base text-grimoire-text">{{ ci.item.name }}</div>

                                <div class="font-['Cinzel',serif] text-xs text-grimoire-muted mt-0.5 uppercase tracking-wider flex flex-wrap gap-3">
                                    <span>{{ ci.item.itemType }}</span>

                                    <span>{{ slotLabel(ci.slot) }}</span>

                                    <span v-if="ci.condition">{{ ci.condition }}</span>

                                    <span v-if="ci.item.weight != null">{{ ci.item.weight }} lb</span>

                                    <span v-if="ci.item.value != null">{{ ci.item.value }} cp</span>
                                </div>

                                <div v-if="ci.item.description"
                                    class="font-['IM_Fell_English',serif] italic text-xs text-grimoire-muted/70 mt-1">
                                    {{ ci.item.description }}
                                </div>

                                <div v-if="ci.item.srdEquipment?.damage"
                                    class="font-['Cinzel',serif] text-xs text-grimoire-text/80 mt-1 uppercase tracking-wider">
                                    {{ formatDamage(ci.item.srdEquipment.damage) }}
                                    <span v-if="ci.item.srdEquipment.properties?.length"
                                        class="text-grimoire-muted ml-2">
                                        {{ ci.item.srdEquipment.properties.join(', ') }}
                                    </span>
                                </div>
                            </div>

                            <button
                                v-if="ci.slot"
                                type="button"
                                class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted
                                       hover:text-grimoire-text transition-colors duration-150 disabled:opacity-30"
                                :disabled="unequipping === ci.id"
                                @click="unequipItem(ci.id)"
                            >
                                {{ unequipping === ci.id ? 'Unequipping...' : 'Unequip' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Currency -->
            <div class="py-6">
                <h2 class="font-['Cinzel',serif] text-xs tracking-[0.4em] uppercase text-grimoire-muted mb-4">Currency</h2>

                <div class="flex gap-8 text-center">
                    <div>
                        <div class="font-mono text-2xl text-grimoire-accent">{{ character.goldPieces }}</div>

                        <div class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-widest mt-1">gp</div>
                    </div>

                    <div>
                        <div class="font-mono text-2xl text-grimoire-text">{{ character.silverPieces }}</div>

                        <div class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-widest mt-1">sp</div>
                    </div>

                    <div>
                        <div class="font-mono text-2xl text-grimoire-text">{{ character.copperPieces }}</div>

                        <div class="font-['Cinzel',serif] text-xs text-grimoire-muted uppercase tracking-widest mt-1">cp</div>
                    </div>
                </div>
            </div>
        </div>

        <div v-else
            class="text-center font-['IM_Fell_English',serif] italic text-grimoire-muted py-20 relative z-10">
            No character found for this campaign.
        </div>
    </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { useQuery, useMutation } from '@urql/vue';

import {
    CHARACTER_BY_CAMPAIGN_QUERY,
    CHARACTER_QUERY,
    CHARACTER_INVENTORY_QUERY,
    UNEQUIP_MUTATION,
} from '~/graphql/character';

const route = useRoute();
const campaignId = computed(() => route.params.id as string);

const queryCharId = computed(() => (route.query.characterId as string) ?? null);

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
type AbilityScores = Record<AbilityKey, number>;
type SkillProficiencies = Record<string, string>;
type SpellSlot = {
    level: number
    total: number
    used: number
};

type SkillRow = {
    name: string
    proficiency: string
    bonus: number
};

/* eslint-disable @typescript-eslint/naming-convention */
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
/* eslint-enable @typescript-eslint/naming-convention */

function abilityModifier(score: number): number {
    return Math.floor((score - 10) / 2);
}

function signedModifier(mod: number): string {
    return mod >= 0 ? `+${mod}` : String(mod);
}

const skillRows = computed((): SkillRow[] => {
    if (!character.value) return [];
    const scores = character.value.abilityScores as AbilityScores;
    const profs = character.value.skillProficiencies as SkillProficiencies;
    const profBonus = character.value.proficiencyBonus;

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
