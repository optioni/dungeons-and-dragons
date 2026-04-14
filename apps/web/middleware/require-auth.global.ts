// Redirects unauthenticated users away from all non-auth pages to /auth
export default defineNuxtRouteMiddleware((to) => {
    if (to.path === '/auth') return;

    const cookie = useCookie('access_token');
    if (!cookie.value) {
        return navigateTo('/auth');
    }
});
