import { useQuery } from '@urql/vue';
import { flushPromises, mount } from '@vue/test-utils';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';
import { ref } from 'vue';

import QuestsPage from '../pages/campaign/[id]/quests.vue';

vi.mock('@urql/vue', () => ({
    useQuery: vi.fn(),
}));

vi.mock('~/graphql/quests', () => ({
    QUESTS_QUERY: 'QUESTS_QUERY',
}));

const globalStubs = {
    NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
    UBadge: { template: '<span><slot /></span>', props: ['color', 'variant', 'size'] },
    UCard: { template: '<section><slot /></section>', props: ['class'] },
    UIcon: { template: '<span />', props: ['name', 'class'] },
};

function questEdge(node: Record<string, unknown>) {
    return { cursor: `cursor-${String(node.id)}`, node };
}

describe('QuestsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('useRoute', vi.fn(() => ({ params: { id: 'camp-1' }, query: {} })));
    });

    it('renders active objectives and finished quest rewards', async () => {
        vi.mocked(useQuery)
            .mockReturnValueOnce({
                data: ref({
                    quests: {
                        edges: [
                            questEdge({
                                id: 'quest-active',
                                campaignId: 'camp-1',
                                title: 'Find the Ember Key',
                                description: 'Track the stolen key through Riverford.',
                                status: 'ACTIVE',
                                agendaImpact: null,
                                rewardNarrative: null,
                                rewardXp: null,
                                rewardGold: null,
                                createdAt: '2026-04-24T00:00:00.000Z',
                                objectives: [
                                    {
                                        id: 'obj-2',
                                        description: 'Question the ferryman',
                                        type: 'TALK_TO_NPC',
                                        status: 'PENDING',
                                        entityId: 'npc-1',
                                        order: 2,
                                    },
                                    {
                                        id: 'obj-1',
                                        description: 'Search the bridge',
                                        type: 'VISIT_LOCATION',
                                        status: 'COMPLETE',
                                        entityId: 'loc-1',
                                        order: 1,
                                    },
                                ],
                                entities: [],
                            }),
                        ],
                        pageInfo: { hasNextPage: false, endCursor: null },
                    },
                }),
                fetching: ref(false),
            } as never)
            .mockReturnValueOnce({
                data: ref({
                    quests: {
                        edges: [
                            questEdge({
                                id: 'quest-completed',
                                campaignId: 'camp-1',
                                title: 'Calm the Old Shrine',
                                description: 'Restore silence to the haunted shrine.',
                                status: 'COMPLETED',
                                agendaImpact: null,
                                rewardNarrative: 'The shrine keeper grants a silver charm.',
                                rewardXp: 150,
                                rewardGold: 25,
                                createdAt: '2026-04-24T00:00:00.000Z',
                                objectives: [{
                                    id: 'obj-3',
                                    description: 'Light the altar flame',
                                    type: 'CUSTOM',
                                    status: 'COMPLETE',
                                    entityId: null,
                                    order: 1,
                                }],
                                entities: [],
                            }),
                        ],
                        pageInfo: { hasNextPage: false, endCursor: null },
                    },
                }),
                fetching: ref(false),
            } as never);

        const wrapper = mount(QuestsPage, { global: { stubs: globalStubs } });
        await flushPromises();

        expect(wrapper.text()).toContain('Find the Ember Key');
        expect(wrapper.text()).toContain('Search the bridge');
        expect(wrapper.text()).toContain('Question the ferryman');

        await wrapper.find('button').trigger('click');
        await flushPromises();

        const text = wrapper.text();
        expect(text).toContain('Calm the Old Shrine');
        expect(text).toContain('The shrine keeper grants a silver charm.');
        expect(text).toContain('150 XP');
        expect(text).toContain('25 gp');
    });
});
