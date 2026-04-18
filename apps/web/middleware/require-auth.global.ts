// Redirects unauthenticated users away from all non-auth pages to /auth
export default defineNuxtRouteMiddleware((to) => {
    const cookie = useCookie('access_token');
    return to.path !== '/auth' && !cookie.value ? navigateTo('/auth') : undefined;
});
