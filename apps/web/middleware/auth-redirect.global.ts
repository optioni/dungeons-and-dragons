import {
    defineNuxtRouteMiddleware,
    navigateTo,
    useCookie,
} from '#imports';

// Redirects authenticated users away from /auth to /
export default defineNuxtRouteMiddleware((to) => {
    const cookie = useCookie('access_token');
    return to.path === '/auth' && cookie.value ? navigateTo('/') : undefined;
});
