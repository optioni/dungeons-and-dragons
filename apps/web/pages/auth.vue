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

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-950 p-4">
    <div class="w-full max-w-md space-y-8">
      <!-- Login form -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Log in</h2>
        </template>

        <UForm class="space-y-4" @submit.prevent="submitLogin">
          <UFormField label="Email" name="email">
            <UInput
              v-model="loginEmail"
              type="email"
              placeholder="you@example.com"
              required
              autocomplete="email"
            />
          </UFormField>

          <UFormField label="Password" name="password">
            <UInput
              v-model="loginPassword"
              type="password"
              placeholder="••••••••"
              required
              autocomplete="current-password"
            />
          </UFormField>

          <UAlert
            v-if="loginError"
            color="error"
            variant="soft"
            :description="loginError"
          />

          <UButton
            type="submit"
            block
            :loading="loginLoading"
          >
            Log in
          </UButton>
        </UForm>
      </UCard>

      <!-- Registration form -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Create account</h2>
        </template>

        <UForm class="space-y-4" @submit.prevent="submitRegister">
          <UFormField label="Email" name="email">
            <UInput
              v-model="registerEmail"
              type="email"
              placeholder="you@example.com"
              required
              autocomplete="email"
            />
          </UFormField>

          <UFormField label="Password" name="password">
            <UInput
              v-model="registerPassword"
              type="password"
              placeholder="••••••••"
              required
              minlength="8"
              autocomplete="new-password"
            />
          </UFormField>

          <UFormField label="Confirm password" name="confirm">
            <UInput
              v-model="registerConfirm"
              type="password"
              placeholder="••••••••"
              required
              autocomplete="new-password"
            />
          </UFormField>

          <UAlert
            v-if="registerError"
            color="error"
            variant="soft"
            :description="registerError"
          />

          <UButton
            type="submit"
            block
            :loading="registerLoading"
          >
            Create account
          </UButton>
        </UForm>
      </UCard>
    </div>
  </div>
</template>
