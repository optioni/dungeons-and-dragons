import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { Campaign } from '../campaign/entities/campaign.entity.js';
import { CampaignModule } from '../campaign/campaign.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { Character } from '../character/entities/character.entity.js';
import { GameEvent } from '../session/entities/game-event.entity.js';
import { GameSession } from '../session/entities/game-session.entity.js';
import { NpcItem } from '../world/entities/npc-item.entity.js';
import { ContextLoader } from './context-loader.service.js';
import { PromptModuleRegistry } from './prompt-module-registry.service.js';
import { ToolRegistry } from './tool-registry.service.js';
import { SetSceneTypeHandler } from './tools/set-scene-type.handler.js';

/**
 * Owns DM context assembly, prompt caching, tool dispatch, and Anthropic streaming.
 * Depends on SessionModule (via DmOrchestrator at the service boundary).
 */
@Module({
    imports: [
        MikroOrmModule.forFeature([Campaign, Character, GameEvent, GameSession, NpcItem]),
        CampaignModule,
        MemoryModule,
    ],
    providers: [
        PromptModuleRegistry,
        ContextLoader,
        ToolRegistry,
        SetSceneTypeHandler,
    ],
    exports: [ContextLoader, ToolRegistry, PromptModuleRegistry],
})
export class LlmModule {}
