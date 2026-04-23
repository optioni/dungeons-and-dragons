<template>
    <div class="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <!-- Loading campaign state -->
        <div v-if="campaignFetching"
            class="flex items-center gap-3 text-gray-400">
            <u-icon name="i-lucide-loader-circle"
                class="animate-spin text-2xl" />
            Loading...
        </div>

        <!-- Error loading campaign -->
        <u-alert v-else-if="campaignError"
            class="max-w-md w-full"
            color="error"
            variant="soft"
            description="Failed to load campaign. Please refresh." />

        <!-- Ready to play — redirect -->
        <div v-else-if="campaign?.setupStatus === 'READY_TO_PLAY'"
            class="max-w-md w-full text-center space-y-4">
            <u-icon name="i-lucide-check-circle"
                class="text-6xl text-green-400 mx-auto block" />

            <h2 class="text-2xl font-bold text-white">Campaign is ready!</h2>

            <p class="text-gray-400">Your adventure awaits.</p>

            <u-button block
                icon="i-lucide-play"
                @click="router.push('/')">
                Go to Dashboard
            </u-button>
        </div>

        <!-- Setup wizard -->
        <div v-else
            class="w-full max-w-2xl space-y-6">
            <!-- Progress indicator -->
            <div class="flex items-center justify-between mb-6">
                <template v-for="(label, i) in wizardStepLabels"
                    :key="i">
                    <div class="flex flex-col items-center gap-1">
                        <div
                            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                            :class="wizardStepIndex > i
                                ? 'bg-primary-500 text-white'
                                : wizardStepIndex === i
                                    ? 'bg-primary-600 text-white ring-2 ring-primary-400'
                                    : 'bg-gray-800 text-gray-500'"
                        >
                            <u-icon v-if="wizardStepIndex > i"
                                name="i-lucide-check"
                                class="text-xs" />

                            <span v-else>{{ i + 1 }}</span>
                        </div>

                        <span class="text-xs text-gray-400 hidden sm:block">{{ label }}</span>
                    </div>

                    <div v-if="i < wizardStepLabels.length - 1"
                        class="flex-1 h-px bg-gray-700 mx-2" />
                </template>
            </div>

            <!-- ── Character creation steps (shown when no character yet) ────────── -->
            <template v-if="!campaign?.hasCharacter">
                <!-- Step 1: Character name -->
                <u-card v-if="step === 'charName'">
                    <template #header>
                        <h2 class="text-xl font-semibold">Name your character</h2>
                    </template>

                    <u-form class="space-y-4"
                        @submit.prevent="nextStep">
                        <u-form-field label="Character name"
                            name="name">
                            <u-input
                                v-model="charName"
                                placeholder="Enter a name..."
                                @input="charNameError = ''"
                            />
                        </u-form-field>

                        <u-alert v-if="charNameError"
                            color="error"
                            variant="soft"
                            :description="charNameError" />

                        <u-button type="submit"
                            block
                            :disabled="!charName.trim()">
                            Continue
                        </u-button>
                    </u-form>
                </u-card>

                <!-- Step 2: Race selection -->
                <u-card v-else-if="step === 'charRace'">
                    <template #header>
                        <h2 class="text-xl font-semibold">Choose a race</h2>
                    </template>

                    <div v-if="racesFetching"
                        class="flex justify-center py-8">
                        <u-icon name="i-lucide-loader-circle"
                            class="animate-spin text-2xl" />
                    </div>

                    <div v-else
                        class="grid grid-cols-2 gap-3">
                        <button
                            v-for="race in races"
                            :key="race.id as string"
                            type="button"
                            class="text-left p-4 rounded-lg border transition-colors"
                            :class="selectedRaceId === race.id
                                ? 'border-primary-500 bg-primary-950'
                                : 'border-gray-700 bg-gray-900 hover:border-gray-500'"
                            @click="selectedRaceId = race.id as string"
                        >
                            <div class="font-semibold">{{ race.name }}</div>

                            <div v-if="(race.traits as string[]).length"
                                class="text-xs text-gray-400 mt-1 line-clamp-2">
                                {{ (race.traits as string[]).slice(0, 3).join(', ') }}
                            </div>
                        </button>
                    </div>

                    <template #footer>
                        <div class="flex gap-3">
                            <u-button variant="ghost"
                                @click="step = 'charName'">
                                Back
                            </u-button>

                            <u-button class="flex-1"
                                :disabled="!selectedRaceId"
                                @click="nextStep">
                                Continue
                            </u-button>
                        </div>
                    </template>
                </u-card>

                <!-- Step 3: Class selection -->
                <u-card v-else-if="step === 'charClass'">
                    <template #header>
                        <h2 class="text-xl font-semibold">Choose a class</h2>
                    </template>

                    <div v-if="classesFetching"
                        class="flex justify-center py-8">
                        <u-icon name="i-lucide-loader-circle"
                            class="animate-spin text-2xl" />
                    </div>

                    <div v-else
                        class="grid grid-cols-2 gap-3">
                        <button
                            v-for="cls in classes"
                            :key="cls.id as string"
                            type="button"
                            class="text-left p-4 rounded-lg border transition-colors"
                            :class="selectedClassId === cls.id
                                ? 'border-primary-500 bg-primary-950'
                                : 'border-gray-700 bg-gray-900 hover:border-gray-500'"
                            @click="selectedClassId = cls.id as string"
                        >
                            <div class="font-semibold">{{ cls.name }}</div>

                            <div class="text-xs text-gray-400 mt-1">
                                Hit Die: d{{ cls.hitDie }}
                                <span v-if="cls.spellcastingAbility"
                                    class="ml-2">· Spellcaster</span>
                            </div>
                        </button>
                    </div>

                    <template #footer>
                        <div class="flex gap-3">
                            <u-button variant="ghost"
                                @click="step = 'charRace'">
                                Back
                            </u-button>

                            <u-button class="flex-1"
                                :disabled="!selectedClassId"
                                @click="nextStep">
                                Continue
                            </u-button>
                        </div>
                    </template>
                </u-card>

                <!-- Step 4: Ability scores -->
                <u-card v-else-if="step === 'charAbilities'">
                    <template #header>
                        <h2 class="text-xl font-semibold">Assign ability scores</h2>

                        <p class="text-sm text-gray-400 mt-1">
                            Assign each value from the standard array to a score.
                        </p>
                    </template>

                    <div class="space-y-4">
                        <div class="flex flex-wrap gap-2 pb-4 border-b border-gray-700">
                            <span class="text-sm text-gray-400 w-full">Available values:</span>

                            <template v-for="value in STANDARD_ARRAY"
                                :key="value">
                                <span
                                    class="px-3 py-1 rounded-full text-sm font-mono font-bold transition-colors"
                                    :class="isValueAvailable(value)
                                        ? 'bg-primary-900 text-primary-200 border border-primary-600'
                                        : 'bg-gray-800 text-gray-600 line-through'"
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
                            <span class="w-10 font-mono font-bold text-gray-300">{{ ability }}</span>

                            <div class="flex flex-wrap gap-2 flex-1">
                                <button
                                    v-for="value in STANDARD_ARRAY"
                                    :key="value"
                                    type="button"
                                    class="w-10 h-10 rounded text-sm font-mono font-bold transition-colors border"
                                    :class="[
                                        abilityAssignments[ability] === value
                                            ? 'bg-primary-600 border-primary-400 text-white'
                                            : isValueAvailable(value) || abilityAssignments[ability] === value
                                                ? 'bg-gray-800 border-gray-600 hover:border-primary-500 hover:bg-gray-700 text-gray-200'
                                                : 'bg-gray-900 border-gray-800 text-gray-700 cursor-not-allowed',
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
                                    class="text-white font-bold">
                                    {{ abilityAssignments[ability] }}
                                    <span class="text-gray-400">({{ abilityModifier(abilityAssignments[ability]) }})</span>
                                </span>

                                <span v-else
                                    class="text-gray-600">—</span>
                            </div>
                        </div>

                        <u-alert v-if="submitError"
                            color="error"
                            variant="soft"
                            :description="submitError" />
                    </div>

                    <template #footer>
                        <div class="flex gap-3">
                            <u-button variant="ghost"
                                @click="step = 'charClass'">
                                Back
                            </u-button>

                            <u-button
                                class="flex-1"
                                :disabled="!allAssigned"
                                :loading="submitting"
                                @click="submitCharacter">
                                Create character
                            </u-button>
                        </div>
                    </template>
                </u-card>
            </template>

            <!-- ── Campaign setup steps (shown after character exists) ─────────── -->
            <template v-else>
                <!-- Step: Tone + Death Mode → generate concepts -->
                <u-card v-if="step === 'tone'">
                    <template #header>
                        <h2 class="text-xl font-semibold">Set the stage</h2>

                        <p class="text-sm text-gray-400 mt-1">
                            Choose the tone and stakes for your adventure.
                        </p>
                    </template>

                    <div class="space-y-6">
                        <div>
                            <p class="text-sm font-medium text-gray-300 mb-3">Campaign Tone</p>

                            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <button
                                    v-for="tone in TONES"
                                    :key="tone.value"
                                    type="button"
                                    class="p-3 rounded-lg border text-left transition-colors"
                                    :class="selectedTone === tone.value
                                        ? 'border-primary-500 bg-primary-950'
                                        : 'border-gray-700 bg-gray-900 hover:border-gray-500'"
                                    @click="selectedTone = tone.value"
                                >
                                    <div class="font-semibold text-sm">{{ tone.label }}</div>

                                    <div class="text-xs text-gray-400 mt-1">{{ tone.description }}</div>
                                </button>
                            </div>
                        </div>

                        <div>
                            <p class="text-sm font-medium text-gray-300 mb-3">Death Mode</p>

                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <button
                                    v-for="mode in DEATH_MODES"
                                    :key="mode.value"
                                    type="button"
                                    class="p-3 rounded-lg border text-left transition-colors"
                                    :class="selectedDeathMode === mode.value
                                        ? 'border-primary-500 bg-primary-950'
                                        : 'border-gray-700 bg-gray-900 hover:border-gray-500'"
                                    @click="selectedDeathMode = mode.value"
                                >
                                    <div class="font-semibold text-sm">{{ mode.label }}</div>

                                    <div class="text-xs text-gray-400 mt-1">{{ mode.description }}</div>
                                </button>
                            </div>
                        </div>

                        <u-alert v-if="submitError"
                            color="error"
                            variant="soft"
                            :description="submitError" />
                    </div>

                    <template #footer>
                        <u-button
                            block
                            :disabled="!selectedTone || !selectedDeathMode"
                            :loading="submitting"
                            @click="submitGenerateConcepts">
                            Generate story concepts
                        </u-button>
                    </template>
                </u-card>

                <!-- Step: Concept selection -->
                <u-card v-else-if="step === 'concepts'">
                    <template #header>
                        <h2 class="text-xl font-semibold">Choose your story</h2>

                        <p class="text-sm text-gray-400 mt-1">
                            Select the concept that excites you most.
                        </p>
                    </template>

                    <div class="space-y-3">
                        <button
                            v-for="(concept, i) in (campaign?.generatedConcepts as StoryConcept[] ?? [])"
                            :key="i"
                            type="button"
                            class="w-full text-left p-4 rounded-lg border transition-colors"
                            :class="selectedConceptIndex === i
                                ? 'border-primary-500 bg-primary-950'
                                : 'border-gray-700 bg-gray-900 hover:border-gray-500'"
                            @click="selectedConceptIndex = i"
                        >
                            <div class="font-semibold text-white mb-1">
                                Concept {{ i + 1 }}
                            </div>

                            <p class="text-sm text-gray-300">{{ concept.premise }}</p>

                            <p class="text-xs text-gray-400 mt-2">
                                <span class="font-medium">Conflict:</span> {{ concept.centralConflict }}
                            </p>

                            <p class="text-xs text-gray-500 mt-1 italic">
                                {{ concept.antagonistHint }}
                            </p>
                        </button>
                    </div>

                    <u-alert v-if="submitError"
                        class="mt-4"
                        color="error"
                        variant="soft"
                        :description="submitError" />

                    <template #footer>
                        <u-button
                            block
                            :disabled="selectedConceptIndex === null"
                            :loading="submitting"
                            @click="submitSelectConcept">
                            Choose this story
                        </u-button>
                    </template>
                </u-card>

                <!-- Step: World generation -->
                <u-card v-else-if="step === 'worldGen'">
                    <template #header>
                        <h2 class="text-xl font-semibold">Generate your world</h2>

                        <p class="text-sm text-gray-400 mt-1">
                            Claude will build your starting world — locations, factions, NPCs, and the antagonist's first moves.
                        </p>
                    </template>

                    <div class="py-4 space-y-3">
                        <div class="flex items-start gap-3 text-sm text-gray-300">
                            <u-icon name="i-lucide-map-pin"
                                class="mt-0.5 text-primary-400 flex-shrink-0" />
                            3-5 locations to explore
                        </div>

                        <div class="flex items-start gap-3 text-sm text-gray-300">
                            <u-icon name="i-lucide-shield"
                                class="mt-0.5 text-primary-400 flex-shrink-0" />
                            2-3 factions with agendas
                        </div>

                        <div class="flex items-start gap-3 text-sm text-gray-300">
                            <u-icon name="i-lucide-users"
                                class="mt-0.5 text-primary-400 flex-shrink-0" />
                            3-5 key NPCs, including the antagonist
                        </div>

                        <div class="flex items-start gap-3 text-sm text-gray-300">
                            <u-icon name="i-lucide-zap"
                                class="mt-0.5 text-primary-400 flex-shrink-0" />
                            An active world event already in motion
                        </div>
                    </div>

                    <u-alert v-if="submitError"
                        color="error"
                        variant="soft"
                        :description="submitError" />

                    <template #footer>
                        <u-button
                            block
                            :loading="submitting"
                            :disabled="submitting"
                            icon="i-lucide-sparkles"
                            @click="submitGenerateWorldSeed">
                            {{ submitting ? 'Generating world…' : 'Generate world' }}
                        </u-button>
                    </template>
                </u-card>
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

// Derive the initial step from persisted campaign state
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
            // If concept already selected, go to world gen; otherwise show selection
            step.value = camp.selectedConcept ? 'worldGen' : 'concepts';
            break;
        default:
            step.value = 'tone';
    }
}, { immediate: true });

const wizardStepLabels = computed(() => {
    const labels = ['Character', 'Tone', 'Story', 'World'];
    return campaign.value?.hasCharacter ? labels.slice(1) : labels;
});

const wizardStepIndex = computed(() => {
    const allSteps: WizardStep[] = ['charName', 'charRace', 'charClass', 'charAbilities', 'tone', 'concepts', 'worldGen'];
    const labeledSteps = campaign.value?.hasCharacter
        ? ['tone', 'concepts', 'worldGen'] as WizardStep[]
        : ['charName', 'tone', 'concepts', 'worldGen'] as WizardStep[];

    return labeledSteps.indexOf(step.value === 'charRace' || step.value === 'charClass' || step.value === 'charAbilities' ? 'charName' : step.value);
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

// Restore tone from campaign if returning to this step
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
    if (submitting.value) return; // Block duplicate submission
    submitting.value = true;
    submitError.value = '';

    try {
        const result = await execGenerateWorldSeed({ input: { campaignId: campaignId.value } });

        if (result.error) {
            const msg = result.error.graphQLErrors[0]?.message ?? 'World generation failed';
            // Try to parse structured error
            try {
                const parsed = JSON.parse(msg) as { message?: string };
                submitError.value = parsed.message ?? msg;
            } catch {
                submitError.value = msg;
            }
            return;
        }

        await refetchCampaign({ requestPolicy: 'network-only' });
        // Redirect handled by template (READY_TO_PLAY shows the complete screen)
    } finally {
        submitting.value = false;
    }
}
</script>
