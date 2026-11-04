import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = path.join(root, "dist");

const files = [
    "index.html",
    "privacidad.html",
    "terminos.html",
    "favicon.ico",
    "robots.txt",
    "sitemap.xml",
    "_headers",
    "css/style.css",
    "js/script.js",
    "lib/lead-core.js",
    "functions/api/lead.js",
    "assets/apple-touch-icon.png",
    "assets/favicon.png",
    "assets/favicon-192.png",
    "assets/hero-bg-inti.jpg",
    "assets/icono-crecimiento-trim.png",
    "assets/icono-esencia-trim.png",
    "assets/icono-retencion-trim.png",
    "assets/icono-target-trim.png",
    "assets/logo-inti-96.png",
    "assets/og-image.jpg"
];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of files) {
    const source = path.join(root, file);
    const target = path.join(out, file);

    if (!fs.existsSync(source)) {
        throw new Error(`Falta el archivo requerido para el deploy: ${file}`);
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
}

const totalBytes = files.reduce(
    (total, file) => total + fs.statSync(path.join(out, file)).size,
    0
);

console.log(`Cloudflare Pages: ${files.length} archivos preparados en dist/ (${totalBytes} bytes).`);
