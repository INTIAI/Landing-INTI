# 🚀 INTI AI | Automatización Cognitiva & Arquitectura de Conversión

[![Estado: En Producción](https://img.shields.io/badge/Estado-En%20Producción-success)](#) [![Arquitectura: MVP](https://img.shields.io/badge/Arquitectura-MVP%20Zero--Cost-blue)](#)

## 📌 Resumen Ejecutivo
**INTI AI** no es solo una landing page; es un ecosistema digital diseñado para demostrar la integración fluida entre desarrollo frontend, automatización de procesos de negocio (BPA) y neuroventas. 

El objetivo de este proyecto es resolver uno de los mayores cuellos de botella en las ventas digitales: **la fricción en la captura y cualificación de leads.** Mediante un diseño centrado en el usuario y una arquitectura de enrutamiento inteligente (Smart Routing), el sistema captura la intención del cliente, sanitiza los datos y activa flujos asíncronos sin intervención humana.

---

## 🧠 Decisiones Arquitectónicas & Ciberseguridad (Lo que hay bajo el capó)

Este MVP fue construido priorizando la escalabilidad, la protección de datos y la resiliencia operativa.

* **Enrutamiento Bidireccional (Smart Routing):** Implementación de lógica condicional en el frontend que clasifica la intención del usuario en tiempo real. Divide el tráfico hacia flujos de alta fricción/alto valor (Agendamiento vía Google Calendar API) o baja fricción/respuesta inmediata (API de WhatsApp).
* **Motor de Resiliencia (Timeout & Fallback Protocol):** Desarrollo de un controlador de aborto (`AbortController`) que monitorea la latencia del Webhook. Si el servidor (Make.com) no responde en 5 segundos, el sistema interrumpe el ciclo de espera y ejecuta un protocolo de contingencia (Fallback) que redirige al usuario con sus datos pre-cargados a WhatsApp, asegurando un **0% de pérdida de prospectos** ante caídas de red.
* **Sanitización de Inputs en Tiempo Real:** Filtros Regex aplicados directamente en el DOM para prevenir inyecciones maliciosas de código (XSS) y asegurar la integridad de la base de datos antes de que el payload JSON sea enviado al servidor.

---

## 💼 Impacto de Negocio (Business ROI)
Como desarrolladora, mi enfoque es construir tecnología que mueva la aguja comercial:
1.  **Fricción Cero:** Reducción del ciclo de agendamiento de horas a segundos.
2.  **Operatividad 24/7:** La automatización asume el rol de un SDR (Sales Development Representative), liberando carga operativa del equipo humano.
3.  **Zero-Cost Infrastructure:** Despliegue serverless altamente eficiente utilizando Vercel, combinando el poder del ecosistema Google y automatización en la nube minimizando costos fijos.

---

## 🛠️ Stack Tecnológico
* **Frontend:** HTML5 Semántico, CSS3 (Variables, Flexbox/Grid, Animaciones UI), JavaScript Vanilla (ES6+).
* **Integración & API:** Fetch API, JSON, manejo de Promesas y Async/Await.
* **Automatización Backend:** Webhooks (Make.com / Integromat), Google Workspace (Calendar Appointment Scheduling).
* **Despliegue & CI/CD:** Git, GitHub, Vercel (Edge Network).

---

## 🤝 Conectemos
Este repositorio es una muestra de cómo traduzco requerimientos comerciales complejos en soluciones de software limpias y resilientes. Si estás buscando talento capaz de unir el código con la estrategia de negocio, me encantaría conversar.

* **Web en Producción:** [Ver Proyecto en Vivo](https://intiai.pages.dev/)
* **LinkedIn:** (https://www.linkedin.com/in/vanesalarroza/)
* **Email:** equipo.intiai@gmail.com