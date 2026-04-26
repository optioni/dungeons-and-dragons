import {
    Field, ID, Int, ObjectType, registerEnumType,
} from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-scalars';

export enum DmStreamChunkType {
    NARRATIVE_CHUNK = 'NARRATIVE_CHUNK',
    INNER_VOICE = 'INNER_VOICE',
    TOOL_RESULT = 'TOOL_RESULT',
    SUGGESTED_ACTION = 'SUGGESTED_ACTION',
    PENDING_CHECK = 'PENDING_CHECK',
    STATUS = 'STATUS',
    CAMPAIGN_ENDED = 'CAMPAIGN_ENDED',
    DONE = 'DONE',
}

/** Payload carried by a CAMPAIGN_ENDED STATUS chunk. */
export interface CampaignEndedChunkPayload {
    epitaph: string
    daysPlayed: number
    questsCompleted: number
}

registerEnumType(DmStreamChunkType, { name: 'DmStreamChunkType' });

/**
 * Typed payload emitted by the DM stream subscription. Includes monotonic
 * sequence numbers per session so clients can de-duplicate after reconnects.
 */
@ObjectType()
export class DmStreamChunk {
    @Field(() => DmStreamChunkType)
    type!: DmStreamChunkType;

    @Field(() => Int)
    sequence!: number;

    /** Narrative text fragment — present for NARRATIVE_CHUNK. */
    @Field(() => String, { nullable: true })
    text?: string;

    /** Tool name — present for TOOL_RESULT. */
    @Field(() => String, { nullable: true })
    toolName?: string;

    /** Structured tool result — present for TOOL_RESULT. */
    @Field(() => GraphQLJSON, { nullable: true })
    toolResult?: unknown;

    /** Suggested player action — present for SUGGESTED_ACTION. */
    @Field(() => String, { nullable: true })
    action?: string;

    /** Pending check hint — present for PENDING_CHECK. */
    @Field(() => GraphQLJSON, { nullable: true })
    pendingCheck?: { skill?: string; ability?: string; dc: number };

    /** Status message (e.g. scene change) — present for STATUS. */
    @Field(() => String, { nullable: true })
    status?: string;

    /** New scene type after a STATUS change. */
    @Field(() => String, { nullable: true })
    sceneType?: string;

    /** Owning session ID — used for stream routing. */
    @Field(() => ID)
    sessionId!: number;
}
