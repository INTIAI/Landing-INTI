import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function read(file) {
    return fs.readFileSync(path.join(root, file), "utf8");
}

function exists(file) {
    return fs.existsSync(path.join(root, file));
}

const index = read("index.html");
const css = read("css/style.css");
const script = read("js/script.js");
const privacy = read("privacidad.html");
const terms = read("terminos.html");
const headers = read("_headers");
const jsonLdMatch = index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
const jsonLdHash = jsonLdMatch
    ? crypto.createHash("sha256").update(jsonLdMatch[1], "utf8").digest("base64")
    : null;

test("index.html contiene un único JSON-LD válido y su hash está en las CSP", () => {
    assert.ok(jsonLdMatch, "Falta el bloque JSON-LD inline.");
    assert.equal((index.match(/application\/ld\+json/g) || []).length, 1);

    const parsed = JSON.parse(jsonLdMatch[1]);
    assert.equal(parsed["@context"], "https://schema.org");
    assert.ok(Array.isArray(parsed["@graph"]));
    assert.ok(parsed["@graph"].some((item) => item["@type"] === "Organization"));
    assert.ok(parsed["@graph"].some((item) => item["@type"] === "FAQPage"));

    const expected = `sha256-${jsonLdHash}`;
    assert.ok(headers.includes(expected), "El hash del JSON-LD no está en _headers.");
});

test("las CSP no permiten scripts inline genéricos ni eval", () => {
    const csp = headers.match(/Content-Security-Policy: ([^\n]+)/)?.[1] || "";

    assert.match(csp, /script-src 'self' 'sha256-/);
    assert.doesNotMatch(csp, /unsafe-inline/);
    assert.doesNotMatch(csp, /unsafe-eval/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(headers, /Strict-Transport-Security:/);
    assert.match(headers, /X-Content-Type-Options: nosniff/);
});

test("el webhook de Make no aparece en el código del cliente", () => {
    const clientFiles = [index, script, css, privacy, terms].join("\n");

    assert.doesNotMatch(clientFiles, /82m4nzufy8asqm0onzpi7pqay5ifs5aj/);
    assert.doesNotMatch(clientFiles, /hook\.eu1\.make\.com/);
    assert.doesNotMatch(clientFiles, /hook\.make\.com/);
    assert.match(script, /\/api\/lead/);
});

test("el formulario incluye consentimiento explícito y enlace a privacidad", () => {
    assert.match(index, /id="consentimiento"/);
    assert.match(index, /name="consentimiento"/);
    assert.match(index, /type="checkbox"/);
    assert.match(index, /required/);
    assert.match(index, /Política de Privacidad/);
    assert.match(index, /privacidad\.html/);
    assert.match(index, /id="form-privacy"/);
});

test("el botón flotante de WhatsApp sigue presente", () => {
    assert.match(index, /class="whatsapp-float"/);
    assert.match(index, /id="btn-whatsapp-float"/);
    assert.match(index, /https:\/\/wa\.me\/5493447526699/);
    assert.match(css, /\.whatsapp-float\s*\{/);
});

test("el CTA principal está en el hero y en el formulario", () => {
    assert.match(index, /data-cta="hero"/);
    assert.match(index, /Agendar mi auditoría IA gratis/);
    assert.match(index, /data-cta="form-submit"/);
    assert.match(index, /Agendar mi auditoría gratis/);
    assert.match(index, /cta-trust/);
});

test("no hay manejadores inline ni estilos embebidos en las páginas", () => {
    for (const [name, html] of [
        ["index.html", index],
        ["privacidad.html", privacy],
        ["terminos.html", terms]
    ]) {
        assert.doesNotMatch(html, /\son(?:error|click|load|submit|change)=/i, `${name} contiene handlers inline`);
        assert.doesNotMatch(html, /<style[\s>]/i, `${name} contiene un bloque <style> inline`);
        assert.doesNotMatch(html, /\sstyle="/i, `${name} contiene un atributo style inline`);
    }
});

test("las páginas legales tienen metadatos y logo optimizado", () => {
    for (const [name, html] of [
        ["privacidad.html", privacy],
        ["terminos.html", terms]
    ]) {
        assert.match(html, /<meta name="description"/);
        assert.match(html, /<link rel="canonical"/);
        assert.match(html, /<meta name="robots"/);
        assert.match(html, /assets\/logo-inti-96\.png/);
        assert.match(html, /width="40" height="40"/);
    }
});

test("todos los assets referenciados existen", () => {
    const refs = new Set();

    for (const match of index.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)) {
        refs.add(match[1]);
    }

    for (const match of css.matchAll(/url\(['"]?(\.\.\/assets\/[^)'"]+)/g)) {
        refs.add(match[1].replace("../", ""));
    }

    assert.ok(refs.size > 5, "No se encontraron suficientes referencias de assets.");

    for (const ref of refs) {
        assert.ok(exists(ref), `Asset referenciado inexistente: ${ref}`);
    }
});

test("robots.txt, sitemap.xml y configuración de Cloudflare existen", () => {
    const robots = read("robots.txt");
    const sitemap = read("sitemap.xml");
    const packageJson = JSON.parse(read("package.json"));
    const wrangler = read("wrangler.toml");

    assert.match(robots, /Sitemap: https:\/\/intiai\.pages\.dev\/sitemap\.xml/);
    assert.match(robots, /Disallow: \/api\//);
    assert.match(sitemap, /<loc>https:\/\/intiai\.pages\.dev\/<\/loc>/);
    assert.match(sitemap, /privacidad\.html/);
    assert.match(sitemap, /terminos\.html/);
    assert.equal(packageJson.type, "module");
    assert.match(wrangler, /name = "intiai"/);
    assert.match(wrangler, /pages_build_output_dir = "dist"/);
    assert.match(packageJson.scripts["build:pages"], /build-pages\.mjs/);
    assert.ok(exists("functions/api/lead.js"));
    assert.ok(exists("lib/lead-core.js"));
    assert.ok(exists("scripts/build-pages.mjs"));
    assert.ok(!exists("vercel.json"), "El stack de Vercel debe estar eliminado.");
    assert.ok(!exists("api/lead.js"), "El adaptador de Vercel debe estar eliminado.");
    assert.ok(exists(".assetsignore"));
    assert.match(read(".assetsignore"), /estrategia_alvear_home\.pdf/);
});

test("el sitio declara canonical, Open Graph y preload del hero", () => {
    assert.match(index, /<link rel="canonical" href="https:\/\/intiai\.pages\.dev\/">/);
    assert.match(index, /property="og:image" content="https:\/\/intiai\.pages\.dev\/assets\/og-image\.jpg"/);
    assert.match(index, /<link rel="preload" as="image" href="assets\/hero-bg-inti\.jpg"/);
    assert.match(index, /assets\/og-image\.jpg/);
});
