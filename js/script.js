"use strict";

/**
 * 🚀 INTI AI | MOTOR DE CIBERSEGURIDAD Y CONECTIVIDAD API
 * Arquitectura: Fetch API, Divulgación Progresiva, Lógica Dinámica de Leads y Data Hygiene.
 */

const CONFIG = {
    webhookMake: "https://hook.eu1.make.com/82m4nzufy8asqm0onzpi7pqay5ifs5aj",
    numeroWhatsApp: "5493447526699"
};

document.addEventListener('DOMContentLoaded', () => {
    console.info("🛡️ [INTI AI] Motor de Seguridad y Morphing UI Iniciado.");

    const form = document.getElementById('form-auditoria');
    const errorContainer = document.getElementById('error-message');

    const paso1 = document.getElementById('paso-1');
    const paso2 = document.getElementById('paso-2');
    const btnSiguiente = document.getElementById('btn-siguiente');
    const btnAuditoria = document.getElementById('btn-auditoria');
    const mensajeExito = document.getElementById('mensaje-exito');

    if (!form) return;

    const inputs = {
        nombre: document.getElementById('nombre'),
        email: document.getElementById('email'),
        negocio: document.getElementById('negocio'),
        telefono: document.getElementById('telefono'),
        etapa: document.getElementById('etapa_negocio')
    };

    inputs.nombre.addEventListener('input', function() {
        this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-\']/g, '');
    });
    inputs.negocio.addEventListener('input', function() {
        this.value = this.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.,&\-]/g, '');
    });
    inputs.telefono.addEventListener('input', function() {
        this.value = this.value.replace(/[^\+0-9\s\-]/g, '');
    });

    btnSiguiente.addEventListener('click', () => {
        errorContainer.style.display = 'none';
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailValido = emailRegex.test(inputs.email.value.trim());
        
        if (inputs.nombre.value.trim().length < 3 || !emailValido) {
            return mostrarError("Por favor, ingresa un nombre y un correo electrónico válido (ej: nombre@correo.com).");
        }

        paso1.classList.replace('step-visible', 'step-hidden');
        
        setTimeout(() => {
            paso2.classList.replace('step-hidden', 'step-visible');
        }, 300);
    });

   const manejarClickWhatsApp = (e) => {
    e.preventDefault();
    
    let msj = `Hola, equipo de INTI AI. Estaba revisando la web y, antes de coordinar el diagnóstico en la agenda, quisiera hacerles una consulta puntual sobre la viabilidad de mi proyecto. ¿Me podrán orientar por este canal?`;

    if (inputs.nombre.value.trim() !== '') {
        msj = `Hola, equipo de INTI AI. Soy *${inputs.nombre.value.trim()}*. Estaba revisando la web y, antes de coordinar el diagnóstico en la agenda, quisiera hacerles una consulta puntual sobre la viabilidad de mi proyecto. ¿Me podrán orientar por este canal?`;
    }

    window.open(`https://wa.me/${CONFIG.numeroWhatsApp}?text=${encodeURIComponent(msj)}`, '_blank');
};

    const floatWa = document.getElementById('btn-whatsapp-float');
    if(floatWa) floatWa.addEventListener('click', manejarClickWhatsApp);

    form.addEventListener('submit', async function(e) {
        e.preventDefault(); 
        errorContainer.style.display = 'none';

        const digitosTelefono = inputs.telefono.value.replace(/\D/g, '');

        if (!inputs.etapa.value || inputs.negocio.value.trim().length < 2 || digitosTelefono.length < 8 || digitosTelefono.length > 15) {
            return mostrarError("Por favor, ingresa tu rubro y un número de teléfono válido (ej: +54 9 11...).");
        }

        const payload = {
            nombre: inputs.nombre.value.trim(),
            email: inputs.email.value.trim(),
            negocio: inputs.negocio.value.trim(),
            telefono: inputs.telefono.value.trim(),
            etapa_negocio: inputs.etapa.value,
            tipo_contacto: 'auditoria',
            fecha: new Date().toISOString()
        };

        const textoOriginal = btnAuditoria.innerHTML;
        btnAuditoria.disabled = true;
        btnAuditoria.innerHTML = `PROCESANDO...`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(CONFIG.webhookMake, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error("Respuesta no satisfactoria");

            console.info(`✅ Lead procesado vía [AUDITORIA] - Data Limpia`);

            paso2.classList.replace('step-visible', 'step-hidden');
            setTimeout(() => {
                mensajeExito.classList.replace('step-hidden', 'step-visible');
            }, 400);

        } catch (error) {
            clearTimeout(timeoutId);
            console.warn("⚠️ Error en Webhook. Aplicando Fallback.");
            
            let mensajeTexto = `¡Hola INTI AI! 🚀 Intenté agendar mi auditoría pero hubo un error de conexión. Soy *${payload.nombre}*.`;
            window.open(`https://wa.me/${CONFIG.numeroWhatsApp}?text=${encodeURIComponent(mensajeTexto)}`, '_blank');
            form.reset();
        } finally {
            btnAuditoria.disabled = false;
            btnAuditoria.innerHTML = textoOriginal;
        }
    });

    function mostrarError(mensaje) {
        errorContainer.innerHTML = `<strong>⚠️ Error:</strong> ${mensaje}`;
        errorContainer.style.display = 'block';
    }
});