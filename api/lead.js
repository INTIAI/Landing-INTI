import {
    createRateLimiter,
    getClientIp,
    processLead
} from "../lib/lead-core.js";

/**
 * Vercel Function: POST /api/lead
 *
 * Mantiene el mismo contrato que la función de Cloudflare Pages para que el
 * formulario funcione igual en ambos hosts durante la migración.
 */
const limiter = createRateLimiter();

function headersToObject(request) {
    const headers = {};

    for (const [key, value] of Object.entries(request.headers || {})) {
        if (value === undefined || value === null) continue;
        headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
    }

    return headers;
}

function rawBodyFrom(request) {
    if (typeof request.body === "string") return request.body;
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(request.body)) {
        return request.body.toString("utf8");
    }
    if (request.body && typeof request.body === "object") {
        return JSON.stringify(request.body);
    }
    return "";
}

export default async function handler(request, response) {
    if (request.method !== "POST") {
        response.statusCode = 405;
        response.setHeader("Allow", "POST");
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(
            JSON.stringify({
                ok: false,
                error: "method_not_allowed",
                message: "Método no permitido."
            })
        );
        return;
    }

    try {
        const headers = headersToObject(request);
        const ip =
            getClientIp(headers) ||
            request.socket?.remoteAddress ||
            "";

        const result = await processLead({
            rawBody: rawBodyFrom(request),
            headers,
            env: process.env,
            ip,
            rateLimiter: limiter,
            fetchImpl: fetch
        });

        response.statusCode = result.status;
        for (const [key, value] of Object.entries(result.headers)) {
            response.setHeader(key, value);
        }
        response.end(JSON.stringify(result.body));
    } catch (error) {
        console.error("[lead] Error inesperado en la función de Vercel.");
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(
            JSON.stringify({
                ok: false,
                error: "internal_error",
                message: "No pudimos procesar la solicitud. Escribinos por WhatsApp."
            })
        );
    }
}
