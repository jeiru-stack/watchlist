// functions/api/items.js
// GET  -> returns the current library as JSON (or null if never initialized)
// POST -> { items: [...] } overwrites the whole library (used once, to seed it)
//
// Requires a KV namespace bound as LIBRARY_KV in the Pages project settings.

const KEY = 'library:items';

export async function onRequestGet(context) {
    const { env } = context;
    const raw = await env.LIBRARY_KV.get(KEY);
    return new Response(raw || 'null', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'Bad request.' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }
    if (!body || !Array.isArray(body.items)) {
        return new Response(JSON.stringify({ ok: false, error: 'Expected { items: [...] }' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }
    await env.LIBRARY_KV.put(KEY, JSON.stringify(body.items));
    return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
    });
}
