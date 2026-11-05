"use strict";

/**
 * Lógica de la landing: formulario en 2 pasos con envío a /api/lead.
 * El webhook de Make vive server-side y nunca llega al cliente.
 */

const CONFIG = {
    endpoint: "/api/lead",
    numeroWhatsApp: "5493447526699",
    timeoutMs: 8000
};

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("form-auditoria");
    if (!form) return;

    const errorContainer = document.getElementById("error-message");
    const paso1 = document.getElementById("paso-1");
    const paso2 = document.getElementById("paso-2");
    const btnSiguiente = document.getElementById("btn-siguiente");
    const btnVolver = document.getElementById("btn-volver");
    const btnAuditoria = document.getElementById("btn-auditoria");
    const mensajeExito = document.getElementById("mensaje-exito");
    const consentimiento = document.getElementById("consentimiento");
    const honeypot = document.getElementById("empresa_web");

    if (!errorContainer || !paso1 || !paso2 || !btnSiguiente || !btnAuditoria) return;

    const inputs = {
        nombre: document.getElementById("nombre"),
        email: document.getElementById("email"),
        negocio: document.getElementById("negocio"),
        telefono: document.getElementById("telefono"),
        etapa: document.getElementById("etapa_negocio")
    };

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const ETAPAS_PERMITIDAS = new Set(["inicial", "crecimiento", "escala"]);

    inputs.nombre.addEventListener("input", function () {
        this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-'.]/g, "");
    });

    inputs.negocio.addEventListener("input", function () {
        this.value = this.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,&+\-/()]/g, "");
    });

    inputs.telefono.addEventListener("input", function () {
        this.value = this.value.replace(/[^+0-9\s\-()]/g, "");
    });

    [inputs.nombre, inputs.email, inputs.negocio, inputs.telefono].forEach((input) => {
        input.addEventListener("blur", function () {
            this.value = this.value.trim();
        });
    });

    [inputs.nombre, inputs.email, inputs.negocio, inputs.telefono, inputs.etapa, consentimiento]
        .filter(Boolean)
        .forEach((field) => {
            field.addEventListener("input", () => field.removeAttribute("aria-invalid"));
            field.addEventListener("change", () => field.removeAttribute("aria-invalid"));
        });

    const limpiarError = () => {
        errorContainer.replaceChildren();
        errorContainer.style.display = "none";
        form.querySelectorAll('[aria-invalid="true"]').forEach((field) => {
            field.removeAttribute("aria-invalid");
        });
    };

    const mostrarError = (mensaje, opciones = {}) => {
        errorContainer.replaceChildren();

        const strong = document.createElement("strong");
        strong.textContent = "⚠️ Error: ";
        errorContainer.append(strong, document.createTextNode(mensaje));

        if (opciones.whatsapp) {
            errorContainer.append(document.createTextNode(" "));
            const link = document.createElement("a");
            link.href = `https://wa.me/${CONFIG.numeroWhatsApp}`;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.className = "error-link";
            link.textContent = "Escribinos por WhatsApp";
            errorContainer.append(link);
        }

        errorContainer.style.display = "block";

        if (opciones.focus && typeof opciones.focus.focus === "function") {
            if (typeof opciones.focus.setAttribute === "function") {
                opciones.focus.setAttribute("aria-invalid", "true");
            }
            opciones.focus.focus({ preventScroll: true });
        } else {
            errorContainer.focus({ preventScroll: true });
        }

        errorContainer.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const avanzarPaso1 = () => {
        limpiarError();

        const nombre = inputs.nombre.value.trim();
        const email = inputs.email.value.trim();

        if (nombre.length < 2) {
            return mostrarError("Ingresá tu nombre (mínimo 2 caracteres).", { focus: inputs.nombre });
        }
        if (nombre.length > 50) {
            return mostrarError("El nombre no puede superar los 50 caracteres.", { focus: inputs.nombre });
        }
        if (/\d/.test(nombre)) {
            return mostrarError("El nombre solo puede contener letras y espacios.", { focus: inputs.nombre });
        }
        if (!EMAIL_RE.test(email) || email.length > 60) {
            return mostrarError("Ingresá un correo electrónico válido (ej: nombre@correo.com).", { focus: inputs.email });
        }

        paso1.classList.replace("step-visible", "step-hidden");
        setTimeout(() => {
            paso2.classList.replace("step-hidden", "step-visible");
            inputs.negocio.focus();
        }, 250);
    };

    const volverPaso1 = () => {
        limpiarError();
        paso2.classList.replace("step-visible", "step-hidden");
        paso1.classList.replace("step-hidden", "step-visible");
        inputs.email.focus();
    };

    const mostrarExito = () => {
        paso2.classList.replace("step-visible", "step-hidden");
        mensajeExito.classList.replace("step-hidden", "step-visible");
        mensajeExito.focus({ preventScroll: true });
        mensajeExito.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const obtenerAtribucion = () => {
        const params = new URLSearchParams(window.location.search);
        const atribucion = {};

        ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) => {
            const value = (params.get(key) || "").trim();
            if (value) atribucion[key] = value.slice(0, 100);
        });

        if (document.referrer) {
            atribucion.referrer = document.referrer.slice(0, 300);
        }

        return atribucion;
    };

    const validarPaso2 = () => {
        const negocio = inputs.negocio.value.trim();
        const telefono = inputs.telefono.value.trim();
        const digitos = telefono.replace(/\D/g, "");

        if (negocio.length < 2) {
            mostrarError("Ingresá tu rubro o nicho (mínimo 2 caracteres).", { focus: inputs.negocio });
            return false;
        }
        if (negocio.length > 60) {
            mostrarError("El rubro no puede superar los 60 caracteres.", { focus: inputs.negocio });
            return false;
        }
        const digitosNegocio = (negocio.match(/\d/g) || []).length;
        if (digitosNegocio / negocio.length > 0.3) {
            mostrarError("El rubro debe describir tu actividad con texto, no solo números.", { focus: inputs.negocio });
            return false;
        }
        if (digitos.length < 8 || digitos.length > 15) {
            mostrarError("Ingresá un número de WhatsApp válido (entre 8 y 15 dígitos).", { focus: inputs.telefono });
            return false;
        }
        if (!ETAPAS_PERMITIDAS.has(inputs.etapa.value)) {
            mostrarError("Seleccioná en qué etapa está tu negocio.", { focus: inputs.etapa });
            return false;
        }
        if (!consentimiento || !consentimiento.checked) {
            mostrarError("Para enviar la solicitud, aceptá la Política de Privacidad y el tratamiento de tus datos.", { focus: consentimiento });
            return false;
        }

        return true;
    };

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (paso1.classList.contains("step-visible")) {
            return avanzarPaso1();
        }

        limpiarError();

        // Honeypot: un bot completa este campo oculto; simulamos éxito sin enviar nada.
        if (honeypot && honeypot.value.trim() !== "") {
            mostrarExito();
            return;
        }

        if (!validarPaso2()) return;

        const payload = {
            nombre: inputs.nombre.value.trim(),
            email: inputs.email.value.trim().toLowerCase(),
            negocio: inputs.negocio.value.trim(),
            telefono: inputs.telefono.value.trim(),
            etapa_negocio: inputs.etapa.value,
            consentimiento: true,
            atribucion: obtenerAtribucion()
        };

        const textoOriginal = btnAuditoria.textContent.trim();
        btnAuditoria.disabled = true;
        btnAuditoria.setAttribute("aria-busy", "true");
        btnAuditoria.textContent = "Enviando...";
        form.setAttribute("aria-busy", "true");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeoutMs);

        try {
            const response = await fetch(CONFIG.endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
                credentials: "same-origin"
            });

            const data = await response.json().catch(() => null);

            if (response.status === 429) {
                throw new Error("rate-limit");
            }
            if (response.status === 403) {
                throw new Error("forbidden");
            }
            if (!response.ok) {
                if (response.status === 400 && data?.error === "invalid") {
                    throw new Error("rejected");
                }
                throw new Error("upstream");
            }
            if (!data || data.ok !== true) {
                throw new Error("rejected");
            }

            mostrarExito();
        } catch (error) {
            if (error.name === "AbortError") {
                mostrarError("La conexión tardó demasiado. Revisá tu internet e intentá nuevamente.", { whatsapp: true });
            } else if (error.message === "rate-limit") {
                mostrarError("Recibimos varias solicitudes seguidas. Esperá unos segundos e intentá de nuevo.", { whatsapp: true });
            } else if (error.message === "rejected") {
                mostrarError("Revisá los datos ingresados e intentá nuevamente.", { focus: inputs.negocio });
            } else if (error.message === "forbidden") {
                mostrarError("No pudimos validar el origen de la solicitud. Recargá la página e intentá de nuevo.", { whatsapp: true });
            } else {
                mostrarError("No pudimos enviar tu solicitud. Revisá tu conexión e intentá nuevamente.", { whatsapp: true });
            }
        } finally {
            clearTimeout(timeoutId);
            btnAuditoria.disabled = false;
            btnAuditoria.removeAttribute("aria-busy");
            btnAuditoria.textContent = textoOriginal;
            form.removeAttribute("aria-busy");
        }
    });

    btnSiguiente.addEventListener("click", avanzarPaso1);

    if (btnVolver) {
        btnVolver.addEventListener("click", volverPaso1);
    }

    if (consentimiento) {
        consentimiento.addEventListener("change", () => {
            if (consentimiento.checked) limpiarError();
        });
    }

    form.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && paso1.classList.contains("step-visible")) {
            event.preventDefault();
            avanzarPaso1();
        }
    });
});
