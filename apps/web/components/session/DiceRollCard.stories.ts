import { type Meta, type StoryObj } from '@storybook/vue3-vite';

import DiceRollCard from './DiceRollCard.vue';

const meta = {
    title: 'Session/DiceRollCard',
    component: DiceRollCard,
    tags: ['autodocs'],
    render: (args) => ({
        components: { DiceRollCard },
        setup: () => ({ args }),
        template: '<div class="max-w-xl"><DiceRollCard v-bind="args" /></div>',
    }),
} satisfies Meta<typeof DiceRollCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CombatResult: Story = {
    args: {
        content: {
            tool: 'roll_dice',
            expression: '1d8 + 3',
            rolls: [7],
            total: 10,
        },
    },
};

export const SkillCheckPassed: Story = {
    args: {
        content: {
            tool: 'check_skill',
            skill: 'Stealth',
            roll: 16,
            modifier: 5,
            total: 21,
            dc: 15,
            passed: true,
        },
    },
};

export const SkillCheckFailed: Story = {
    args: {
        content: {
            tool: 'check_skill',
            skill: 'Perception',
            roll: 3,
            modifier: 2,
            total: 5,
            dc: 12,
            passed: false,
        },
    },
};

export const AbilityCheckFailed: Story = {
    args: {
        content: {
            tool: 'check_ability',
            ability: 'Strength',
            roll: 6,
            modifier: 1,
            total: 7,
            dc: 13,
            passed: false,
        },
    },
};
