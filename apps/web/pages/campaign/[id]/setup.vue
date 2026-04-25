<template>
    <div class="min-h-screen grimoire-bg flex items-center justify-center p-6">
        <!-- Loading campaign state -->
        <div v-if="campaignFetching"
            class="flex flex-col items-center gap-4 text-grimoire-muted relative z-10">
            <span class="w-3 h-3 rounded-full bg-grimoire-accent grimoire-breathe" />
            <p class="font-['IM_Fell_English',serif] italic text-lg">The chronicle stirs...</p>
        </div>

        <!-- Error loading campaign -->
        <u-alert v-else-if="campaignError"
            class="max-w-md w-full relative z-10"
            color="error"
            variant="soft"
            description="Failed to load campaign. Please refresh." />

        <!-- Ready to play -->
        <div v-else-if="campaign?.setupStatus === 'READY_TO_PLAY'"
            class="max-w-md w-full text-center space-y-8 relative z-10 grimoire-stagger">
            <p class="font-['Cinzel',serif] text-xs tracking-[0.5em] uppercase text-grimoire-muted">
                Your chronicle awaits
            </p>

            <h2 class="font-['IM_Fell_English',serif] text-4xl text-grimoire-text">
                The world is ready.
            </h2>

            <button
                type="button"
                class="font-['Cinzel',serif] text-sm tracking-widest uppercase text-grimoire-accent
                       border-b border-grimoire-accent pb-0.5 hover:text-grimoire-text transition-colors"
                @click="router.push(`/campaign/${campaignId}/play`)"
            >
                Begin your story →
            </button>
        </div>

        <!-- Setup wizard -->
        <div v-else
            class="w-full max-w-2xl relative z-10">
            <!-- Cinzel progress indicator -->
            <div class="flex items-center mb-12">
                <template v-for="(label, i) in wizardStepLabels" :key="i">
                    <span
                        class="font-['Cinzel',serif] text-xs tracking-widest uppercase transition-colors"
                        :class="i === wizardStepIndex
                            ? 'text-grimoire-accent border-b border-grimoire-accent pb-0.5'
                            : i < wizardStepIndex
                                ? 'text-grimoire-muted/50'
                                : 'text-grimoire-muted/30'"
                    >{{ label }}</span>

                    <span
                        v-if="i < wizardStepLabels.length - 1"
                        class="mx-3 text-grimoire-accent-dim/30 text-xs"
                    >·</span>
                </template>
            </div>

            <!-- ── Character creation steps ──────────────────────────────────────── -->
            <template v-if="!campaign?.hasCharacter">
                <!-- Step 1: Character name -->
                <div v-if="step === 'charName'" class="space-y-8">
                    <div>
                        <h2 class="font-['IM_Fell_English',serif] text-3xl text-grimoire-text">Name your hero</h2>

                        <p class="font-['Cinzel',serif] text-xs tracking-wider uppercase text-grimoire-muted mt-2">
                            What name shall be written in the chronicle?
                        </p>
                    </div>

                    <div class="border-l-2 border-transparent focus-within:border-grimoire-accent transition-colors duration-200 pl-5">
                        <input
                            v-model="charName"
                            class="w-full bg-transparent text-grimoire-text text-xl font-['IM_Fell_English',serif]
                                   outline-none placeholder:italic placeholder:text-grimoire-muted/50"
                            placeholder="What is your name, adventurer?"
                            @input="charNameError = ''"
                            @keydown.enter="nextStep"
                        />
                    </div>

                    <u-alert v-if="charNameError"
                        color="error"
                        variant="soft"
                        :description="charNameError" />

                    <div class="flex justify-end">
                        <button
                            type="button"
                            class="w-full py-3 bg-grimoire-accent text-grimoire-bg font-['Cinzel',serif]
                                   text-sm tracking-widest uppercase hover:bg-grimoire-accent/90
                                   transition-colors duration-200 disabled:opacity-50"
                            :disabled="!charName.trim()"
                            @click="nextStep"
                        >
                            Continue
                        </button>
                    </div>
                </div>

                <!-- Step 2: Race selection -->
                <div v-else-if="step === 'charRace'" class="space-y-8">
                    <div>
                        <h2 class="font-['IM_Fell_English',serif] text-3xl text-grimoire-text">Choose your lineage</h2>

                        <p class="font-['Cinzel',serif] text-xs tracking-wider uppercase text-grimoire-muted mt-2">
                            Blood and heritage shape the hero you will become
                        </p>
                    </div>

                    <div v-if="racesFetching"
                        class="flex flex-col items-center gap-4 py-8 text-grimoire-muted">
                        <span class="w-3 h-3 rounded-full bg-grimoire-accent grimoire-breathe" />
                        <p class="font-['IM_Fell_English',serif] italic text-lg">Consulting the lineages...</p>
                    </div>

                    <div v-else
                        class="grid grid-cols-2 gap-3">
                        <button
                            v-for="race in races"
                            :key="race.id as string"
                            type="button"
                            class="text-left p-4 rounded-sm border transition-all duration-200"
                            :class="selectedRaceId === race.id
                                ? 'border-grimoire-accent bg-grimoire-accent/8'
                                : 'border-grimoire-accent-dim/20 bg-grimoire-surface hover:border-grimoire-accent-dim/50'"
                            @click="selectedRaceId = race.id as string"
                        >
                            <div class="font-['IM_Fell_English',serif] text-base text-grimoire-text">{{ race.name }}</div>

                            <div v-if="(race.traits as string[]).length"
                                class="font-['Cinzel',serif] text-xs text-grimoire-muted mt-1 line-clamp-2 uppercase tracking-wider">
                                {{ (race.traits as string[]).slice(0, 3).join(', ') }}
                            </div>
                        </button>
                    </div>

                    <div class="flex gap-4 items-center">
                        <button
                            type="button"
                            class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted
                                   hover:text-grimoire-text transition-colors duration-150"
                            @click="step = 'charName'"
                        >
                            ← Back
                        </button>

                        <button
                            type="button"
                            class="flex-1 py-3 bg-grimoire-accent text-grimoire-bg font-['Cinzel',serif]
                                   text-sm tracking-widest uppercase hover:bg-grimoire-accent/90
                                   transition-colors duration-200 disabled:opacity-50"
                            :disabled="!selectedRaceId"
                            @click="nextStep"
                        >
                            Continue
                        </button>
                    </div>
                </div>

                <!-- Step 3: Class selection -->
                <div v-else-if="step === 'charClass'" class="space-y-8">
                    <div>
                        <h2 class="font-['IM_Fell_English',serif] text-3xl text-grimoire-text">Choose your calling</h2>

                        <p class="font-['Cinzel',serif] text-xs tracking-wider uppercase text-grimoire-muted mt-2">
                            A path chosen. A destiny sealed.
                        </p>
                    </div>

                    <div v-if="classesFetching"
                        class="flex flex-col items-center gap-4 py-8 text-grimoire-muted">
                        <span class="w-3 h-3 rounded-full bg-grimoire-accent grimoire-breathe" />
                        <p class="font-['IM_Fell_English',serif] italic text-lg">Summoning the callings...</p>
                    </div>

                    <div v-else
                        class="grid grid-cols-2 gap-3">
                        <button
                            v-for="cls in classes"
                            :key="cls.id as string"
                            type="button"
                            class="text-left p-4 rounded-sm border transition-all duration-200"
                            :class="selectedClassId === cls.id
                                ? 'border-grimoire-accent bg-grimoire-accent/8'
                                : 'border-grimoire-accent-dim/20 bg-grimoire-surface hover:border-grimoire-accent-dim/50'"
                            @click="selectedClassId = cls.id as string"
                        >
                            <div class="font-['IM_Fell_English',serif] text-base text-grimoire-text">{{ cls.name }}</div>

                            <div class="font-['Cinzel',serif] text-xs text-grimoire-muted mt-1 uppercase tracking-wider">
                                Hit Die: d{{ cls.hitDie }}
                                <span v-if="cls.spellcastingAbility"
                                    class="ml-2">· Spellcaster</span>
                            </div>
                        </button>
                    </div>

                    <div class="flex gap-4 items-center">
                        <button
                            type="button"
                            class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted
                                   hover:text-grimoire-text transition-colors duration-150"
                            @click="step = 'charRace'"
                        >
                            ← Back
                        </button>

                        <button
                            type="button"
                            class="flex-1 py-3 bg-grimoire-accent text-grimoire-bg font-['Cinzel',serif]
                                   text-sm tracking-widest uppercase hover:bg-grimoire-accent/90
                                   transition-colors duration-200 disabled:opacity-50"
                            :disabled="!selectedClassId"
                            @click="nextStep"
                        >
                            Continue
                        </button>
                    </div>
                </div>

                <!-- Step 4: Ability scores -->
                <div v-else-if="step === 'charAbilities'" class="space-y-8">
                    <div>
                        <h2 class="font-['IM_Fell_English',serif] text-3xl text-grimoire-text">Your gifts and shortcomings</h2>

                        <p class="font-['Cinzel',serif] text-xs tracking-wider uppercase text-grimoire-muted mt-2">
                            Assign each value from the standard array
                        </p>
                    </div>

                    <div class="space-y-4">
                        <div class="flex flex-wrap gap-2 pb-4 border-b border-grimoire-accent-dim/20">
                            <template v-for="value in STANDARD_ARRAY" :key="value">
                                <span
                                    class="px-3 py-1 rounded-sm text-sm font-mono transition-colors border"
                                    :class="isValueAvailable(value)
                                        ? 'bg-grimoire-surface border-grimoire-accent-dim/30 text-grimoire-text'
                                        : 'bg-grimoire-raised border-grimoire-accent-dim/10 text-grimoire-muted opacity-40 line-through'"
                                >
                                    {{ value }}
                                </span>
                            </template>
                        </div>

                        <div
                            v-for="ability in ABILITY_KEYS"
                            :key="ability"
                            class="flex items-center gap-3"
                        >
                            <span class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted w-12">{{ ability }}</span>

                            <div class="flex flex-wrap gap-2 flex-1">
                                <button
                                    v-for="value in STANDARD_ARRAY"
                                    :key="value"
                                    type="button"
                                    class="w-12 h-12 rounded-sm text-sm font-mono transition-all duration-150 border"
                                    :class="[
                                        abilityAssignments[ability] === value
                                            ? 'bg-grimoire-accent border-grimoire-accent text-grimoire-bg font-bold'
                                            : isValueAvailable(value) || abilityAssignments[ability] === value
                                                ? 'bg-grimoire-surface border-grimoire-accent-dim/20 hover:border-grimoire-accent-dim/50 text-grimoire-text'
                                                : 'bg-grimoire-raised border-grimoire-accent-dim/10 text-grimoire-muted/30 cursor-not-allowed',
                                    ]"
                                    :disabled="!isValueAvailable(value) && abilityAssignments[ability] !== value"
                                    @click="abilityAssignments[ability] === value
                                        ? clearAbility(ability)
                                        : assignValue(ability, value)"
                                >
                                    {{ value }}
                                </button>
                            </div>

                            <div class="w-20 text-right font-mono text-sm">
                                <span v-if="abilityAssignments[ability] !== null"
                                    class="text-grimoire-text">
                                    {{ abilityAssignments[ability] }}
                                    <span class="text-grimoire-muted">({{ abilityModifier(abilityAssignments[ability]) }})</span>
                                </span>

                                <span v-else
                                    class="text-grimoire-muted/30">—</span>
                            </div>
                        </div>

                        <u-alert v-if="submitError"
                            color="error"
                            variant="soft"
                            :description="submitError" />
                    </div>

                    <div class="flex gap-4 items-center">
                        <button
                            type="button"
                            class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted
                                   hover:text-grimoire-text transition-colors duration-150"
                            @click="step = 'charClass'"
                        >
                            ← Back
                        </button>

                        <button
                            type="button"
                            class="flex-1 py-3 bg-grimoire-accent text-grimoire-bg font-['Cinzel',serif]
                                   text-sm tracking-widest uppercase hover:bg-grimoire-accent/90
                                   transition-colors duration-200 disabled:opacity-50"
                            :disabled="!allAssigned || submitting"
                            @click="submitCharacter"
                        >
                            {{ submitting ? 'Inscribing...' : 'Create hero' }}
                        </button>
                    </div>
                </div>
            </template>

            <!-- ── Campaign setup steps ──────────────────────────────────────────── -->
            <template v-else>
                <!-- Step: Tone + Death Mode -->
                <div v-if="step === 'tone'" class="space-y-8">
                    <div>
                        <h2 class="font-['IM_Fell_English',serif] text-3xl text-grimoire-text">The shape of your story</h2>

                        <p class="font-['Cinzel',serif] text-xs tracking-wider uppercase text-grimoire-muted mt-2">
                            Choose the tone and stakes for your adventure
                        </p>
                    </div>

                    <div class="space-y-6">
                        <div>
                            <p class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted mb-3">Campaign Tone</p>

                            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <button
                                    v-for="tone in TONES"
                                    :key="tone.value"
                                    type="button"
                                    class="p-4 rounded-sm border text-left transition-all duration-200"
                                    :class="selectedTone === tone.value
                                        ? 'border-grimoire-accent bg-grimoire-accent/8'
                                        : 'border-grimoire-accent-dim/20 bg-grimoire-surface hover:border-grimoire-accent-dim/50'"
                                    @click="selectedTone = tone.value"
                                >
                                    <div class="font-['IM_Fell_English',serif] text-base text-grimoire-text">{{ tone.label }}</div>

                                    <div class="font-['Cinzel',serif] text-xs text-grimoire-muted mt-1 tracking-wider">{{ tone.description }}</div>
                                </button>
                            </div>
                        </div>

                        <div>
                            <p class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted mb-3">Death Mode</p>

                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <button
                                    v-for="mode in DEATH_MODES"
                                    :key="mode.value"
                                    type="button"
                                    class="p-4 rounded-sm border text-left transition-all duration-200"
                                    :class="selectedDeathMode === mode.value
                                        ? mode.value === 'PERMADEATH'
                                            ? 'border-red-800/50 bg-red-950/30'
                                            : 'border-grimoire-accent bg-grimoire-accent/8'
                                        : mode.value === 'PERMADEATH'
                                            ? 'border-grimoire-accent-dim/20 bg-grimoire-surface hover:border-red-900/50 hover:bg-grimoire-combat/20'
                                            : 'border-grimoire-accent-dim/20 bg-grimoire-surface hover:border-grimoire-accent-dim/50'"
                                    @click="selectedDeathMode = mode.value"
                                >
                                    <div class="font-['IM_Fell_English',serif] text-base text-grimoire-text">{{ mode.label }}</div>

                                    <div class="font-['Cinzel',serif] text-xs text-grimoire-muted mt-1 tracking-wider">{{ mode.description }}</div>
                                </button>
                            </div>
                        </div>

                        <u-alert v-if="submitError"
                            color="error"
                            variant="soft"
                            :description="submitError" />
                    </div>

                    <button
                        type="button"
                        class="w-full py-3 bg-grimoire-accent text-grimoire-bg font-['Cinzel',serif]
                               text-sm tracking-widest uppercase hover:bg-grimoire-accent/90
                               transition-colors duration-200 disabled:opacity-50"
                        :disabled="!selectedTone || !selectedDeathMode || submitting"
                        @click="submitGenerateConcepts"
                    >
                        {{ submitting ? 'Weaving the strands...' : 'Generate story concepts' }}
                    </button>
                </div>

                <!-- Step: Concept selection -->
                <div v-else-if="step === 'concepts'" class="space-y-8">
                    <div>
                        <h2 class="font-['IM_Fell_English',serif] text-3xl text-grimoire-text">Three tales await</h2>

                        <p class="font-['Cinzel',serif] text-xs tracking-wider uppercase text-grimoire-muted mt-2">
                            Select the story that calls to you
                        </p>
                    </div>

                    <div class="space-y-4">
                        <div
                            v-for="(concept, i) in (campaign?.generatedConcepts as StoryConcept[] ?? [])"
                            :key="i"
                            class="p-6 border rounded-sm cursor-pointer transition-all duration-200 space-y-3"
                            :class="selectedConceptIndex === i
                                ? 'border-grimoire-accent bg-grimoire-accent/10 shadow-[0_0_24px_color-mix(in_srgb,#c8922a_8%,transparent)]'
                                : 'border-grimoire-accent-dim/20 bg-grimoire-surface hover:border-grimoire-accent-dim/50 hover:bg-grimoire-raised'"
                            @click="selectedConceptIndex = i"
                        >
                            <!-- Roman numeral -->
                            <span class="font-['Cinzel',serif] text-xs tracking-[0.4em] uppercase text-grimoire-accent-dim">
                                {{ ['I', 'II', 'III'][i] }}
                            </span>

                            <!-- Premise -->
                            <p class="font-['IM_Fell_English',serif] text-[1.125rem] leading-relaxed text-grimoire-text">
                                {{ concept.premise }}
                            </p>

                            <!-- Conflict -->
                            <div>
                                <span class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted mr-2">Conflict</span>
                                <span class="font-['IM_Fell_English',serif] text-sm text-grimoire-text/80">{{ concept.centralConflict }}</span>
                            </div>

                            <!-- Antagonist hint -->
                            <p class="font-['IM_Fell_English',serif] italic text-sm text-grimoire-muted border-t border-grimoire-accent-dim/20 pt-3 mt-1 pl-3 border-l-2 border-l-grimoire-accent-dim/30">
                                {{ concept.antagonistHint }}
                            </p>
                        </div>
                    </div>

                    <u-alert v-if="submitError"
                        class="mt-4"
                        color="error"
                        variant="soft"
                        :description="submitError" />

                    <button
                        type="button"
                        class="w-full py-3 bg-grimoire-accent text-grimoire-bg font-['Cinzel',serif]
                               text-sm tracking-widest uppercase hover:bg-grimoire-accent/90
                               transition-colors duration-200 disabled:opacity-50"
                        :disabled="selectedConceptIndex === null || submitting"
                        @click="submitSelectConcept"
                    >
                        {{ submitting ? 'Sealing the pact...' : 'Choose this story' }}
                    </button>
                </div>

                <!-- Step: World generation -->
                <div v-else-if="step === 'worldGen'" class="space-y-8">
                    <div>
                        <h2 class="font-['IM_Fell_English',serif] text-3xl text-grimoire-text">Forge the world</h2>

                        <p class="font-['Cinzel',serif] text-xs tracking-wider uppercase text-grimoire-muted mt-2">
                            The DM will breathe life into your chronicle
                        </p>
                    </div>

                    <div class="space-y-4">
                        <p class="font-['IM_Fell_English',serif] text-[1.125rem] leading-relaxed text-grimoire-text">
                            The DM will breathe life into your world — carving out locations, seeding factions with
                            hidden agendas, placing NPCs into motion, and setting the antagonist's first moves
                            before you draw your first breath.
                        </p>

                        <p class="font-['IM_Fell_English',serif] italic text-sm text-grimoire-muted">
                            This may take a moment. The world does not form lightly.
                        </p>
                    </div>

                    <u-alert v-if="submitError"
                        color="error"
                        variant="soft"
                        :description="submitError" />

                    <!-- Loading state replaces button -->
                    <div v-if="submitting"
                        class="flex flex-col items-center gap-4 py-8">
                        <span class="w-3 h-3 rounded-full bg-grimoire-accent grimoire-breathe" />
                        <p class="font-['IM_Fell_English',serif] italic text-lg text-grimoire-muted">
                            The world takes shape...
                        </p>
                    </div>

                    <button
                        v-else
                        type="button"
                        class="w-full py-3 bg-grimoire-accent text-grimoire-bg font-['Cinzel',serif]
                               text-sm tracking-widest uppercase hover:bg-grimoire-accent/90
                               transition-colors duration-200"
                        @click="submitGenerateWorldSeed"
                    >
                        Forge the world
                    </button>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useQuery, useMutation } from '@urql/vue';

interface StoryConcept {
    index: number
    premise: string
    centralConflict: string
    antagonistHint: string
}

const route = useRoute();
const router = useRouter();
const campaignId = computed(() => route.params.id as string);

// ── Campaign state query ───────────────────────────────────────────────────────
const CAMPAIGN_QUERY = `
  query Campaign($id: ID!) {
    campaign(id: $id) {
      id
      name
      setupStatus
      hasCharacter
      tone
      deathMode
      generatedConcepts
      selectedConcept
      inGameDate
    }
  }
`;

const { data: campaignData, fetching: campaignFetching, error: campaignError, executeQuery: refetchCampaign } = useQuery({
    query: CAMPAIGN_QUERY,
    variables: computed(() => ({ id: campaignId.value })),
});

const campaign = computed(() => campaignData.value?.campaign);

// ── Wizard step logic ──────────────────────────────────────────────────────────
type WizardStep
    = | 'charName' | 'charRace' | 'charClass' | 'charAbilities'
    | 'tone' | 'concepts' | 'worldGen';

const step = ref<WizardStep>('charName');

watch(campaign, (camp) => {
    if (!camp) return;

    if (!camp.hasCharacter) {
        step.value = 'charName';
        return;
    }

    switch (camp.setupStatus) {
        case 'DRAFT':
            step.value = 'tone';
            break;
        case 'CONCEPTS_GENERATED':
            step.value = camp.selectedConcept ? 'worldGen' : 'concepts';
            break;
        default:
            step.value = 'tone';
    }
}, { immediate: true });

const wizardStepLabels = computed(() => {
    const labels = ['Hero', 'Tone', 'Story', 'World'];
    return campaign.value?.hasCharacter ? labels.slice(1) : labels;
});

const wizardStepIndex = computed(() => {
    const labeledSteps = campaign.value?.hasCharacter
        ? ['tone', 'concepts', 'worldGen'] as WizardStep[]
        : ['charName', 'tone', 'concepts', 'worldGen'] as WizardStep[];

    const currentKey = (step.value === 'charRace' || step.value === 'charClass' || step.value === 'charAbilities')
        ? 'charName'
        : step.value;

    return labeledSteps.indexOf(currentKey as WizardStep);
});

// ── Character creation state ───────────────────────────────────────────────────
const charName = ref('');
const charNameError = ref('');
const selectedRaceId = ref<string | null>(null);
const selectedClassId = ref<string | null>(null);

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
const ABILITY_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
type AbilityKey = typeof ABILITY_KEYS[number];

/* eslint-disable @typescript-eslint/naming-convention */
const abilityAssignments = ref<Record<AbilityKey, number | null>>({
    STR: null, DEX: null, CON: null, INT: null, WIS: null, CHA: null,
});
/* eslint-enable @typescript-eslint/naming-convention */

const usedValues = computed(() =>
    Object.values(abilityAssignments.value).filter((v): v is number => v !== null),
);

function isValueAvailable(value: number): boolean {
    const usedCount = usedValues.value.filter((v) => v === value).length;
    return usedCount < STANDARD_ARRAY.filter((v) => v === value).length;
}

function assignValue(ability: AbilityKey, value: number): void {
    if (!isValueAvailable(value)) return;
    abilityAssignments.value[ability] = value;
}

function clearAbility(ability: AbilityKey): void {
    abilityAssignments.value[ability] = null;
}

const allAssigned = computed(() => ABILITY_KEYS.every((k) => abilityAssignments.value[k] !== null));

function abilityModifier(score: number | null): string {
    if (score === null) return '—';
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : String(mod);
}

// ── SRD data queries (lazy) ────────────────────────────────────────────────────
const SRD_RACES_QUERY = `query SrdRaces { srdRaces(first: 50) { edges { node { id name traits abilityBonuses } } } }`;
const SRD_CLASSES_QUERY = `query SrdClasses { srdClasses(first: 50) { edges { node { id name hitDie spellcastingAbility } } } }`;

const { data: racesData, fetching: racesFetching } = useQuery({
    query: SRD_RACES_QUERY,
    pause: computed(() => step.value !== 'charRace'),
});
const races = computed(() => racesData.value?.srdRaces?.edges?.map((e: { node: Record<string, unknown> }) => e.node) ?? []);

const { data: classesData, fetching: classesFetching } = useQuery({
    query: SRD_CLASSES_QUERY,
    pause: computed(() => step.value !== 'charClass'),
});
const classes = computed(() => classesData.value?.srdClasses?.edges?.map((e: { node: Record<string, unknown> }) => e.node) ?? []);

// ── Step navigation ────────────────────────────────────────────────────────────
function nextStep(): void {
    if (step.value === 'charName') {
        if (!charName.value.trim()) { charNameError.value = 'Name is required'; return; }
        step.value = 'charRace';
    } else if (step.value === 'charRace' && selectedRaceId.value) {
        step.value = 'charClass';
    } else if (step.value === 'charClass' && selectedClassId.value) {
        step.value = 'charAbilities';
    }
}

// ── Mutations ──────────────────────────────────────────────────────────────────
const CREATE_CHARACTER_MUTATION = `
  mutation CreateCharacter($input: CreateCharacterInput!) {
    createCharacter(input: $input) { id }
  }
`;
const GENERATE_CONCEPTS_MUTATION = `
  mutation GenerateCampaignStoryConcepts($input: GenerateConceptsInput!) {
    generateCampaignStoryConcepts(input: $input) { id setupStatus generatedConcepts hasCharacter tone deathMode selectedConcept }
  }
`;
const SELECT_CONCEPT_MUTATION = `
  mutation SelectCampaignStoryConcept($input: SelectConceptInput!) {
    selectCampaignStoryConcept(input: $input) { id setupStatus selectedConcept hasCharacter generatedConcepts tone deathMode }
  }
`;
const GENERATE_WORLD_SEED_MUTATION = `
  mutation GenerateCampaignWorldSeed($input: GenerateWorldSeedInput!) {
    generateCampaignWorldSeed(input: $input) { id setupStatus }
  }
`;

const { executeMutation: execCreateCharacter } = useMutation(CREATE_CHARACTER_MUTATION);
const { executeMutation: execGenerateConcepts } = useMutation(GENERATE_CONCEPTS_MUTATION);
const { executeMutation: execSelectConcept } = useMutation(SELECT_CONCEPT_MUTATION);
const { executeMutation: execGenerateWorldSeed } = useMutation(GENERATE_WORLD_SEED_MUTATION);

const submitting = ref(false);
const submitError = ref('');

async function submitCharacter(): Promise<void> {
    if (!allAssigned.value) return;
    submitting.value = true;
    submitError.value = '';

    try {
        const result = await execCreateCharacter({
            input: {
                name: charName.value.trim(),
                raceId: selectedRaceId.value,
                classId: selectedClassId.value,
                campaignId: Number(campaignId.value),
                /* eslint-disable @typescript-eslint/naming-convention */
                abilityScores: {
                    STR: abilityAssignments.value.STR,
                    DEX: abilityAssignments.value.DEX,
                    CON: abilityAssignments.value.CON,
                    INT: abilityAssignments.value.INT,
                    WIS: abilityAssignments.value.WIS,
                    CHA: abilityAssignments.value.CHA,
                },
                /* eslint-enable @typescript-eslint/naming-convention */
            },
        });

        if (result.error) {
            submitError.value = result.error.graphQLErrors[0]?.message ?? 'Character creation failed';
            return;
        }

        await refetchCampaign({ requestPolicy: 'network-only' });
        step.value = 'tone';
    } finally {
        submitting.value = false;
    }
}

// ── Campaign tone + death mode ─────────────────────────────────────────────────
const TONES = [
    { value: 'HEROIC', label: 'Heroic', description: 'Classic high fantasy adventure' },
    { value: 'DARK', label: 'Dark', description: 'Grim, morally complex world' },
    { value: 'COMEDIC', label: 'Comedic', description: 'Light-hearted and humorous' },
    { value: 'GRITTY', label: 'Gritty', description: 'Low magic, realistic stakes' },
    { value: 'EPIC', label: 'Epic', description: 'World-altering stakes and legends' },
];

const DEATH_MODES = [
    { value: 'STANDARD', label: 'Standard', description: 'Death saves with recovery possible' },
    { value: 'HARDCORE', label: 'Hardcore', description: 'No recovery from 0 HP without magic' },
    { value: 'PERMADEATH', label: 'Permadeath', description: 'Death is permanent' },
];

const selectedTone = ref<string | null>(null);
const selectedDeathMode = ref<string | null>(null);

watch(campaign, (camp) => {
    if (camp?.tone && !selectedTone.value) selectedTone.value = camp.tone as string;
    if (camp?.deathMode && !selectedDeathMode.value) selectedDeathMode.value = camp.deathMode as string;
}, { immediate: true });

async function submitGenerateConcepts(): Promise<void> {
    if (!selectedTone.value || !selectedDeathMode.value) return;
    submitting.value = true;
    submitError.value = '';

    try {
        const result = await execGenerateConcepts({
            input: {
                campaignId: campaignId.value,
                tone: selectedTone.value,
                deathMode: selectedDeathMode.value,
            },
        });

        if (result.error) {
            submitError.value = result.error.graphQLErrors[0]?.message ?? 'Concept generation failed';
            return;
        }

        await refetchCampaign({ requestPolicy: 'network-only' });
        step.value = 'concepts';
    } finally {
        submitting.value = false;
    }
}

// ── Concept selection ──────────────────────────────────────────────────────────
const selectedConceptIndex = ref<number | null>(null);

async function submitSelectConcept(): Promise<void> {
    if (selectedConceptIndex.value === null) return;
    submitting.value = true;
    submitError.value = '';

    try {
        const result = await execSelectConcept({
            input: {
                campaignId: campaignId.value,
                conceptIndex: selectedConceptIndex.value,
            },
        });

        if (result.error) {
            submitError.value = result.error.graphQLErrors[0]?.message ?? 'Concept selection failed';
            return;
        }

        await refetchCampaign({ requestPolicy: 'network-only' });
        step.value = 'worldGen';
    } finally {
        submitting.value = false;
    }
}

// ── World seed generation ──────────────────────────────────────────────────────
async function submitGenerateWorldSeed(): Promise<void> {
    if (submitting.value) return;
    submitting.value = true;
    submitError.value = '';

    try {
        const result = await execGenerateWorldSeed({ input: { campaignId: campaignId.value } });

        if (result.error) {
            const msg = result.error.graphQLErrors[0]?.message ?? 'World generation failed';
            try {
                const parsed = JSON.parse(msg) as { message?: string };
                submitError.value = parsed.message ?? msg;
            } catch {
                submitError.value = msg;
            }
            return;
        }

        await refetchCampaign({ requestPolicy: 'network-only' });
        await router.push(`/campaign/${campaignId.value}/play`);
    } finally {
        submitting.value = false;
    }
}
</script>
