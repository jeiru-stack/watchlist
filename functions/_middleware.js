// functions/_middleware.js
// Gates every request behind a shared password.
// Requires two Cloudflare Pages env vars (set as *secrets*, not plain vars):
//   SITE_PASSWORD   - the shared password May & Jay type in
//   COOKIE_SECRET    - any long random string, used to sign the auth cookie
//
// Public paths (no auth needed): /login.html, /api/login, /favicon and the
// login page's own asset. Everything else requires a valid "mj_auth" cookie.

const COOKIE_NAME = 'mj_auth';
const PUBLIC_PATHS = new Set(['/login.html', '/api/login']);

async function sign(value, secret) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
    return btoa(String.fromCharCode(...new Uint8Array(sig)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getCookie(request, name) {
    const header = request.headers.get('Cookie') || '';
    const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[1]) : null;
}

export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    if (PUBLIC_PATHS.has(url.pathname)) {
        return next();
    }

    if (!env.SITE_PASSWORD || !env.COOKIE_SECRET) {
        return new Response('Server is missing SITE_PASSWORD / COOKIE_SECRET env vars.', { status: 500 });
    }

    const cookie = getCookie(request, COOKIE_NAME);
    const expected = await sign('authenticated', env.COOKIE_SECRET);

    if (cookie === expected) {
        return next();
    }

    // Not authenticated: send HTML pages to the login screen,
    // everything else (API, assets) just gets a 401.
    if (request.headers.get('Accept')?.includes('text/html') || url.pathname === '/' ) {
        return Response.redirect(url.origin + '/login.html', 302);
    }
    return new Response('Unauthorized', { status: 401 });
}
