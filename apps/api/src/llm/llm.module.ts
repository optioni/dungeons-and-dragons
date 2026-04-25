import { MikroOrmModule } from '@mikro-orm/nestjs';
import { forwardRef, Module } from '@nestjs/common';

import { CampaignModule } from '../campaign/campaign.module.js';
import { Campaign } from '../campaign/entities/campaign.entity.js';
import { Character } from '../character/entities/character.entity.js';
import { GameEngineModule } from '../game-engine/game-engine.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { GameEvent } from '../session/entities/game-event.entity.js';
import { GameSession } from '../session/entities/game-session.entity.js';
import { SessionModule } from '../session/session.module.js';
import { LocationItem } from '../world/entities/location-item.entity.js';
import { Location } from '../world/entities/location.entity.js';
import { NpcItem } from '../world/entities/npc-item.entity.js';
import { Npc } from '../world/entities/npc.entity.js';
import { ContextLoader } from './context-loader.service.js';
import { InnerMonologueService } from './inner-monologue.service.js';
import { PromptModuleRegistry } from './prompt-module-registry.service.js';
import { ToolRegistry } from './tool-registry.service.js';
import { SetSceneTypeHandler } from './tools/set-scene-type.handler.js';

/**
 * Owns DM context assembly, prompt caching, tool dispatch, and Anthropic streaming.
 * Depends on SessionModule (via DmOrchestrator at the service boundary).
 */
@Module({
    imports: [
        MikroOrmModule.forFeature([Campaign, Character, GameEvent, GameSession, LocationItem, NpcItem, Location, Npc]),
        forwardRef(() => CampaignModule),
        MemoryModule,
        forwardRef(() => SessionModule),
        forwardRef(() => GameEngineModule),
    ],
    providers: [
        PromptModuleRegistry,
        ContextLoader,
        InnerMonologueService,
        ToolRegistry,
        SetSceneTypeHandler,
    ],
    exports: [ContextLoader, InnerMonologueService, ToolRegistry, PromptModuleRegistry],
})
export class LlmModule {}
