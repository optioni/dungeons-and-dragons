import { type Meta, type StoryObj } from '@storybook/vue3-vite';

import {
    activeCombatSession,
    characterId,
    combatEvents,
    emptyCombatSession,
    hostileFriendlyCombatSession,
    lowHpCombatSession,
    spellSlots,
} from '../../stories/fixtures/storybook-fixtures';
import CombatPanel from './CombatPanel.vue';

const meta = {
    title: 'Session/CombatPanel',
    component: CombatPanel,
    tags: ['autodocs'],
    args: {
        combatSession: activeCombatSession,
        characterId,
        spellSlots,
        combatEvents,
        isStreaming: false,
    },
    render: (args) => ({
        components: { CombatPanel },
        setup: () => ({ args }),
        template: '<div class="h-[720px]"><CombatPanel v-bind="args" /></div>',
    }),
} satisfies Meta<typeof CombatPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoCombatants: Story = {
    args: {
        combatSession: emptyCombatSession,
        characterId,
        spellSlots: [],
        combatEvents: [],
    },
};

export const ActiveTurn: Story = {};

export const LowHp: Story = {
    args: {
        combatSession: lowHpCombatSession,
    },
};

export const HostileFriendlyGroups: Story = {
    args: {
        combatSession: hostileFriendlyCombatSession,
        isStreaming: true,
    },
};
