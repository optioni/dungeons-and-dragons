import { type Meta, type StoryObj } from '@storybook/vue3-vite';

import { sessionHeaderStates } from '../../stories/fixtures/storybook-fixtures';
import PlayHeader from './PlayHeader.vue';

const meta = {
    title: 'Session/PlayHeader',
    component: PlayHeader,
    tags: ['autodocs'],
    args: sessionHeaderStates.exploration,
} satisfies Meta<typeof PlayHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Exploration: Story = {
    args: sessionHeaderStates.exploration,
};

export const Combat: Story = {
    args: sessionHeaderStates.combat,
};

export const Rest: Story = {
    args: sessionHeaderStates.rest,
};

export const LowHp: Story = {
    args: sessionHeaderStates.lowHp,
};

export const MissingLocation: Story = {
    args: sessionHeaderStates.missingLocation,
};
