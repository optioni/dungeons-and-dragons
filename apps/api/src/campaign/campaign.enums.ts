import { registerEnumType } from '@nestjs/graphql';

export enum CampaignStatus {
    ACTIVE = 'ACTIVE',
    ENDED = 'ENDED',
}

export enum CampaignSetupStatus {
    DRAFT = 'DRAFT',
    CONCEPTS_GENERATED = 'CONCEPTS_GENERATED',
    READY_TO_PLAY = 'READY_TO_PLAY',
}

export enum CampaignTone {
    DARK = 'DARK',
    HEROIC = 'HEROIC',
    COMEDIC = 'COMEDIC',
    GRITTY = 'GRITTY',
    EPIC = 'EPIC',
}

export enum DeathMode {
    STANDARD = 'STANDARD',
    PERMADEATH = 'PERMADEATH',
    HARDCORE = 'HARDCORE',
}

registerEnumType(CampaignStatus, { name: 'CampaignStatus' });
registerEnumType(CampaignSetupStatus, { name: 'CampaignSetupStatus' });
registerEnumType(CampaignTone, { name: 'CampaignTone' });
registerEnumType(DeathMode, { name: 'DeathMode' });

/** A single AI-generated story concept shown to the player during setup. */
export interface StoryConcept {
    index: number
    premise: string
    centralConflict: string
    antagonistHint: string
}

/** Structured state tracking the antagonist's plan progression. */
export interface AntagonistPlanState {
    currentStage: string
    stages: Array<{
        name: string
        description: string
        completed: boolean
    }>
}

/** Bootstrap narrative seed used to generate the first GameEvent when a session starts. */
export interface OpeningSceneSeed {
    narrativeHook: string
    locationDescription: string
    initialTension: string
}
