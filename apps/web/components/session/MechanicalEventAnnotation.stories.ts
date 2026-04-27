import { type Meta, type StoryObj } from '@storybook/vue3-vite';

import { mechanicalEvents } from '../../stories/fixtures/storybook-fixtures';
import MechanicalEventAnnotation from './MechanicalEventAnnotation.vue';

const meta = {
    title: 'Session/MechanicalEventAnnotation',
    component: MechanicalEventAnnotation,
    tags: ['autodocs'],
    render: (args) => ({
        components: { MechanicalEventAnnotation },
        setup: () => ({ args }),
        template: '<div class="max-w-xl"><MechanicalEventAnnotation v-bind="args" /></div>',
    }),
} satisfies Meta<typeof MechanicalEventAnnotation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CombatResult: Story = {
    args: {
        content: mechanicalEvents.combatStarted,
    },
};

export const QuestProgress: Story = {
    args: {
        content: mechanicalEvents.questProgress,
    },
};

export const WorldEvent: Story = {
    args: {
        content: mechanicalEvents.worldEvent,
    },
};

export const RejectedOrIgnoredPayload: Story = {
    args: {
        content: mechanicalEvents.rejectedPayload,
    },
};
