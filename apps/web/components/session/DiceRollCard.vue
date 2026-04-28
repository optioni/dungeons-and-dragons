<template>
    <div
        class="relative pl-8 py-1 my-3"
        :class="{ 'grimoire-entry': mounted }"
    >
        <div class="absolute left-0 top-0 bottom-0 w-6 flex flex-col items-center text-grimoire-accent-dim/60">
            <session-message-border-glyph type="dice"
                class="flex-none" />

            <div class="flex-1 w-px bg-grimoire-accent-dim/20" />
        </div>

        <!-- Skill/ability check variant -->
        <template v-if="content.tool === 'check_skill' || content.tool === 'check_ability'">
            <p class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted">
                {{ checkLabel }} · DC {{ content.dc }}
            </p>

            <p class="font-mono text-sm text-grimoire-muted/80 mt-0.5">
                {{ content.roll }}
                <span class="text-grimoire-muted/50"> + </span>
                {{ content.modifier }}
                <span class="text-grimoire-muted/50"> = </span>
                {{ content.total }}
                <span class="mx-2 text-grimoire-muted/40">·</span>

                <span :class="content.passed ? 'text-grimoire-accent' : 'text-grimoire-muted/70'">
                    {{ content.passed ? '✦ Passed' : '✕ Failed' }}
                </span>
            </p>
        </template>

        <!-- roll_dice variant -->
        <template v-else-if="content.tool === 'roll_dice'">
            <p class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted">
                ROLL · {{ content.expression }}
            </p>

            <p class="font-mono text-sm text-grimoire-muted/80 mt-0.5">
                <template v-for="(roll, i) in content.rolls"
                    :key="i">
                    <span class="text-grimoire-muted/60">{{ roll }}</span>

                    <span
                        v-if="i < (content.rolls?.length ?? 0) - 1"
                        class="text-grimoire-muted/40 mx-1"
                    >·</span>
                </template>

                <span v-if="(content.rolls?.length ?? 0) > 0"
                    class="text-grimoire-muted/50 mx-1"> = </span>
                {{ content.total }}
            </p>
        </template>
    </div>
</template>

<script setup lang="ts">
interface DiceRollContent {
    tool: 'check_skill' | 'check_ability' | 'roll_dice'
    skill?: string
    ability?: string
    roll?: number
    modifier?: number
    total?: number
    dc?: number
    passed?: boolean
    expression?: string
    rolls?: number[]
}

const props = defineProps<{
    content: DiceRollContent
}>();

const mounted = ref(false);
onMounted(() => { mounted.value = true; });

const checkLabel = computed(() => {
    if (props.content.skill) return `${props.content.skill.toUpperCase()} CHECK`;
    if (props.content.ability) return `${props.content.ability.toUpperCase()} CHECK`;
    return 'CHECK';
});
</script>
