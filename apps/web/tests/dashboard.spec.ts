import { useMutation, useQuery } from '@urql/vue';
import { flushPromises, mount } from '@vue/test-utils';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';
import { ref } from 'vue';

import DashboardPage from '../pages/index.vue';

vi.mock('@urql/vue', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(),
}));

const globalStubs = {
    UAlert: { template: '<div>{{ description }}</div>', props: ['description', 'color', 'variant'] },
    UBadge: { template: '<span><slot /></span>', props: ['color', 'variant', 'size', 'icon'] },
    UButton: {
        template: '<button @click="$emit(\'click\')"><slot /></button>',
        props: ['icon', 'size', 'variant', 'disabled', 'loading', 'type'],
        emits: ['click'],
    },
    UCard: { template: '<div><slot /></div>', props: ['class'] },
    UForm: { template: '<form @submit.prevent="$emit(\'submit\')"><slot /></form>', emits: ['submit'] },
    UFormField: { template: '<label><slot /></label>', props: ['label', 'name'] },
    UIcon: { template: '<span />', props: ['name', 'class'] },
    UInput: { template: '<input />', props: ['modelValue', 'placeholder'] },
    UModal: { template: '<div><slot name="body" /></div>', props: ['open', 'title'] },
};

describe('DashboardPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('navigates ready campaigns to the play route from the Play control', async () => {
        const push = vi.fn();
        vi.stubGlobal('useRouter', vi.fn(() => ({ push })));
        vi.mocked(useQuery).mockReturnValue({
            data: ref({
                campaigns: {
                    edges: [{
                        node: {
                            id: 'camp-ready',
                            name: 'The Ember Vault',
                            setupStatus: 'READY_TO_PLAY',
                            status: 'ACTIVE',
                            inGameDate: '1st of Ches',
                        },
                    }],
                },
            }),
            fetching: ref(false),
            error: ref(null),
            executeQuery: vi.fn(),
        } as never);
        vi.mocked(useMutation).mockReturnValue({ executeMutation: vi.fn() } as never);

        const wrapper = mount(DashboardPage, { global: { stubs: globalStubs } });
        await flushPromises();

        const playButton = wrapper.findAll('button').find((button) => button.text().includes('Play'));
        await playButton?.trigger('click');

        expect(push).toHaveBeenCalledWith('/campaign/camp-ready/play');
    });
});
