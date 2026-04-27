<template>
    <!-- All glyphs share an ornamental lancet medallion frame:
         outer lancet arch, wing flourishes at both pointed tips,
         side accent dots at the equator, and a concentric inner frame.
         Each type carries a distinct centre emblem within. -->

    <!-- DM — Eye of Providence oracle seal -->
    <svg v-if="props.type === 'dm'"
        viewBox="0 0 20 38"
        width="20"
        height="36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true">
        <!-- Outer lancet arch -->
        <path d="M10,2 C14.5,5.5 17,11.5 17,19 C17,26.5 14.5,32.5 10,36 C5.5,32.5 3,26.5 3,19 C3,11.5 5.5,5.5 10,2 Z"
            stroke="currentColor"
            stroke-width="0.85" />
        <!-- Wing flourishes at top tip -->
        <path d="M10,2 L7.5,4.5 M10,2 L12.5,4.5"
            stroke="currentColor"
            stroke-width="0.6"
            stroke-linecap="round" />
        <!-- Wing flourishes at bottom tip -->
        <path d="M10,36 L7.5,33.5 M10,36 L12.5,33.5"
            stroke="currentColor"
            stroke-width="0.6"
            stroke-linecap="round" />
        <!-- Side accent dots at equator (outside the arch) -->
        <circle cx="1.8"
            cy="19"
            r="0.85"
            fill="currentColor" />
        <circle cx="18.2"
            cy="19"
            r="0.85"
            fill="currentColor" />
        <!-- Inner concentric frame -->
        <path d="M10,5.5 C13.5,8.5 15.5,13 15.5,19 C15.5,25 13.5,29.5 10,32.5 C6.5,29.5 4.5,25 4.5,19 C4.5,13 6.5,8.5 10,5.5 Z"
            stroke="currentColor"
            stroke-width="0.5" />
        <!-- Eye almond -->
        <path d="M6.5,19 Q10,16.2 13.5,19 Q10,21.8 6.5,19 Z"
            stroke="currentColor"
            stroke-width="0.65" />
        <!-- Iris -->
        <circle cx="10"
            cy="19"
            r="1.7"
            stroke="currentColor"
            stroke-width="0.6" />
        <!-- Pupil -->
        <circle cx="10"
            cy="19"
            r="0.7"
            fill="currentColor" />
        <!-- Upper chevron accent -->
        <path d="M8.5,14 L10,12.5 L11.5,14"
            stroke="currentColor"
            stroke-width="0.45"
            stroke-linejoin="round" />
        <!-- Lower chevron accent -->
        <path d="M8.5,24 L10,25.5 L11.5,24"
            stroke="currentColor"
            stroke-width="0.45"
            stroke-linejoin="round" />
    </svg>

    <!-- Player — Sword & crossguard seal -->
    <svg v-else-if="props.type === 'player'"
        viewBox="0 0 20 38"
        width="20"
        height="36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true">
        <path d="M10,2 C14.5,5.5 17,11.5 17,19 C17,26.5 14.5,32.5 10,36 C5.5,32.5 3,26.5 3,19 C3,11.5 5.5,5.5 10,2 Z"
            stroke="currentColor"
            stroke-width="0.85" />
        <path d="M10,2 L7.5,4.5 M10,2 L12.5,4.5"
            stroke="currentColor"
            stroke-width="0.6"
            stroke-linecap="round" />
        <path d="M10,36 L7.5,33.5 M10,36 L12.5,33.5"
            stroke="currentColor"
            stroke-width="0.6"
            stroke-linecap="round" />
        <circle cx="1.8"
            cy="19"
            r="0.85"
            fill="currentColor" />
        <circle cx="18.2"
            cy="19"
            r="0.85"
            fill="currentColor" />
        <path d="M10,5.5 C13.5,8.5 15.5,13 15.5,19 C15.5,25 13.5,29.5 10,32.5 C6.5,29.5 4.5,25 4.5,19 C4.5,13 6.5,8.5 10,5.5 Z"
            stroke="currentColor"
            stroke-width="0.5" />
        <!-- Pommel (circular cap at top of hilt) -->
        <circle cx="10"
            cy="11.5"
            r="1.7"
            stroke="currentColor"
            stroke-width="0.65" />
        <circle cx="10"
            cy="11.5"
            r="0.6"
            fill="currentColor" />
        <!-- Grip -->
        <line x1="10"
            y1="13.2"
            x2="10"
            y2="17"
            stroke="currentColor"
            stroke-width="0.9"
            stroke-linecap="round" />
        <!-- Crossguard with knobbed ends -->
        <path d="M6.5,17.5 C7.5,16.5 8.5,17 10,17 C11.5,17 12.5,16.5 13.5,17.5"
            stroke="currentColor"
            stroke-width="1.1"
            stroke-linecap="round" />
        <circle cx="6.5"
            cy="17.5"
            r="0.85"
            fill="currentColor" />
        <circle cx="13.5"
            cy="17.5"
            r="0.85"
            fill="currentColor" />
        <!-- Blade tapering to a point -->
        <path d="M9.35,18.5 L9.15,24 L10,26.5 L10.85,24 L10.65,18.5 Z"
            fill="currentColor" />
    </svg>

    <!-- Inner-voice — Crescent moon & star cluster -->
    <svg v-else-if="props.type === 'inner-voice'"
        viewBox="0 0 20 38"
        width="20"
        height="36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true">
        <path d="M10,2 C14.5,5.5 17,11.5 17,19 C17,26.5 14.5,32.5 10,36 C5.5,32.5 3,26.5 3,19 C3,11.5 5.5,5.5 10,2 Z"
            stroke="currentColor"
            stroke-width="0.85" />
        <path d="M10,2 L7.5,4.5 M10,2 L12.5,4.5"
            stroke="currentColor"
            stroke-width="0.6"
            stroke-linecap="round" />
        <path d="M10,36 L7.5,33.5 M10,36 L12.5,33.5"
            stroke="currentColor"
            stroke-width="0.6"
            stroke-linecap="round" />
        <circle cx="1.8"
            cy="19"
            r="0.85"
            fill="currentColor" />
        <circle cx="18.2"
            cy="19"
            r="0.85"
            fill="currentColor" />
        <path d="M10,5.5 C13.5,8.5 15.5,13 15.5,19 C15.5,25 13.5,29.5 10,32.5 C6.5,29.5 4.5,25 4.5,19 C4.5,13 6.5,8.5 10,5.5 Z"
            stroke="currentColor"
            stroke-width="0.5" />
        <!-- Crescent moon: outer circle r=2.5 at (10,19), inner circle r=1.7 at (11.2,19).
             Entry/exit points: a=(r1²-r2²+d²)/2d=2.0, h=√(r1²-a²)=1.5 → (12,17.5) and (12,20.5). -->
        <path d="M12,17.5 A2.5,2.5 0 1 1 12,20.5 A1.7,1.7 0 1 0 12,17.5 Z"
            fill="currentColor" />
        <!-- Stars bracketing the crescent: centred above, left midpoint, centred below.
             The top/bottom dots sit on the vertical axis (x=10) to anchor the composition;
             the left dot counterbalances the crescent's rightward mass. -->
        <circle cx="10"
            cy="13"
            r="0.75"
            fill="currentColor" />
        <circle cx="6.5"
            cy="19"
            r="0.55"
            fill="currentColor" />
        <circle cx="10"
            cy="25.5"
            r="0.65"
            fill="currentColor" />
        <!-- Tiny twinkle cross above the top star -->
        <path d="M10,11.3 L10,12.3 M9.5,11.8 L10.5,11.8"
            stroke="currentColor"
            stroke-width="0.4"
            stroke-linecap="round" />
    </svg>

    <!-- Dice — Faceted gem diamond -->
    <svg v-else-if="props.type === 'dice'"
        viewBox="0 0 20 38"
        width="20"
        height="36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true">
        <path d="M10,2 C14.5,5.5 17,11.5 17,19 C17,26.5 14.5,32.5 10,36 C5.5,32.5 3,26.5 3,19 C3,11.5 5.5,5.5 10,2 Z"
            stroke="currentColor"
            stroke-width="0.85" />
        <path d="M10,2 L7.5,4.5 M10,2 L12.5,4.5"
            stroke="currentColor"
            stroke-width="0.6"
            stroke-linecap="round" />
        <path d="M10,36 L7.5,33.5 M10,36 L12.5,33.5"
            stroke="currentColor"
            stroke-width="0.6"
            stroke-linecap="round" />
        <circle cx="1.8"
            cy="19"
            r="0.85"
            fill="currentColor" />
        <circle cx="18.2"
            cy="19"
            r="0.85"
            fill="currentColor" />
        <path d="M10,5.5 C13.5,8.5 15.5,13 15.5,19 C15.5,25 13.5,29.5 10,32.5 C6.5,29.5 4.5,25 4.5,19 C4.5,13 6.5,8.5 10,5.5 Z"
            stroke="currentColor"
            stroke-width="0.5" />
        <!-- Outer gem outline -->
        <polygon points="10,11.5 15,19 10,26.5 5,19"
            stroke="currentColor"
            stroke-width="0.7" />
        <!-- Internal facet cuts from top vertex -->
        <line x1="10"
            y1="11.5"
            x2="5"
            y2="19"
            stroke="currentColor"
            stroke-width="0.35" />
        <line x1="10"
            y1="11.5"
            x2="15"
            y2="19"
            stroke="currentColor"
            stroke-width="0.35" />
        <!-- Equator rule (girdle line) -->
        <line x1="5"
            y1="19"
            x2="15"
            y2="19"
            stroke="currentColor"
            stroke-width="0.45" />
        <!-- Centre table dot -->
        <circle cx="10"
            cy="19"
            r="0.9"
            fill="currentColor" />
        <!-- Tip accent dots at top and bottom vertices -->
        <circle cx="10"
            cy="11.5"
            r="0.65"
            fill="currentColor" />
        <circle cx="10"
            cy="26.5"
            r="0.65"
            fill="currentColor" />
    </svg>

    <!-- Event — Eight-pointed star seal -->
    <svg v-else-if="props.type === 'event'"
        viewBox="0 0 20 38"
        width="20"
        height="36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true">
        <path d="M10,2 C14.5,5.5 17,11.5 17,19 C17,26.5 14.5,32.5 10,36 C5.5,32.5 3,26.5 3,19 C3,11.5 5.5,5.5 10,2 Z"
            stroke="currentColor"
            stroke-width="0.85" />
        <path d="M10,2 L7.5,4.5 M10,2 L12.5,4.5"
            stroke="currentColor"
            stroke-width="0.6"
            stroke-linecap="round" />
        <path d="M10,36 L7.5,33.5 M10,36 L12.5,33.5"
            stroke="currentColor"
            stroke-width="0.6"
            stroke-linecap="round" />
        <circle cx="1.8"
            cy="19"
            r="0.85"
            fill="currentColor" />
        <circle cx="18.2"
            cy="19"
            r="0.85"
            fill="currentColor" />
        <path d="M10,5.5 C13.5,8.5 15.5,13 15.5,19 C15.5,25 13.5,29.5 10,32.5 C6.5,29.5 4.5,25 4.5,19 C4.5,13 6.5,8.5 10,5.5 Z"
            stroke="currentColor"
            stroke-width="0.5" />
        <!-- Eight-pointed star (R=4.5, inner r=1.8), 16-vertex polygon -->
        <polygon
            points="10,14.5 10.69,17.34 13.18,15.82 11.66,18.31 14.5,19 11.66,19.69 13.18,22.18 10.69,20.66 10,23.5 9.31,20.66 6.82,22.18 8.34,19.69 5.5,19 8.34,18.31 6.82,15.82 9.31,17.34"
            fill="currentColor" />
        <!-- Centre ring and focal dot -->
        <circle cx="10"
            cy="19"
            r="1.2"
            stroke="currentColor"
            stroke-width="0.5" />
        <circle cx="10"
            cy="19"
            r="0.4"
            fill="currentColor" />
    </svg>
</template>

<script setup lang="ts">
type GlyphType = 'dm' | 'player' | 'inner-voice' | 'dice' | 'event';

const props = defineProps<{
    type: GlyphType
}>();
</script>
