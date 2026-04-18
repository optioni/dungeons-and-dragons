import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import { JsonScalar } from '../../graphql/scalars/json.scalar.js';

export enum DmStreamChunkType {
    NARRATIVE_CHUNK = 'NARRATIVE_CHUNK',
    TOOL_RESULT = 'TOOL_RESULT',
    SUGGESTED_ACTION = 'SUGGESTED_ACTION',
    STATUS = 'STATUS',
    DONE = 'DONE',
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
    @Field({ nullable: true })
    text?: string;

    /** Tool name — present for TOOL_RESULT. */
    @Field({ nullable: true })
    toolName?: string;

    /** Structured tool result — present for TOOL_RESULT. */
    @Field(() => JsonScalar, { nullable: true })
    toolResult?: unknown;

    /** Suggested player action — present for SUGGESTED_ACTION. */
    @Field({ nullable: true })
    action?: string;

    /** Status message (e.g. scene change) — present for STATUS. */
    @Field({ nullable: true })
    status?: string;

    /** New scene type after a STATUS change. */
    @Field({ nullable: true })
    sceneType?: string;

    /** Owning session ID — used for stream routing. */
    @Field(() => ID)
    sessionId!: number;
}
