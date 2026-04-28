<template>
    <span
        class="message-border-glyph inline-block leading-none"
        aria-hidden="true"
        v-html="glyphSvg"
    />
</template>

<script setup lang="ts">
type GlyphType = 'dm' | 'player' | 'inner-voice' | 'dice' | 'event';

import diceGlyph from '~/assets/glyphs/session/dice.svg?raw';
import dmGlyph from '~/assets/glyphs/session/dm.svg?raw';
import eventGlyph from '~/assets/glyphs/session/event.svg?raw';
import innerVoiceGlyph from '~/assets/glyphs/session/inner-voice.svg?raw';
import playerGlyph from '~/assets/glyphs/session/player.svg?raw';

const props = defineProps<{
    type: GlyphType
}>();

const glyphs: Record<GlyphType, string> = {
    dm: dmGlyph,
    player: playerGlyph,
    'inner-voice': innerVoiceGlyph,
    dice: diceGlyph,
    event: eventGlyph,
};

const glyphSvg = computed(() => glyphs[props.type]);
</script>

<style scoped>
.message-border-glyph :deep(svg) {
    display: block;
    width: 24px;
    height: 44px;
}
</style>
