import { MikroOrmModule } from '@mikro-orm/nestjs';
import { forwardRef, Module } from '@nestjs/common';

import { CampaignModule } from '../campaign/campaign.module.js';
import { GraphqlModule } from '../graphql/graphql.module.js';
import { LlmModule } from '../llm/llm.module.js';
import { WorldModule } from '../world/world.module.js';
import { DmOrchestrator } from './dm-orchestrator.service.js';
import { GameEvent } from './entities/game-event.entity.js';
import { GameSession } from './entities/game-session.entity.js';
import { SessionResolver } from './session.resolver.js';
import { SessionService } from './session.service.js';
import { StreamPublisher } from './stream-publisher.service.js';

/**
 * Owns GameSession and GameEvent lifecycle, the player-input mutation, the DM stream
 * subscription, and session-scoped orchestration. LLM concerns (prompt assembly, tool
 * dispatch) live in LlmModule and are accessed via DmOrchestrator.
 */
@Module({
    imports: [
        GraphqlModule,
        MikroOrmModule.forFeature([GameSession, GameEvent]),
        forwardRef(() => CampaignModule),
        LlmModule,
        WorldModule,
    ],
    providers: [
        SessionService,
        StreamPublisher,
        DmOrchestrator,
        SessionResolver,
    ],
    exports: [SessionService, StreamPublisher],
})
export class SessionModule {}
