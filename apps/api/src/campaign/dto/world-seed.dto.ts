/**
 * Typed DTOs for the structured JSON output produced by the LLM world-seed generation
 * call. These are validated before any database rows are written.
 */

export interface LocationSeedDto {
    name: string;
    description: string;
    currentState?: string;
    coordinates?: { x: number; y: number };
    connectedLocationIndexes?: number[]; // indexes into the locations array
}

export interface MapSeedDto {
    name: string;
    description?: string;
    scale?: string;
    locationIndexes: number[]; // indexes into the locations array
}

export interface FactionSeedDto {
    name: string;
    goals?: string;
    powerLevel?: number;
    playerDisposition?: string;
    territory?: string;
}

export interface NpcRelationshipSeedDto {
    sourceIndex: number;
    targetIndex: number;
    type: string;
    description?: string;
    disposition?: string;
}

export interface NpcItemSeedDto {
    npcIndex: number;
    name: string;
    quantity?: number;
    merchantPrice?: number;
}

export interface NpcSeedDto {
    name: string;
    description?: string;
    profession?: string;
    coreMotivation?: string;
    personalityTraits?: string[];
    speechStyle?: string;
    disposition?: string;
    currentLocationIndex?: number;
    hp?: number;
    maxHp?: number;
    agenda?: string;
    isAntagonist?: boolean;
}

export interface WorldEventSeedDto {
    description: string;
    locationIndex?: number;
    deadlineInGameDate?: string;
    source: 'SETUP';
    isAntagonistEvent?: boolean;
}

export interface OpeningSceneSeedDto {
    narrativeHook: string;
    locationDescription: string;
    initialTension: string;
}

export interface AntagonistPlanStateSeedDto {
    currentStage: string;
    stages: Array<{
        name: string;
        description: string;
        completed: boolean;
    }>;
}

/** The full structured payload returned by the world-seed LLM generation call. */
export interface WorldSeedPayload {
    loreDocument: string;
    inGameDate: string;
    startingLocationIndex: number;
    openingSceneSeed: OpeningSceneSeedDto;
    antagonistPlanState: AntagonistPlanStateSeedDto;
    locations: LocationSeedDto[];
    maps: MapSeedDto[];
    factions: FactionSeedDto[];
    npcs: NpcSeedDto[];
    npcRelationships?: NpcRelationshipSeedDto[];
    npcItems?: NpcItemSeedDto[];
    worldEvents: WorldEventSeedDto[];
}

/** Structured error returned from setup mutation failures. */
export interface SetupStepError {
    step: 'generate_concepts' | 'select_concept' | 'generate_world_seed';
    code: 'VALIDATION_FAILED' | 'LLM_ERROR' | 'UNDERSIZED_SEED' | 'WRONG_STATUS' | 'NO_CHARACTER';
    message: string;
}
