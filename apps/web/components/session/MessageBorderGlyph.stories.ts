import { type Meta, type StoryObj } from '@storybook/vue3-vite';

import MessageBorderGlyph from './MessageBorderGlyph.vue';

const meta = {
    title: 'Session/MessageBorderGlyph',
    component: MessageBorderGlyph,
    tags: ['autodocs'],
    decorators: [
        () => ({
            template: '<div class="p-8 bg-grimoire-bg"><story /></div>',
        }),
    ],
    render: (args) => ({
        components: { MessageBorderGlyph },
        setup: () => ({ args }),
        template: '<MessageBorderGlyph v-bind="args" class="text-grimoire-accent-dim" />',
    }),
} satisfies Meta<typeof MessageBorderGlyph>;

export default meta;
type Story = StoryObj<typeof meta>;

/** All five variants side by side — judge the icon family as a set */
export const AllVariants: Story = {
    render: () => ({
        components: { MessageBorderGlyph },
        setup: () => ({
            variants: [
                { type: 'dm', label: 'DM oracle' },
                { type: 'player', label: 'Player' },
                { type: 'inner-voice', label: 'Inner voice' },
                { type: 'dice', label: 'Dice roll' },
                { type: 'event', label: 'Event' },
            ] as const,
        }),
        template: `
            <div class="flex gap-10 items-start">
                <div
                    v-for="v in variants"
                    :key="v.type"
                    class="flex flex-col items-center gap-3"
                >
                    <MessageBorderGlyph :type="v.type" class="text-grimoire-accent-dim" />
                    <span class="font-['Cinzel',serif] text-[9px] tracking-widest uppercase text-grimoire-muted whitespace-nowrap">
                        {{ v.label }}
                    </span>
                </div>
            </div>
        `,
    }),
};

export const DM: Story = {
    args: { type: 'dm' },
};

export const Player: Story = {
    args: { type: 'player' },
};

export const InnerVoice: Story = {
    args: { type: 'inner-voice' },
};

export const Dice: Story = {
    args: { type: 'dice' },
};

export const Event: Story = {
    args: { type: 'event' },
};
