// functions/api/login.js
// POST { password } -> sets mj_auth cookie and returns { ok: true } on success.

const COOKIE_NAME = 'mj_auth';

async function sign(value, secret) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
    return btoa(String.fromCharCode(...new Uint8Array(sig)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function onRequestPost(context) {
    const { request, env } = context;

    if (!env.SITE_PASSWORD || !env.COOKIE_SECRET) {
        return new Response(JSON.stringify({ ok: false, error: 'Server misconfigured.' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }

    let body;
    try {
        body = await request.json();
    } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'Bad request.' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!body || body.password !== env.SITE_PASSWORD) {
        return new Response(JSON.stringify({ ok: false, error: 'Wrong password.' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    }

    const token = await sign('authenticated', env.COOKIE_SECRET);
    const maxAge = 60 * 60 * 24 * 30; // 30 days

    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`
        }
    });
}
