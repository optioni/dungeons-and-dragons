import { Injectable, OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SceneType } from '../session/session.enums.js';

const SCENE_FILES: Record<SceneType, string> = {
    [SceneType.EXPLORATION]: 'exploration.txt',
    [SceneType.DUNGEON]: 'dungeon.txt',
    [SceneType.COMBAT]: 'combat.txt',
    [SceneType.SOCIAL]: 'social.txt',
    [SceneType.SETTLEMENT]: 'settlement.txt',
    [SceneType.REST]: 'rest.txt',
};

/**
 * Loads scene prompt module text files at startup and serves them by SceneType.
 * Files live in `prompt-modules/` next to this service and are stable application assets.
 */
@Injectable()
export class PromptModuleRegistry implements OnModuleInit {
    private readonly modules = new Map<SceneType, string>();

    onModuleInit(): void {
        const directory = [
            join(__dirname, 'prompt-modules'),
            join(process.cwd(), 'src/llm/prompt-modules'),
            join(process.cwd(), 'apps/api/src/llm/prompt-modules'),
        ].find((candidate) => existsSync(candidate));

        if (!directory) {
            throw new Error('Prompt module directory not found');
        }

        for (const [scene, file] of Object.entries(SCENE_FILES) as Array<[SceneType, string]>) {
            const text = readFileSync(join(directory, file), 'utf8');
            this.modules.set(scene, text);
        }
    }

    /** Returns the prompt module text for the given scene type. */
    getModule(sceneType: SceneType): string {
        const text = this.modules.get(sceneType);
        if (!text) {
            throw new Error(`No prompt module for scene type: ${sceneType}`);
        }

        return text;
    }
}
