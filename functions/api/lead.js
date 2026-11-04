import {
    createRateLimiter,
    getClientIp,
    processLead
} from "../../lib/lead-core.js";

/**
 * Cloudflare Pages Function: POST /api/lead
 *
 * El formulario del cliente llama a esta ruta. El webhook real de Make.com
 * queda guardado en la variable de entorno MAKE_WEBHOOK_URL y nunca se envía
 * al navegador.
 */
const limiter = createRateLimiter();

function jsonResponse(result) {
    return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: result.headers
    });
}

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== "POST") {
        return new Response(
            JSON.stringify({
                ok: false,
                error: "method_not_allowed",
                message: "Método no permitido."
            }),
            {
                status: 405,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Cache-Control": "no-store",
                    "X-Content-Type-Options": "nosniff",
                    "Allow": "POST"
                }
            }
        );
    }

    let rawBody = "";
    try {
        rawBody = await request.text();
    } catch {
        return jsonResponse({
            status: 400,
            body: {
                ok: false,
                error: "invalid_body",
                message: "No pudimos leer la solicitud."
            },
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-store"
            }
        });
    }

    const result = await processLead({
        rawBody,
        headers: request.headers,
        env,
        ip: getClientIp(request.headers),
        rateLimiter: limiter,
        fetchImpl: fetch
    });

    return jsonResponse(result);
}
