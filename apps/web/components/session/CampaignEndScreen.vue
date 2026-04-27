<template>
    <div
        class="fixed inset-0 grimoire-bg flex flex-col items-center justify-center p-8 z-50"
        style="animation: grimoire-fade 2s ease forwards;"
    >
        <!-- Candlelight glow -->
        <div
            class="pointer-events-none absolute inset-0"
            style="background: radial-gradient(ellipse 50% 45% at 50% 50%, color-mix(in srgb, #c8922a 5%, transparent) 0%, transparent 70%);"
        />

        <div class="max-w-2xl w-full text-center relative z-10">
            <!-- In Memoriam label -->
            <p
                class="font-['Cinzel',serif] text-xs tracking-[0.6em] uppercase text-grimoire-muted"
                style="animation: grimoire-reveal 0.6s 0.8s ease-out both;"
            >
                In Memoriam
            </p>

            <!-- Ornamental rule above name -->
            <div
                class="flex items-center justify-center mt-6 mb-6"
                style="animation: grimoire-reveal 0.5s 1.2s ease-out both;"
                aria-hidden="true"
            >
                <svg width="240"
                    height="14"
                    viewBox="0 0 240 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    class="opacity-30">
                    <line x1="0"
                        y1="7"
                        x2="100"
                        y2="7"
                        stroke="#c8922a"
                        stroke-width="0.75" />

                    <rect x="103"
                        y="3"
                        width="8"
                        height="8"
                        transform="rotate(45 107 7)"
                        fill="none"
                        stroke="#c8922a"
                        stroke-width="0.75" />

                    <path d="M120 2 L121.8 6.3 L126.5 7 L121.8 7.7 L120 12 L118.2 7.7 L113.5 7 L118.2 6.3 Z"
                        fill="#c8922a" />

                    <rect x="129"
                        y="3"
                        width="8"
                        height="8"
                        transform="rotate(45 133 7)"
                        fill="none"
                        stroke="#c8922a"
                        stroke-width="0.75" />

                    <line x1="136"
                        y1="7"
                        x2="240"
                        y2="7"
                        stroke="#c8922a"
                        stroke-width="0.75" />
                </svg>
            </div>

            <!-- Character name -->
            <h1
                v-if="props.characterName"
                class="font-['IM_Fell_English',serif] text-5xl text-grimoire-text leading-tight"
                style="animation: grimoire-reveal 0.7s 1.6s ease-out both;"
            >
                {{ props.characterName }}
            </h1>

            <!-- Epitaph -->
            <p
                class="font-['IM_Fell_English',serif] italic text-xl leading-loose text-grimoire-text/80 max-w-xl mx-auto mt-8"
                style="animation: grimoire-reveal 0.7s 2.2s ease-out both;"
            >
                {{ props.epitaph }}
            </p>

            <!-- Stats -->
            <div
                class="flex justify-center items-center gap-16 mt-10"
                style="animation: grimoire-reveal 0.6s 2.8s ease-out both;"
            >
                <div class="text-center">
                    <p class="font-mono text-5xl text-grimoire-accent">{{ displayedDays }}</p>

                    <p class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted mt-2">Days Adventured</p>
                </div>

                <div class="w-px h-16 bg-grimoire-accent-dim/30" />

                <div class="text-center">
                    <p class="font-mono text-5xl text-grimoire-accent">{{ displayedQuests }}</p>

                    <p class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted mt-2">Quests Completed</p>
                </div>
            </div>

            <!-- Hairline separator -->
            <div
                class="flex items-center justify-center mt-10 mb-10"
                style="animation: grimoire-reveal 0.5s 3.2s ease-out both;"
                aria-hidden="true"
            >
                <div class="h-px w-32 bg-grimoire-accent-dim/25" />

                <div class="w-1 h-1 rounded-full bg-grimoire-accent-dim/40 mx-3" />

                <div class="h-px w-32 bg-grimoire-accent-dim/25" />
            </div>

            <!-- Begin anew -->
            <div style="animation: grimoire-reveal 0.5s 3.4s ease-out both;">
                <button
                    type="button"
                    class="font-['Cinzel',serif] text-sm tracking-widest uppercase
                           text-grimoire-muted border border-grimoire-accent-dim/30
                           px-8 py-3 rounded-sm hover:border-grimoire-accent hover:text-grimoire-accent
                           transition-all duration-300"
                    @click="startNewCampaign"
                >
                    Begin Anew
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    epitaph: string
    daysPlayed: number
    questsCompleted: number
    characterName?: string | null
}>();

const router = useRouter();

const displayedDays = ref(0);
const displayedQuests = ref(0);

onMounted(() => {
    const delay = 3000;
    const duration = 800;
    const steps = 30;

    setTimeout(() => {
        const daysStep = props.daysPlayed / steps;
        const questsStep = props.questsCompleted / steps;
        let tick = 0;
        const interval = setInterval(() => {
            tick++;
            displayedDays.value = Math.round(Math.min(daysStep * tick, props.daysPlayed));
            displayedQuests.value = Math.round(Math.min(questsStep * tick, props.questsCompleted));
            if (tick >= steps) clearInterval(interval);
        }, duration / steps);
    }, delay);
});

function startNewCampaign(): void {
    void router.push('/');
}
</script>
