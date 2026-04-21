import { z } from 'zod';

/* eslint-disable @typescript-eslint/naming-convention */
const environmentSchema = z.object({
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    ANTHROPIC_API_KEY: z.string().min(1),
    VOYAGE_API_KEY: z.string().min(1),
    JWT_SECRET: z.string().min(16),
    LLM_DM_MODEL: z.string().min(1),
    LLM_BACKGROUND_MODEL: z.string().min(1),
    MAX_NPCS_PER_TICK: z.coerce.number().int().positive().default(10),
    NPC_MEMORY_AGENDA_LIMIT: z.coerce.number().int().positive().default(5),
    NPC_MEMORY_CONVERSATION_LIMIT: z.coerce.number().int().positive().default(3),
    NPC_MEMORY_SCENE_LIMIT: z.coerce.number().int().positive().default(10),
    PORT: z.coerce.number().int().positive().default(3000),
});
/* eslint-enable @typescript-eslint/naming-convention */

export type EnvironmentConfig = z.infer<typeof environmentSchema>;

export function validate(config: Record<string, unknown>): EnvironmentConfig {
    const result = environmentSchema.safeParse(config);

    if (!result.success) {
        throw new Error(
            `Environment validation failed:\n${result.error.issues
                .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
                .join('\n')}`,
        );
    }

    return result.data;
}
