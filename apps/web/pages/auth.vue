<template>
    <div class="min-h-screen flex items-center justify-center bg-gray-950 p-4">
        <div class="w-full max-w-md space-y-8">
            <!-- Login form -->
            <u-card>
                <template #header>
                    <h2 class="text-xl font-semibold">Log in</h2>
                </template>

                <u-form class="space-y-4"
                    @submit.prevent="submitLogin">
                    <u-form-field label="Email"
                        name="email">
                        <u-input
                            v-model="loginEmail"
                            type="email"
                            placeholder="you@example.com"
                            required
                            autocomplete="email"
                        />
                    </u-form-field>

                    <u-form-field label="Password"
                        name="password">
                        <u-input
                            v-model="loginPassword"
                            type="password"
                            placeholder="••••••••"
                            required
                            autocomplete="current-password"
                        />
                    </u-form-field>

                    <u-alert
                        v-if="loginError"
                        color="error"
                        variant="soft"
                        :description="loginError"
                    />

                    <u-button
                        type="submit"
                        block
                        :loading="loginLoading"
                    >
                        Log in
                    </u-button>
                </u-form>
            </u-card>

            <!-- Registration form -->
            <u-card>
                <template #header>
                    <h2 class="text-xl font-semibold">Create account</h2>
                </template>

                <u-form class="space-y-4"
                    @submit.prevent="submitRegister">
                    <u-form-field label="Email"
                        name="email">
                        <u-input
                            v-model="registerEmail"
                            type="email"
                            placeholder="you@example.com"
                            required
                            autocomplete="email"
                        />
                    </u-form-field>

                    <u-form-field label="Password"
                        name="password">
                        <u-input
                            v-model="registerPassword"
                            type="password"
                            placeholder="••••••••"
                            required
                            minlength="8"
                            autocomplete="new-password"
                        />
                    </u-form-field>

                    <u-form-field label="Confirm password"
                        name="confirm">
                        <u-input
                            v-model="registerConfirm"
                            type="password"
                            placeholder="••••••••"
                            required
                            autocomplete="new-password"
                        />
                    </u-form-field>

                    <u-alert
                        v-if="registerError"
                        color="error"
                        variant="soft"
                        :description="registerError"
                    />

                    <u-button
                        type="submit"
                        block
                        :loading="registerLoading"
                    >
                        Create account
                    </u-button>
                </u-form>
            </u-card>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useMutation } from '@urql/vue';

definePageMeta({ layout: false });

const router = useRouter();

// GraphQL mutations
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

        router.push('/');
    } finally {
        loginLoading.value = false;
    }
}
</script>
