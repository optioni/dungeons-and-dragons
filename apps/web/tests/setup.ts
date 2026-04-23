import { vi } from 'vitest';
import {
    computed,
    nextTick,
    reactive,
    readonly,
    ref,
    watch,
    watchEffect,
} from 'vue';

// Nuxt auto-imports Vue reactive APIs as globals — replicate that in tests
vi.stubGlobal('ref', ref);
vi.stubGlobal('computed', computed);
vi.stubGlobal('watch', watch);
vi.stubGlobal('watchEffect', watchEffect);
vi.stubGlobal('nextTick', nextTick);
vi.stubGlobal('reactive', reactive);
vi.stubGlobal('readonly', readonly);

// Nuxt-specific composables used in page components
vi.stubGlobal('definePageMeta', vi.fn());
vi.stubGlobal('useRoute', vi.fn(() => ({ params: { id: 'test-campaign-id' }, query: {} })));
vi.stubGlobal('useRouter', vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })));
vi.stubGlobal('useRuntimeConfig', vi.fn(() => ({ public: { apiUrl: 'http://localhost:3000' } })));
