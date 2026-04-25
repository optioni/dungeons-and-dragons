<template>
    <div class="min-h-screen grimoire-bg flex items-center justify-center p-6">
        <!-- Candlelight radial glow -->
        <div
            class="pointer-events-none fixed inset-0 z-0"
            style="background: radial-gradient(ellipse 60% 55% at 50% 52%, color-mix(in srgb, #c8922a 6%, transparent) 0%, transparent 70%);"
        />

        <div class="w-full max-w-sm relative z-10 space-y-10 grimoire-page-enter">
            <!-- Decorative corner border -->
            <div class="absolute -inset-8 pointer-events-none hidden sm:block" aria-hidden="true">
                <svg class="w-full h-full opacity-10" viewBox="0 0 320 480" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                    <rect x="1" y="1" width="318" height="478" stroke="#c8922a" stroke-width="0.75" />
                    <rect x="8" y="8" width="304" height="464" stroke="#c8922a" stroke-width="0.5" />
                    <!-- Corners -->
                    <path d="M1 30 L1 1 L30 1" stroke="#c8922a" stroke-width="1.5" fill="none" />
                    <path d="M319 30 L319 1 L290 1" stroke="#c8922a" stroke-width="1.5" fill="none" />
                    <path d="M1 450 L1 479 L30 479" stroke="#c8922a" stroke-width="1.5" fill="none" />
                    <path d="M319 450 L319 479 L290 479" stroke="#c8922a" stroke-width="1.5" fill="none" />
                </svg>
            </div>
            <!-- Wordmark -->
            <div class="text-center space-y-2">
                <h1 class="font-['IM_Fell_English',serif] text-5xl text-grimoire-text">Grimoire</h1>

                <p class="font-['Cinzel',serif] text-xs tracking-[0.4em] uppercase text-grimoire-muted">
                    A Solo Chronicle
                </p>
            </div>

            <!-- Login form -->
            <div v-if="!showRegister" class="space-y-6">
                <u-form class="space-y-5" @submit.prevent="submitLogin">
                    <div class="space-y-1.5">
                        <label class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted">
                            Email
                        </label>

                        <u-input
                            v-model="loginEmail"
                            type="email"
                            placeholder="you@example.com"
                            required
                            autocomplete="email"
                        />
                    </div>

                    <div class="space-y-1.5">
                        <label class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted">
                            Password
                        </label>

                        <u-input
                            v-model="loginPassword"
                            type="password"
                            placeholder="••••••••"
                            required
                            autocomplete="current-password"
                        />
                    </div>

                    <u-alert
                        v-if="loginError"
                        color="error"
                        variant="soft"
                        :description="loginError"
                    />

                    <button
                        type="submit"
                        class="w-full py-3 bg-grimoire-accent text-grimoire-bg font-['Cinzel',serif]
                               text-sm tracking-widest uppercase hover:bg-grimoire-accent/90
                               transition-colors duration-200 disabled:opacity-50"
                        :disabled="loginLoading"
                    >
                        {{ loginLoading ? 'Entering...' : 'Enter' }}
                    </button>
                </u-form>

                <!-- Toggle to register -->
                <p class="text-center">
                    <button
                        type="button"
                        class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted
                               hover:text-grimoire-text transition-colors duration-150"
                        @click="showRegister = true"
                    >
                        Begin a new chronicle →
                    </button>
                </p>
            </div>

            <!-- Register form -->
            <div v-else class="space-y-6">
                <u-form class="space-y-5" @submit.prevent="submitRegister">
                    <div class="space-y-1.5">
                        <label class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted">
                            Email
                        </label>

                        <u-input
                            v-model="registerEmail"
                            type="email"
                            placeholder="you@example.com"
                            required
                            autocomplete="email"
                        />
                    </div>

                    <div class="space-y-1.5">
                        <label class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted">
                            Password
                        </label>

                        <u-input
                            v-model="registerPassword"
                            type="password"
                            placeholder="••••••••"
                            required
                            minlength="8"
                            autocomplete="new-password"
                        />
                    </div>

                    <div class="space-y-1.5">
                        <label class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted">
                            Confirm Password
                        </label>

                        <u-input
                            v-model="registerConfirm"
                            type="password"
                            placeholder="••••••••"
                            required
                            autocomplete="new-password"
                        />
                    </div>

                    <u-alert
                        v-if="registerError"
                        color="error"
                        variant="soft"
                        :description="registerError"
                    />

                    <button
                        type="submit"
                        class="w-full py-3 bg-grimoire-accent text-grimoire-bg font-['Cinzel',serif]
                               text-sm tracking-widest uppercase hover:bg-grimoire-accent/90
                               transition-colors duration-200 disabled:opacity-50"
                        :disabled="registerLoading"
                    >
                        {{ registerLoading ? 'Forging chronicle...' : 'Forge Chronicle' }}
                    </button>
                </u-form>

                <!-- Toggle to login -->
                <p class="text-center">
                    <button
                        type="button"
                        class="font-['Cinzel',serif] text-xs tracking-widest uppercase text-grimoire-muted
                               hover:text-grimoire-text transition-colors duration-150"
                        @click="showRegister = false"
                    >
                        ← Return to the gates
                    </button>
                </p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useMutation } from '@urql/vue';

definePageMeta({ layout: false });

const router = useRouter();
const isAuthenticated = useCookie('is_authenticated');

const REGISTER_MUTATION = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
    }
  }
`;

const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
    }
  }
`;

const { executeMutation: executeRegister } = useMutation(REGISTER_MUTATION);
const { executeMutation: executeLogin } = useMutation(LOGIN_MUTATION);

const showRegister = ref(false);

// Registration form
const registerEmail = ref('');
const registerPassword = ref('');
const registerConfirm = ref('');
const registerError = ref('');
const registerLoading = ref(false);

async function submitRegister() {
    registerError.value = '';

    if (registerPassword.value !== registerConfirm.value) {
        registerError.value = 'Passwords do not match';
        return;
    }

    registerLoading.value = true;
    try {
        const result = await executeRegister({
            input: { email: registerEmail.value, password: registerPassword.value },
        });

        if (result.error) {
            registerError.value = result.error.graphQLErrors[0]?.message ?? 'Registration failed';
            return;
        }

        isAuthenticated.value = '1';
        router.push('/');
    } finally {
        registerLoading.value = false;
    }
}

// Login form
const loginEmail = ref('');
const loginPassword = ref('');
const loginError = ref('');
const loginLoading = ref(false);

async function submitLogin() {
    loginError.value = '';
    loginLoading.value = true;

    try {
        const result = await executeLogin({
            input: { email: loginEmail.value, password: loginPassword.value },
        });

        if (result.error) {
            loginError.value = 'Invalid email or password';
            return;
        }

        isAuthenticated.value = '1';
        router.push('/');
    } finally {
        loginLoading.value = false;
    }
}
</script>
