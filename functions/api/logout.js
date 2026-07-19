// functions/api/logout.js
export async function onRequestPost() {
    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': 'mj_auth=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
        }
    });
}
