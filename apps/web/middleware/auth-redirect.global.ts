// Redirects authenticated users away from /auth to /
export default defineNuxtRouteMiddleware((to) => {
    if (to.path !== '/auth') return;

    const cookie = useCookie('access_token');
    if (cookie.value) {
        return navigateTo('/');
    }
});
