import { type Meta, type StoryObj } from '@storybook/vue3-vite';

import { worldMapStates } from '../../stories/fixtures/storybook-fixtures';
import WorldMapGraph from './WorldMapGraph.vue';

const meta = {
    title: 'World/WorldMapGraph',
    component: WorldMapGraph,
    tags: ['autodocs'],
    args: {
        ...worldMapStates.partial,
        ariaLabel: 'Storybook world map',
    },
    render: (args) => ({
        components: { WorldMapGraph },
        setup: () => ({ args }),
        template: '<div class="h-[520px] rounded border border-grimoire-accent-dim/30 bg-grimoire-surface p-4"><WorldMapGraph v-bind="args" /></div>',
    }),
} satisfies Meta<typeof WorldMapGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Undiscovered: Story = {
    args: worldMapStates.undiscovered,
};

export const PartiallyDiscovered: Story = {
    args: worldMapStates.partial,
};

export const DenseMap: Story = {
    args: worldMapStates.dense,
};
