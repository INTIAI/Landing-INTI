import test from "node:test";
import assert from "node:assert/strict";

import { onRequest } from "../functions/api/lead.js";
import vercelHandler from "../api/lead.js";

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
    return new Request("https://intiai.online/api/lead", {
        method,
        headers: {
            "content-type": "application/json",
            origin: "https://intiai.online",
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

test("Vercel Function: rechaza métodos distintos de POST", async () => {
    const response = {
        statusCode: 0,
        headers: {},
        body: "",
        setHeader(key, value) {
            this.headers[key] = value;
        },
        end(body) {
            this.body = body;
        }
    };

    await vercelHandler({ method: "GET", headers: {}, body: undefined }, response);

    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.Allow, "POST");
    assert.equal(JSON.parse(response.body).error, "method_not_allowed");
});

test("Vercel Function: procesa un lead válido", async () => {
    const originalFetch = globalThis.fetch;
    const originalWebhook = process.env.MAKE_WEBHOOK_URL;
    const originalSalt = process.env.RATE_SALT;
    const calls = [];

    process.env.MAKE_WEBHOOK_URL = env.MAKE_WEBHOOK_URL;
    process.env.RATE_SALT = env.RATE_SALT;

    globalThis.fetch = async (url, init) => {
        calls.push({ url, init });
        return new Response("OK", { status: 200 });
    };

    const response = {
        statusCode: 0,
        headers: {},
        body: "",
        setHeader(key, value) {
            this.headers[key] = value;
        },
        end(body) {
            this.body = body;
        }
    };

    try {
        await vercelHandler(
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    origin: "https://intiai.online",
                    "user-agent": "adapter-test",
                    "x-forwarded-for": "198.51.100.22, 10.0.0.1"
                },
                body: JSON.parse(validBody)
            },
            response
        );

        assert.equal(response.statusCode, 200);
        assert.deepEqual(JSON.parse(response.body), { ok: true });
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, env.MAKE_WEBHOOK_URL);
        assert.equal(response.headers["Cache-Control"], "no-store");
    } finally {
        globalThis.fetch = originalFetch;
        if (originalWebhook === undefined) delete process.env.MAKE_WEBHOOK_URL;
        else process.env.MAKE_WEBHOOK_URL = originalWebhook;
        if (originalSalt === undefined) delete process.env.RATE_SALT;
        else process.env.RATE_SALT = originalSalt;
    }
});
