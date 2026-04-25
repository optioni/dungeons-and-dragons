import { Injectable } from '@nestjs/common';

import { type ToolResult } from '../../llm/tool-registry.js';
import { WorldMutationService } from '../world-mutation.service.js';

/** Creates a named NPC mid-session and returns the new NPC's ID. */
@Injectable()
export class CreateNpcHandler {
    constructor(private readonly world: WorldMutationService) {}

    async execute(
        campaignId: number,
        input: {
            name: string
            description?: string | null
            profession?: string | null
            disposition?: string | null
            personality_traits?: string[]
            speech_style?: string | null
            core_motivation?: string | null
            agenda?: string | null
            current_location_id?: number | null
        },
    ): Promise<ToolResult> {
        return this.world.createNpc(campaignId, {
            name: input.name,
            description: input.description ?? null,
            profession: input.profession ?? null,
            disposition: input.disposition ?? null,
            personalityTraits: Array.isArray(input.personality_traits) ? input.personality_traits : [],
            speechStyle: input.speech_style ?? null,
            coreMotivation: input.core_motivation ?? null,
            agenda: input.agenda ?? null,
            currentLocationId: input.current_location_id === undefined ? null : (input.current_location_id ?? null),
        });
    }
}
