import {
    defineNuxtRouteMiddleware,
    navigateTo,
    useCookie,
} from '#imports';

// Redirects unauthenticated users away from all non-auth pages to /auth.
// Server: check the httpOnly access_token cookie (readable in SSR request headers).
// Client: check the non-httpOnly is_authenticated flag set after login/register.
export default defineNuxtRouteMiddleware((to) => {
    if (to.path === '/iframe.html') {
        return undefined;
    }

    const cookieName = import.meta.server ? 'access_token' : 'is_authenticated';
    const cookie = useCookie(cookieName);
    return to.path !== '/auth' && !cookie.value ? navigateTo('/auth') : undefined;
});
