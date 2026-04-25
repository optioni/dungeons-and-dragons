import {
    defineNuxtRouteMiddleware,
    navigateTo,
    useCookie,
} from '#imports';

// Redirects authenticated users away from /auth to /.
// Server: check the httpOnly access_token cookie (readable in SSR request headers).
// Client: check the non-httpOnly is_authenticated flag set after login/register.
export default defineNuxtRouteMiddleware((to) => {
    const cookieName = import.meta.server ? 'access_token' : 'is_authenticated';
    const cookie = useCookie(cookieName);
    return to.path === '/auth' && cookie.value ? navigateTo('/') : undefined;
});
