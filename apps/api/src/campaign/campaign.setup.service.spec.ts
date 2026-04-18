// eslint-disable-next-line import/no-unassigned-import
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import {
    describe, expect, it,
} from 'vitest';

import { CampaignSetupService } from './campaign.setup.service';
import { type WorldSeedPayload } from './dto/world-seed.dto';

function minimalValidSeed(): WorldSeedPayload {
    return {
        loreDocument: 'A kingdom in turmoil.',
        inGameDate: 'Day 1, Month of Frost',
        startingLocationIndex: 0,
        openingSceneSeed: {
            narrativeHook: 'You arrive at the village.',
            locationDescription: 'A modest hamlet.',
            initialTension: 'Smoke rises from the inn.',
        },
        antagonistPlanState: {
            currentStage: 'Gathering Power',
            stages: [
                { name: 'Gathering Power', description: 'Recruiting minions', completed: false },
            ],
        },
        locations: [
            { name: 'Millhaven', description: 'Starting village' },
            { name: 'Dark Forest', description: 'Ominous woods' },
            { name: 'Ironspire', description: 'Fortress city' },
        ],
        maps: [{ name: 'World Map', locationIndexes: [0, 1, 2] }],
        factions: [
            { name: 'Merchants Guild', goals: 'Profit' },
            { name: 'Shadow Cult', goals: 'Domination' },
        ],
        npcs: [
            { name: 'Brom', description: 'Inn keeper', isAntagonist: false },
            { name: 'Lady Morn', description: 'Mayor', isAntagonist: false },
            { name: 'Vex', description: 'The Antagonist', isAntagonist: true },
        ],
        worldEvents: [
            {
                description: 'The antagonist has begun moving',
                source: 'SETUP',
                isAntagonistEvent: true,
            },
        ],
    };
}

describe('CampaignSetupService.validateWorldSeedPayload', () => {
    // Instantiate just for the validation method — no deps needed for pure validation
    const service = { validateWorldSeedPayload: CampaignSetupService.prototype.validateWorldSeedPayload };

    it('passes a valid minimum seed', () => {
        expect(() => service.validateWorldSeedPayload(minimalValidSeed())).not.toThrow();
    });

    it('rejects fewer than 3 locations', () => {
        const seed = minimalValidSeed();
        seed.locations = seed.locations.slice(0, 2);
        expect(() => service.validateWorldSeedPayload(seed)).toThrow(BadRequestException);
    });

    it('rejects more than 5 locations', () => {
        const seed = minimalValidSeed();
        seed.locations = [...Array(6)].map((_, i) => ({ name: `Loc${i}`, description: 'd' }));
        expect(() => service.validateWorldSeedPayload(seed)).toThrow(BadRequestException);
    });

    it('rejects fewer than 2 factions', () => {
        const seed = minimalValidSeed();
        seed.factions = seed.factions.slice(0, 1);
        expect(() => service.validateWorldSeedPayload(seed)).toThrow(BadRequestException);
    });

    it('rejects more than 3 factions', () => {
        const seed = minimalValidSeed();
        seed.factions = [...Array(4)].map((_, i) => ({ name: `F${i}` }));
        expect(() => service.validateWorldSeedPayload(seed)).toThrow(BadRequestException);
    });

    it('rejects fewer than 3 NPCs', () => {
        const seed = minimalValidSeed();
        seed.npcs = seed.npcs.slice(0, 2);
        expect(() => service.validateWorldSeedPayload(seed)).toThrow(BadRequestException);
    });

    it('rejects more than 5 NPCs', () => {
        const seed = minimalValidSeed();
        seed.npcs = [...Array(6)].map((_, i) => ({ name: `NPC${i}` }));
        expect(() => service.validateWorldSeedPayload(seed)).toThrow(BadRequestException);
    });

    it('rejects missing antagonist NPC', () => {
        const seed = minimalValidSeed();
        seed.npcs = seed.npcs.map((n) => ({ ...n, isAntagonist: false }));
        expect(() => service.validateWorldSeedPayload(seed)).toThrow(BadRequestException);
    });

    it('rejects missing antagonist world event', () => {
        const seed = minimalValidSeed();
        seed.worldEvents = seed.worldEvents.map((e) => ({ ...e, isAntagonistEvent: false }));
        expect(() => service.validateWorldSeedPayload(seed)).toThrow(BadRequestException);
    });

    it('rejects missing opening scene seed', () => {
        const seed = minimalValidSeed();
        (seed as Partial<WorldSeedPayload>).openingSceneSeed = undefined;
        expect(() => service.validateWorldSeedPayload(seed as WorldSeedPayload)).toThrow(BadRequestException);
    });

    it('rejects missing lore document', () => {
        const seed = minimalValidSeed();
        seed.loreDocument = '';
        expect(() => service.validateWorldSeedPayload(seed)).toThrow(BadRequestException);
    });

    it('rejects invalid startingLocationIndex', () => {
        const seed = minimalValidSeed();
        seed.startingLocationIndex = 99;
        expect(() => service.validateWorldSeedPayload(seed)).toThrow(BadRequestException);
    });
});
