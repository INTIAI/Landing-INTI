import test from "node:test";
import assert from "node:assert/strict";

import {
    createRateLimiter,
    getClientIp,
    getHeader,
    hashIp,
    isAllowedOrigin,
    isValidEmail,
    isValidWebhookUrl,
    normalizeAttribution,
    normalizePhone,
    processLead,
    sanitizeText,
    validateLead
} from "../lib/lead-core.js";

const validInput = {
    nombre: "Ana Pérez",
    email: "ANA@Example.com",
    negocio: "Estudio contable",
    telefono: "+54 9 3447 526699",
    etapa_negocio: "crecimiento",
    consentimiento: true,
    empresa_web: "",
    atribucion: {
        utm_source: "instagram",
        utm_medium: "social",
        utm_campaign: "auditoria-noviembre",
        referrer: "https://www.instagram.com/"
    }
};

const baseEnv = {
    MAKE_WEBHOOK_URL: "https://hook.eu1.make.com/test-webhook",
    RATE_SALT: "test-salt"
};

const baseHeaders = {
    "content-type": "application/json",
    origin: "https://intiai.online",
    "user-agent": "INTI-AI-Test/1.0"
};

const silentLogger = { error() {} };

function makeFetch({ status = 200, body = "OK" } = {}) {
    const calls = [];

    const fetchImpl = async (url, init) => {
        calls.push({ url, init });
        return new Response(body, { status });
    };

    return { fetchImpl, calls };
}

async function runLead(overrides = {}) {
    return processLead({
        rawBody: JSON.stringify(validInput),
        headers: baseHeaders,
        env: baseEnv,
        ip: "203.0.113.10",
        rateLimiter: createRateLimiter({ limit: 100 }),
        now: () => Date.parse("2026-11-03T12:00:00.000Z"),
        logger: silentLogger,
        ...overrides
    });
}

test("sanitizeText elimina controles y etiquetas peligrosas", () => {
    assert.equal(sanitizeText("  <script>alert(1)</script>  "), "scriptalert(1)/script");
    assert.equal(sanitizeText("Ana\u0000  Pérez"), "Ana Pérez");
    assert.equal(sanitizeText("x".repeat(80), 10), "x".repeat(10));
    assert.equal(sanitizeText(null), "");
});

test("isValidEmail acepta correos válidos y rechaza inválidos", () => {
    assert.equal(isValidEmail("ana@example.com"), true);
    assert.equal(isValidEmail("ana.perez+leads@sub.example.com.ar"), true);
    assert.equal(isValidEmail("ana@example"), false);
    assert.equal(isValidEmail("ana example@example.com"), false);
    assert.equal(isValidEmail("a@b.co<script>"), false);
});

test("normalizePhone conserva el prefijo internacional y extrae dígitos", () => {
    assert.deepEqual(normalizePhone("+54 9 3447 526699"), {
        ok: true,
        display: "+5493447526699",
        digits: "5493447526699"
    });
    assert.deepEqual(normalizePhone("0054 9 3447 526699"), {
        ok: true,
        display: "+5493447526699",
        digits: "5493447526699"
    });
    assert.equal(normalizePhone("123").ok, false);
    assert.equal(normalizePhone("+1234567890123456").ok, false);
});

test("normalizeAttribution solo conserva UTM y referrers http(s)", () => {
    assert.deepEqual(
        normalizeAttribution({
            utm_source: "instagram",
            utm_medium: "social",
            referrer: "javascript:alert(1)",
            otro: "dato"
        }),
        { utm_source: "instagram", utm_medium: "social" }
    );

    assert.equal(
        normalizeAttribution({ referrer: "https://example.com/path" }).referrer,
        "https://example.com/path"
    );
});

test("validateLead normaliza y exige consentimiento booleano", () => {
    const result = validateLead(validInput);

    assert.equal(result.ok, true);
    assert.equal(result.data.email, "ana@example.com");
    assert.equal(result.data.telefono, "+5493447526699");
    assert.equal(result.data.etapa_negocio, "crecimiento");
    assert.equal(result.data.consentimiento, true);
});

test("validateLead rechaza consentimiento ausente o falso", () => {
    assert.equal(validateLead({ ...validInput, consentimiento: false }).ok, false);
    assert.equal(validateLead({ ...validInput, consentimiento: "si" }).ok, false);
    assert.equal(validateLead({ ...validInput, consentimiento: undefined }).ok, false);
});

test("validateLead rechaza campos inválidos", () => {
    const result = validateLead({
        ...validInput,
        nombre: "A",
        email: "no-es-email",
        negocio: "",
        telefono: "123",
        etapa_negocio: "otra"
    });

    assert.equal(result.ok, false);
    assert.ok(result.errors.nombre);
    assert.ok(result.errors.email);
    assert.ok(result.errors.negocio);
    assert.ok(result.errors.telefono);
    assert.ok(result.errors.etapa_negocio);
});

test("isAllowedOrigin permite el sitio, localhost y rechaza dominios externos", () => {
    assert.equal(isAllowedOrigin("https://intiai.online", {}), true);
    assert.equal(isAllowedOrigin("http://localhost:8083", {}), true);
    assert.equal(isAllowedOrigin("http://127.0.0.1:5173", {}), true);
    assert.equal(isAllowedOrigin("https://inti-ai.pages.dev", {}), true);
    assert.equal(isAllowedOrigin("https://abc.inti-ai.pages.dev", {}), true);
    assert.equal(isAllowedOrigin("https://evil.example", {}), false);
    assert.equal(isAllowedOrigin("", {}), true);
    assert.equal(
        isAllowedOrigin("https://preview.example", { ALLOWED_ORIGINS: "https://preview.example" }),
        true
    );
});

test("isValidWebhookUrl solo acepta hosts oficiales de Make", () => {
    assert.equal(isValidWebhookUrl("https://hook.eu1.make.com/abc"), true);
    assert.equal(isValidWebhookUrl("https://hook.us1.make.com/abc"), true);
    assert.equal(isValidWebhookUrl("https://hook.make.com/abc"), true);
    assert.equal(isValidWebhookUrl("https://hook.integromat.com/abc"), true);
    assert.equal(isValidWebhookUrl("http://hook.eu1.make.com/abc"), false);
    assert.equal(isValidWebhookUrl("https://evil.example/hook"), false);
    assert.equal(isValidWebhookUrl("https://hook.eu1.make.com.evil.example/abc"), false);
    assert.equal(isValidWebhookUrl(""), false);
});

test("getHeader y getClientIp funcionan con Headers y objetos", () => {
    const headers = new Headers({
        "CF-Connecting-IP": "198.51.100.7",
        "X-Forwarded-For": "203.0.113.8, 10.0.0.1"
    });

    assert.equal(getHeader(headers, "cf-connecting-ip"), "198.51.100.7");
    assert.equal(getClientIp(headers), "198.51.100.7");
    assert.equal(getClientIp({ "x-forwarded-for": "203.0.113.9, 10.0.0.2" }), "203.0.113.9");
});

test("hashIp es estable y no expone la IP original", async () => {
    const first = await hashIp("203.0.113.10", "salt");
    const second = await hashIp("203.0.113.10", "salt");

    assert.equal(first, second);
    assert.equal(first.length, 64);
    assert.equal(first.includes("203.0.113.10"), false);
});

test("processLead envía el lead al webhook con consentimiento y atribución", async () => {
    const { fetchImpl, calls } = makeFetch();
    const result = await runLead({ fetchImpl });

    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, baseEnv.MAKE_WEBHOOK_URL);
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.redirect, "error");

    const payload = JSON.parse(calls[0].init.body);
    assert.equal(payload.nombre, "Ana Pérez");
    assert.equal(payload.email, "ana@example.com");
    assert.equal(payload.telefono, "+5493447526699");
    assert.equal(payload.etapa_negocio, "crecimiento");
    assert.equal(payload.consentimiento, true);
    assert.equal(payload.utm_source, "instagram");
    assert.equal(payload.referrer, "https://www.instagram.com/");
    assert.equal(payload.pagina, "https://intiai.online");
    assert.equal(payload.consentimiento_fecha, "2026-11-03T12:00:00.000Z");
    assert.equal(payload.ip_hash.length, 24);
    assert.equal(JSON.stringify(payload).includes("203.0.113.10"), false);
});

test("processLead no reenvía nada si se completa el honeypot", async () => {
    const { fetchImpl, calls } = makeFetch();
    const result = await runLead({
        fetchImpl,
        rawBody: JSON.stringify({ ...validInput, empresa_web: "https://spam.example" })
    });

    assert.equal(result.status, 200);
    assert.equal(calls.length, 0);
});

test("processLead rechaza formularios sin consentimiento", async () => {
    const { fetchImpl, calls } = makeFetch();
    const result = await runLead({
        fetchImpl,
        rawBody: JSON.stringify({ ...validInput, consentimiento: false })
    });

    assert.equal(result.status, 400);
    assert.equal(result.body.error, "invalid");
    assert.ok(result.body.fields.consentimiento);
    assert.equal(calls.length, 0);
});

test("processLead rechaza orígenes no permitidos", async () => {
    const { fetchImpl, calls } = makeFetch();
    const result = await runLead({
        fetchImpl,
        headers: { ...baseHeaders, origin: "https://evil.example" }
    });

    assert.equal(result.status, 403);
    assert.equal(result.body.error, "origin_not_allowed");
    assert.equal(calls.length, 0);
});

test("processLead rechaza JSON inválido, body grande y content-type incorrecto", async () => {
    const invalidJson = await runLead({ rawBody: "{no-json" });
    assert.equal(invalidJson.status, 400);
    assert.equal(invalidJson.body.error, "invalid_json");

    const tooLarge = await runLead({ rawBody: JSON.stringify({ ...validInput, relleno: "x".repeat(9000) }) });
    assert.equal(tooLarge.status, 413);
    assert.equal(tooLarge.body.error, "payload_too_large");

    const wrongType = await runLead({
        headers: { ...baseHeaders, "content-type": "text/plain" }
    });
    assert.equal(wrongType.status, 415);
    assert.equal(wrongType.body.error, "unsupported_media_type");
});

test("processLead devuelve 503 si falta el webhook o el host no es oficial", async () => {
    const { fetchImpl, calls } = makeFetch();
    const missing = await runLead({ fetchImpl, env: {} });
    assert.equal(missing.status, 503);
    assert.equal(missing.body.error, "not_configured");

    const invalid = await runLead({
        fetchImpl,
        env: { MAKE_WEBHOOK_URL: "https://evil.example/hook" }
    });
    assert.equal(invalid.status, 503);
    assert.equal(invalid.body.error, "not_configured");
    assert.equal(calls.length, 0);
});

test("processLead devuelve 502 si el webhook falla", async () => {
    const { fetchImpl } = makeFetch({ status: 500, body: "error" });
    const result = await runLead({ fetchImpl });

    assert.equal(result.status, 502);
    assert.equal(result.body.error, "upstream_error");
});

test("processLead devuelve 504 si el webhook agota el timeout", async () => {
    const fetchImpl = (_url, init) =>
        new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () => {
                const error = new Error("aborted");
                error.name = "AbortError";
                reject(error);
            });
        });

    const result = await runLead({ fetchImpl, timeoutMs: 15 });

    assert.equal(result.status, 504);
    assert.equal(result.body.error, "timeout");
});

test("processLead aplica rate limit por IP", async () => {
    const { fetchImpl, calls } = makeFetch();
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

    const first = await runLead({ fetchImpl, rateLimiter: limiter });
    const second = await runLead({ fetchImpl, rateLimiter: limiter });

    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(second.body.error, "rate_limited");
    assert.ok(Number(second.headers["Retry-After"]) >= 1);
    assert.equal(calls.length, 1);
});
