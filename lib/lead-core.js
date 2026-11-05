/**
 * INTI AI | Núcleo compartido de validación y envío de leads.
 *
 * Este módulo no depende de Node ni de Cloudflare: usa únicamente Web APIs
 * (URL, TextEncoder, crypto.subtle, fetch) para poder ejecutarse tanto en
 * Cloudflare Pages Functions como en Vercel Functions.
 *
 * El webhook de Make.com NUNCA se expone al cliente. Vive en la variable de
 * entorno MAKE_WEBHOOK_URL y solo lo lee este código server-side.
 */

export const POLICY_VERSION = "2026-11-02";
export const MAX_BODY_BYTES = 8 * 1024;
export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_RATE_LIMIT = 8;
export const DEFAULT_RATE_WINDOW_MS = 10 * 60 * 1000;

const ETAPAS_PERMITIDAS = new Set(["inicial", "crecimiento", "escala"]);
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const DEFAULT_ALLOWED_ORIGINS = new Set([
    "https://intiai.pages.dev",
    "https://inti.ai",
    "https://www.inti.ai"
]);

/**
 * Limpia texto de control y caracteres peligrosos para evitar inyecciones en
 * los consumidores downstream (correo, CRM, hojas de cálculo).
 */
export function sanitizeText(value, maxLength = 200) {
    if (typeof value !== "string") return "";

    return value
        .normalize("NFKC")
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .replace(/[<>]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);
}

export function isValidEmail(value) {
    if (typeof value !== "string") return false;
    const email = value.trim();
    if (email.length < 6 || email.length > 60) return false;
    if (/[<>\s]/.test(email)) return false;
    return EMAIL_RE.test(email);
}

/**
 * Normaliza un teléfono a formato internacional legible y a dígitos puros.
 * No inventa el código de país: si el usuario no lo escribió, no lo agrega.
 */
export function normalizePhone(value) {
    if (typeof value !== "string") {
        return { ok: false, display: "", digits: "" };
    }

    const trimmed = value.trim();
    let digits = trimmed.replace(/\D/g, "");
    const hadCountryPrefix = trimmed.startsWith("+") || digits.startsWith("00");

    if (digits.startsWith("00")) {
        digits = digits.slice(2);
    }

    if (digits.length < 8 || digits.length > 15) {
        return { ok: false, display: "", digits };
    }

    return {
        ok: true,
        display: hadCountryPrefix ? `+${digits}` : digits,
        digits
    };
}

export function normalizeAttribution(input) {
    const result = {};

    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return result;
    }

    for (const key of UTM_KEYS) {
        const value = sanitizeText(input[key], 100);
        if (value) result[key] = value;
    }

    const referrer = sanitizeText(input.referrer, 300);
    if (/^https?:\/\//i.test(referrer)) {
        result.referrer = referrer;
    }

    return result;
}

/**
 * Valida y normaliza el payload del formulario.
 * Devuelve { ok, data } o { ok: false, errors }.
 */
export function validateLead(input) {
    const errors = {};

    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return { ok: false, errors: { form: "La solicitud no es válida." } };
    }

    const rawNombre = typeof input.nombre === "string" ? input.nombre.trim() : "";
    const rawEmail = typeof input.email === "string" ? input.email.trim() : "";
    const rawNegocio = typeof input.negocio === "string" ? input.negocio.trim() : "";

    const nombre = sanitizeText(rawNombre, 50);
    const email = rawEmail.toLowerCase();
    const negocio = sanitizeText(rawNegocio, 60);
    const phone = normalizePhone(input.telefono);
    const etapa = sanitizeText(input.etapa_negocio, 20).toLowerCase();

    if (rawNombre.length > 50) {
        errors.nombre = "El nombre no puede superar los 50 caracteres.";
    } else if (nombre.length < 2) {
        errors.nombre = "Ingresá tu nombre (mínimo 2 caracteres).";
    }

    if (rawEmail.length > 60) {
        errors.email = "El correo no puede superar los 60 caracteres.";
    } else if (!isValidEmail(email)) {
        errors.email = "Ingresá un correo electrónico válido.";
    }

    if (rawNegocio.length > 60) {
        errors.negocio = "El rubro no puede superar los 60 caracteres.";
    } else if (negocio.length < 2) {
        errors.negocio = "Ingresá tu rubro o nicho (mínimo 2 caracteres).";
    }

    if (!phone.ok) {
        errors.telefono = "Ingresá un número de WhatsApp válido (entre 8 y 15 dígitos).";
    }

    if (!ETAPAS_PERMITIDAS.has(etapa)) {
        errors.etapa_negocio = "Seleccioná en qué etapa está tu negocio.";
    }

    if (input.consentimiento !== true) {
        errors.consentimiento = "Necesitamos tu consentimiento para tratar tus datos.";
    }

    if (Object.keys(errors).length > 0) {
        return { ok: false, errors };
    }

    return {
        ok: true,
        data: {
            nombre,
            email,
            negocio,
            telefono: phone.display,
            telefono_digitos: phone.digits,
            etapa_negocio: etapa,
            consentimiento: true,
            atribucion: normalizeAttribution(input.atribucion)
        }
    };
}

export function getHeader(headers, name) {
    if (!headers) return "";

    if (typeof headers.get === "function") {
        return headers.get(name) || "";
    }

    const wanted = String(name).toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() !== wanted) continue;
        const value = headers[key];
        return Array.isArray(value) ? value.join(", ") : String(value ?? "");
    }

    return "";
}

export function getClientIp(headers) {
    const direct = getHeader(headers, "cf-connecting-ip").trim();
    if (direct) return direct;

    const forwarded = getHeader(headers, "x-forwarded-for").trim();
    if (forwarded) return forwarded.split(",")[0].trim();

    return getHeader(headers, "x-real-ip").trim();
}

export function isAllowedOrigin(origin, env = {}) {
    // Los clientes server-to-server (tests, monitoreo) no envían Origin.
    // La protección real contra abuso es el rate limit + honeypot + validación.
    if (!origin) return true;

    let url;
    try {
        url = new URL(origin);
    } catch {
        return false;
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") return false;

    const configured = String(env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

    if (configured.includes(origin) || DEFAULT_ALLOWED_ORIGINS.has(url.origin)) {
        return true;
    }

    const host = url.hostname.toLowerCase();

    // Desarrollo local en cualquier puerto.
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
        return true;
    }

    // Preview deployments del proyecto en Cloudflare Pages.
    if (host === "intiai.pages.dev" || host.endsWith(".intiai.pages.dev")) {
        return true;
    }

    // Dominio actual y dominio objetivo.
    if (host === "inti.ai" || host === "www.inti.ai") {
        return true;
    }

    return false;
}

export function isValidWebhookUrl(value) {
    if (typeof value !== "string" || value.length === 0) return false;

    let url;
    try {
        url = new URL(value);
    } catch {
        return false;
    }

    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;

    const host = url.hostname.toLowerCase();

    return (
        host === "hook.make.com" ||
        host === "hook.integromat.com" ||
        /^hook\.[a-z0-9-]+\.make\.com$/.test(host)
    );
}

export async function hashIp(ip, salt = "inti-ai-rate-salt") {
    const value = `${ip || "unknown"}:${salt || "inti-ai-rate-salt"}`;
    const bytes = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Rate limit en memoria por isolate/proceso. Es una primera barrera contra
 * spam; para producción de alto tráfico conviene complementarlo con Cloudflare
 * KV/D1 o Turnstile.
 */
export function createRateLimiter({
    limit = DEFAULT_RATE_LIMIT,
    windowMs = DEFAULT_RATE_WINDOW_MS,
    maxEntries = 5000
} = {}) {
    const buckets = new Map();

    return {
        check(key) {
            const now = Date.now();
            const current = buckets.get(key);

            if (!current || now >= current.resetAt) {
                buckets.set(key, { count: 1, resetAt: now + windowMs });

                if (buckets.size > maxEntries) {
                    for (const [bucketKey, bucket] of buckets) {
                        if (now >= bucket.resetAt) buckets.delete(bucketKey);
                    }
                    while (buckets.size > maxEntries) {
                        buckets.delete(buckets.keys().next().value);
                    }
                }

                return { allowed: true, remaining: limit - 1, retryAfter: 0 };
            }

            if (current.count >= limit) {
                return {
                    allowed: false,
                    remaining: 0,
                    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
                };
            }

            current.count += 1;
            return { allowed: true, remaining: limit - current.count, retryAfter: 0 };
        },

        reset() {
            buckets.clear();
        },

        get size() {
            return buckets.size;
        }
    };
}

export const defaultRateLimiter = createRateLimiter();

function jsonResponse(status, body, extraHeaders = {}) {
    return {
        status,
        body,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            ...extraHeaders
        }
    };
}

function buildWebhookPayload({ data, headers, ipHash, receivedAt }) {
    const origin = getHeader(headers, "origin") || "https://intiai.pages.dev/";

    return {
        origen: "landing-intiai",
        lead_id:
            globalThis.crypto?.randomUUID?.() ||
            `${receivedAt}-${String(ipHash).slice(0, 8)}`,
        nombre: data.nombre,
        email: data.email,
        negocio: data.negocio,
        telefono: data.telefono,
        telefono_digitos: data.telefono_digitos,
        etapa_negocio: data.etapa_negocio,
        consentimiento: true,
        consentimiento_texto:
            "Aceptó la Política de Privacidad y el tratamiento de sus datos personales para recibir el diagnóstico.",
        consentimiento_fecha: receivedAt,
        politica_version: POLICY_VERSION,
        pagina: origin,
        recibido_en: receivedAt,
        utm_source: data.atribucion.utm_source || "",
        utm_medium: data.atribucion.utm_medium || "",
        utm_campaign: data.atribucion.utm_campaign || "",
        utm_content: data.atribucion.utm_content || "",
        utm_term: data.atribucion.utm_term || "",
        referrer: data.atribucion.referrer || "",
        ip_hash: String(ipHash).slice(0, 24),
        user_agent: sanitizeText(getHeader(headers, "user-agent"), 180)
    };
}

/**
 * Procesa una solicitud de lead de punta a punta.
 *
 * @param {object} options
 * @param {string} options.rawBody Cuerpo JSON crudo del request.
 * @param {Headers|object} options.headers Cabeceras del request.
 * @param {object} options.env Variables de entorno (MAKE_WEBHOOK_URL, RATE_SALT...).
 * @param {string} options.ip IP del cliente para el rate limit.
 * @param {object} [options.rateLimiter] Limitador inyectable para tests.
 * @param {Function} [options.fetchImpl] fetch inyectable para tests.
 * @param {Function} [options.now] Reloj inyectable para tests.
 * @param {number} [options.timeoutMs] Timeout del webhook.
 * @param {object} [options.logger] Logger inyectable para tests.
 * @returns {Promise<{status: number, body: object, headers: object}>}
 */
export async function processLead({
    rawBody,
    headers = {},
    env = {},
    ip = "",
    rateLimiter = defaultRateLimiter,
    fetchImpl = globalThis.fetch,
    now = Date.now,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    logger = console
} = {}) {
    if (typeof rawBody !== "string" || rawBody.trim().length === 0) {
        return jsonResponse(400, {
            ok: false,
            error: "invalid",
            message: "La solicitud está vacía."
        });
    }

    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
        return jsonResponse(413, {
            ok: false,
            error: "payload_too_large",
            message: "La solicitud es demasiado grande."
        });
    }

    const contentType = getHeader(headers, "content-type");
    if (contentType && !/^application\/json\b/i.test(contentType)) {
        return jsonResponse(415, {
            ok: false,
            error: "unsupported_media_type",
            message: "El formato de la solicitud no es válido."
        });
    }

    let input;
    try {
        input = JSON.parse(rawBody);
    } catch {
        return jsonResponse(400, {
            ok: false,
            error: "invalid_json",
            message: "La solicitud no contiene JSON válido."
        });
    }

    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return jsonResponse(400, {
            ok: false,
            error: "invalid",
            message: "La solicitud no es válida."
        });
    }

    const origin = getHeader(headers, "origin");
    if (!isAllowedOrigin(origin, env)) {
        return jsonResponse(403, {
            ok: false,
            error: "origin_not_allowed",
            message: "Origen no permitido."
        });
    }

    const limiter = rateLimiter || defaultRateLimiter;
    const ipHash = await hashIp(ip, env.RATE_SALT || "inti-ai-rate-salt");
    const rate = limiter.check(ipHash);

    if (!rate.allowed) {
        return jsonResponse(
            429,
            {
                ok: false,
                error: "rate_limited",
                message: "Recibimos varias solicitudes seguidas. Esperá unos segundos e intentá de nuevo."
            },
            { "Retry-After": String(rate.retryAfter) }
        );
    }

    // Honeypot: si un bot completó el campo oculto, simulamos éxito y no
    // reenviamos nada al webhook.
    if (sanitizeText(input.empresa_web, 120)) {
        return jsonResponse(200, { ok: true });
    }

    const validation = validateLead(input);
    if (!validation.ok) {
        return jsonResponse(400, {
            ok: false,
            error: "invalid",
            message: "Revisá los datos ingresados e intentá nuevamente.",
            fields: validation.errors
        });
    }

    if (!isValidWebhookUrl(env.MAKE_WEBHOOK_URL)) {
        logger.error?.("[lead] MAKE_WEBHOOK_URL no configurada o con un host no permitido.");
        return jsonResponse(503, {
            ok: false,
            error: "not_configured",
            message: "El servicio de recepción no está disponible. Escribinos por WhatsApp."
        });
    }

    const receivedAt = new Date(typeof now === "function" ? now() : Date.now()).toISOString();
    const payload = buildWebhookPayload({
        data: validation.data,
        headers,
        ipHash,
        receivedAt
    });

    const controller = new AbortController();
    const safeTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(), safeTimeout);

    try {
        const response = await fetchImpl(env.MAKE_WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
            redirect: "error"
        });

        if (!response.ok) {
            logger.error?.(`[lead] El webhook respondió con estado ${response.status}.`);
            return jsonResponse(502, {
                ok: false,
                error: "upstream_error",
                message: "No pudimos registrar tu solicitud. Escribinos por WhatsApp."
            });
        }

        return jsonResponse(200, { ok: true });
    } catch (error) {
        if (error?.name === "AbortError") {
            logger.error?.("[lead] Timeout al enviar el lead al webhook.");
            return jsonResponse(504, {
                ok: false,
                error: "timeout",
                message: "La conexión tardó demasiado. Revisá tu internet e intentá nuevamente."
            });
        }

        logger.error?.("[lead] Error de red al enviar el lead al webhook.");
        return jsonResponse(502, {
            ok: false,
            error: "upstream_error",
            message: "No pudimos registrar tu solicitud. Escribinos por WhatsApp."
        });
    } finally {
        clearTimeout(timeoutId);
    }
}
