// functions/api/rate.js
// POST { id, person: "may"|"jay", rating: 0.5-5, comment: string } -> updates
// that item's watched[person] entry and returns the updated item.
//
// Requires a KV namespace bound as LIBRARY_KV in the Pages project settings.

const KEY = 'library:items';

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

    const { id, person, rating, comment } = body || {};
    if (typeof id !== 'number' || (person !== 'may' && person !== 'jay')) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid id or person.' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }
    const numRating = Number(rating);
    if (!Number.isFinite(numRating) || numRating < 0.5 || numRating > 5) {
        return new Response(JSON.stringify({ ok: false, error: 'Rating must be 0.5-5.' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }

    const raw = await env.LIBRARY_KV.get(KEY);
    if (!raw) {
        return new Response(JSON.stringify({ ok: false, error: 'Library not initialized yet.' }), {
            status: 409, headers: { 'Content-Type': 'application/json' }
        });
    }
    const items = JSON.parse(raw);
    const item = items.find(i => i.id === id);
    if (!item) {
        return new Response(JSON.stringify({ ok: false, error: 'Item not found.' }), {
            status: 404, headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!item.watched) item.watched = {};
    item.watched[person] = { rating: numRating, comment: String(comment || '').slice(0, 1000) };

    await env.LIBRARY_KV.put(KEY, JSON.stringify(items));

    return new Response(JSON.stringify({ ok: true, item }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
    });
}
