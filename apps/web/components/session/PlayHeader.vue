<template>
    <header class="relative z-10 border-b border-grimoire-accent-dim/20 px-6 py-3 flex items-center justify-between bg-grimoire-bg/80">
        <!-- Left: location + scene type -->
        <div>
            <p
                v-if="props.locationName"
                class="font-['IM_Fell_English',serif] text-lg text-grimoire-text leading-tight"
            >
                {{ props.locationName }}
            </p>

            <p
                v-if="props.sceneType"
                class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted mt-0.5"
            >
                {{ props.sceneType }}
            </p>
        </div>

        <!-- Right: date, HP strip, nav icons -->
        <div class="flex items-center gap-5">
            <span
                v-if="props.inGameDate"
                class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted hidden sm:block"
            >
                {{ props.inGameDate }}
            </span>

            <!-- HP strip -->
            <div
                v-if="props.maxHp && props.maxHp > 0"
                class="flex items-center gap-2"
            >
                <span class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted hidden sm:block">HP</span>
                <div class="h-1.5 w-20 bg-grimoire-raised rounded-full overflow-hidden">
                    <div
                        class="h-1.5 rounded-full transition-all duration-500"
                        :class="hpBarClass"
                        :style="{ width: `${hpPercent}%` }"
                    />
                </div>
                <span class="font-mono text-xs text-grimoire-text/60 hidden sm:block">
                    {{ props.hp }}<span class="text-grimoire-muted">/{{ props.maxHp }}</span>
                </span>
            </div>

            <!-- Navigation icons -->
            <nav class="flex items-center gap-3">
                <nuxt-link
                    :to="characterHref"
                    class="text-grimoire-muted hover:text-grimoire-text transition-colors"
                    title="Character sheet"
                >
                    <u-icon name="i-lucide-user" class="text-base" />
                </nuxt-link>

                <nuxt-link
                    :to="questsHref"
                    class="text-grimoire-muted hover:text-grimoire-text transition-colors"
                    title="Quest log"
                >
                    <u-icon name="i-lucide-scroll-text" class="text-base" />
                </nuxt-link>
            </nav>
        </div>
    </header>
</template>

<script setup lang="ts">
type Props = {
    locationName?: string | null
    sceneType?: string | null
    inGameDate?: string | null
    hp?: number | null
    maxHp?: number | null
    campaignId: string
};

const props = withDefaults(defineProps<Props>(), {
    locationName: null,
    sceneType: null,
    inGameDate: null,
    hp: null,
    maxHp: null,
});

const hpPercent = computed(() => {
    if (!props.hp || !props.maxHp || props.maxHp === 0) return 0;
    return Math.round((props.hp / props.maxHp) * 100);
});

const hpBarClass = computed(() => {
    if (hpPercent.value > 50) {
        return 'bg-grimoire-accent';
    }
    if (hpPercent.value > 25) {
        return 'bg-orange-600';
    }
    return 'bg-red-700 grimoire-breathe';
});

const characterHref = computed(() => `/campaign/${props.campaignId}/character`);
const questsHref = computed(() => `/campaign/${props.campaignId}/quests`);
</script>
