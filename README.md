# INTI AI | Ecosistema de Captura y Cualificación de Leads con IA

> **Tu negocio no duerme. Tu web tampoco.**

[![Estado](https://img.shields.io/badge/Estado-En%20Producci%C3%B3n-success)](https://intiai.pages.dev/) [![Tests](https://img.shields.io/badge/Tests-33%2F33%20passing-brightgreen)](#) [![Lighthouse](https://img.shields.io/badge/Lighthouse-100%2F100%20a11y%20%C2%B7%20SEO%20%C2%B7%20BP-success)](#)

---

## El problema que resuelve

Cada consulta que queda sin responder es una venta que se va con la competencia. La mayoría de las pymes pierde leads por tres fricciones concretas:

1. **Nadie responde fuera de horario** — el comprador decide en minutos, no en días.
2. **Los formularios tradicionales piden demasiado y protegen poco** — abandono y spam.
3. **Los datos llegan sucios al CRM** — horas perdidas en corrección manual.

INTI AI convierte ese cuello de botella en un sistema que atiende, filtra y entrega leads calificados 24/7, sin cambiar los sistemas que el negocio ya usa.

---

## Qué hace este producto

- **Formulario de 2 pasos** diseñado para reducir el abandono: nombre y email primero, contexto después.
- **Proxy server-side** (`/api/lead`) que valida, sanitiza y reenvía cada lead a la automatización — el destino nunca queda expuesto en el navegador.
- **Pipeline de automatización** con Make.com que registra cada lead, con su atribución de marketing, en una hoja de cálculo operativa.
- **Auto-respuesta inmediata por correo**: el lead recibe en segundos un email personalizado (nombre y negocio incluidos) que confirma la auditoría, marca expectativas claras y lo prepara para el primer contacto — cero espera, cero silencio.

## Arquitectura (lo que hay bajo el capó)

```text
Navegador
   │  POST /api/lead (JSON, misma origen)
   ▼
Cloudflare Pages Function
   │  validación · sanitización · rate limit · honeypot
   ▼
Webhook de Make.com  (variable de entorno, jamás en el cliente)
   │
   ├──► Google Sheets (central de leads + atribución)
   └──► Gmail (auto-respuesta personalizada al lead)
```

### Decisiones de seguridad en capas

| Capa | Medida | Qué previene |
|------|--------|--------------|
| Transporte | CSP sin `unsafe-inline`/`eval`, hash SHA-256 del JSON-LD | XSS e inyección de scripts |
| Origen | Allowlist estricta de `Origin` | Abuso cross-site del endpoint |
| Volumen | Rate limit por IP hasheada con sal secreta | Fuerza bruta y flooding |
| Contenido | Honeypot, límite de 8 KB, `content-type` estricto | Bots y payloads malformados |
| Datos | Sanitización y normalización server-side | Inyección hacia Sheets/CRM downstream |
| Secreto | Webhook solo en variables de entorno | Exposición del canal de leads |

La base de datos (Google Sheets) **no es accesible desde la web**: solo la automatización escribe en ella, y únicamente a través del webhook validado.

---

## Calidad verificable

- **33 tests automatizados** (validación, seguridad, rate limit, adaptador Cloudflare, assets, SEO).
- **Lighthouse 100/100** en Accesibilidad, SEO y Best Practices sobre la build de producción.
- **Sin dependencias de frontend**: HTML5 semántico, CSS3 y JavaScript vanilla (ES6+). Cero frameworks que envejecen.
- **Operación en frío verificada**: validaciones server-side tanto en cliente como en backend, protección anti-inyección hacia los consumidores de datos (Sheets/CRM) y canal de envío aislado del código público.

## Stack

- **Frontend:** HTML5 semántico · CSS3 (Grid/Flex/variables) · JavaScript ES6+
- **Backend:** Cloudflare Pages Functions (Web APIs, zero-dependency core compartido)
- **Automatización:** Make.com → Google Sheets
- **Operación:** Git · GitHub · Cloudflare Pages (CI/CD por push)

---

## Cómo lo pensé

Cada decisión parte de una pregunta comercial: *¿esto acerca el lead a la venta o lo aleja?* La tecnología existe para responder eso con datos, no con supuestos. El resultado es una landing que carga rápido, protege cada byte que el usuario entrega y nunca deja un prospecto sin ruta clara hacia el contacto humano.

¿Tu operación tiene el mismo cuello de botella? [Mirá el proyecto en vivo](https://intiai.pages.dev/) y pedí la auditoría gratuita del propio formulario.

---

## Contacto

- **Web en producción:** <https://intiai.pages.dev/>
- **LinkedIn:** [vanesalarroza](https://www.linkedin.com/in/vanesalarroza/)
- **Email:** equipo.intiai@gmail.com
