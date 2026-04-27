import { type Meta, type StoryObj } from '@storybook/vue3-vite';

import {
    allGlyphTranscriptEvents,
    longTranscriptEvents,
    openingTranscriptEvents,
    suggestedActionTranscriptEvents,
} from '../../stories/fixtures/storybook-fixtures';
import TranscriptView from './TranscriptView.vue';

const meta = {
    title: 'Session/TranscriptView',
    component: TranscriptView,
    tags: ['autodocs'],
    args: {
        events: openingTranscriptEvents,
        characterName: 'Elyra',
    },
    render: (args) => ({
        components: { TranscriptView },
        setup: () => ({ args }),
        template: '<div class="max-w-3xl"><TranscriptView v-bind="args" /></div>',
    }),
} satisfies Meta<typeof TranscriptView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpeningNarrative: Story = {};

export const LongTranscript: Story = {
    args: {
        events: longTranscriptEvents,
    },
};

export const StreamingText: Story = {
    args: {
        events: openingTranscriptEvents,
        inProgressText: 'The ferryman raises one bone-thin hand, and the water behind him begins to glow with drowned stars...',
    },
};

export const InnerMonologue: Story = {
    args: {
        events: openingTranscriptEvents,
        innerVoiceText: 'You have seen this symbol before, carved into the inside cover of your mentor\'s spellbook.',
    },
};

export const SuggestedActions: Story = {
    args: {
        events: suggestedActionTranscriptEvents,
    },
};

export const MechanicalAnnotations: Story = {
    args: {
        events: openingTranscriptEvents,
    },
};

/** Every glyph type in context: dm · player · dice (skill/ability/roll) · event (all categories) · inner-voice */
export const AllGlyphTypes: Story = {
    args: {
        events: allGlyphTranscriptEvents,
        characterName: 'Elyra',
        innerVoiceText: 'The contract smells of your mentor\'s ink. You have seen this seal before.',
    },
};
