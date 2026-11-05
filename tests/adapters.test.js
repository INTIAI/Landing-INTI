import test from "node:test";
import assert from "node:assert/strict";

import { onRequest } from "../functions/api/lead.js";

const SITE_ORIGIN = "https://inti-ai.pages.dev";

const validBody = JSON.stringify({
    nombre: "Ana Pérez",
    email: "ana@example.com",
    negocio: "Estudio contable",
    telefono: "+54 9 3447 526699",
    etapa_negocio: "crecimiento",
    consentimiento: true,
    empresa_web: "",
    atribucion: { utm_source: "test" }
});

const env = {
    MAKE_WEBHOOK_URL: "https://hook.eu1.make.com/test-webhook",
    RATE_SALT: "adapter-test-salt"
};

function cloudflareRequest({ method = "POST", body = validBody, ip = "198.51.100.20" } = {}) {
    return new Request(`${SITE_ORIGIN}/api/lead`, {
        method,
        headers: {
            "content-type": "application/json",
            origin: SITE_ORIGIN,
            "user-agent": "adapter-test",
            "CF-Connecting-IP": ip
        },
        body: method === "POST" ? body : undefined
    });
}

test("Cloudflare Function: rechaza métodos distintos de POST", async () => {
    const response = await onRequest({
        request: cloudflareRequest({ method: "GET" }),
        env
    });

    assert.equal(response.status, 405);
    assert.equal(response.headers.get("Allow"), "POST");
    const body = await response.json();
    assert.equal(body.error, "method_not_allowed");
});

test("Cloudflare Function: procesa un lead válido", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];

    globalThis.fetch = async (url, init) => {
        calls.push({ url, init });
        return new Response("OK", { status: 200 });
    };

    try {
        const response = await onRequest({
            request: cloudflareRequest({ ip: "198.51.100.21" }),
            env
        });

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, env.MAKE_WEBHOOK_URL);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
