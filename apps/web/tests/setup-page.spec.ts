import { useMutation, useQuery } from '@urql/vue';
import { flushPromises, mount } from '@vue/test-utils';
import {
    beforeEach, describe, expect, it, vi,
} from 'vitest';
import { ref } from 'vue';

import SetupPage from '../pages/campaign/[id]/setup.vue';

vi.mock('@urql/vue', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(),
}));

const globalStubs = {
    UAlert: { template: '<div>{{ description }}</div>', props: ['description', 'class', 'color', 'variant'] },
    UButton: {
        template: '<button :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
        props: ['block', 'class', 'disabled', 'icon', 'loading', 'type', 'variant'],
        emits: ['click'],
    },
    UCard: {
        template: '<section><slot name="header" /><slot /><slot name="footer" /></section>',
    },
    UForm: { template: '<form @submit.prevent="$emit(\'submit\')"><slot /></form>', emits: ['submit'] },
    UFormField: { template: '<label><slot /></label>', props: ['label', 'name'] },
    UIcon: { template: '<span />', props: ['name', 'class'] },
    UInput: {
        template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        props: ['modelValue', 'placeholder'],
        emits: ['update:modelValue'],
    },
};

describe('SetupPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('useRoute', vi.fn(() => ({ params: { id: 'camp-ready' }, query: {} })));
    });

    it('navigates to play from completed setup', async () => {
        const push = vi.fn();
        vi.stubGlobal('useRouter', vi.fn(() => ({ push })));
        vi.mocked(useQuery).mockReturnValue({
            data: ref({
                campaign: {
                    id: 'camp-ready',
                    name: 'The Ember Vault',
                    setupStatus: 'READY_TO_PLAY',
                    hasCharacter: true,
                    tone: 'HEROIC',
                    deathMode: 'STANDARD',
                    generatedConcepts: [],
                    selectedConcept: null,
                    inGameDate: '1st of Ches',
                },
            }),
            fetching: ref(false),
            error: ref(null),
            executeQuery: vi.fn(),
        } as never);
        vi.mocked(useMutation).mockReturnValue({ executeMutation: vi.fn() } as never);

        const wrapper = mount(SetupPage, { global: { stubs: globalStubs } });
        await flushPromises();

        const startButton = wrapper.findAll('button').find((button) => button.text().includes('Begin your story'));
        await startButton?.trigger('click');

        expect(push).toHaveBeenCalledWith('/campaign/camp-ready/play');
    });
});
