"""Envío de alertas: correo (SMTP) y WhatsApp (Fase 2).

Si SMTP no está configurado, las alertas se registran en consola en vez de
enviarse, para no romper en desarrollo.
"""
from __future__ import annotations

import smtplib
import logging
from email.message import EmailMessage

import httpx

from app.config import settings
from app.models.opportunity import Opportunity

logger = logging.getLogger("notificaciones")


def _formato_oportunidades(oportunidades: list[Opportunity]) -> str:
    lineas = []
    for o in oportunidades:
        valor = f"${o.valor:,.0f}" if o.valor else "sin valor publicado"
        cierre = o.fecha_cierre.strftime("%Y-%m-%d") if o.fecha_cierre else "—"
        lineas.append(
            f"• {o.entidad or 'Entidad'} — {(o.objeto or '')[:120]}\n"
            f"  Valor: {valor} · Cierre: {cierre}\n"
            f"  {o.url or ''}"
        )
    return "\n\n".join(lineas)


def enviar_email(destinatario: str, asunto: str, cuerpo: str) -> None:
    if not settings.smtp_host:
        logger.info("[SMTP no configurado] Correo a %s: %s\n%s", destinatario, asunto, cuerpo)
        return

    msg = EmailMessage()
    msg["Subject"] = asunto
    msg["From"] = settings.smtp_from
    msg["To"] = destinatario
    msg.set_content(cuerpo)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
    logger.info("Correo enviado a %s", destinatario)


def alertar_oportunidades(destinatario: str, empresa: str, oportunidades: list[Opportunity]) -> None:
    """Notifica a una empresa sobre nuevos procesos que coinciden con su perfil."""
    if not oportunidades:
        return
    n = len(oportunidades)
    asunto = f"🎯 {n} nueva(s) oportunidad(es) para {empresa}"
    cuerpo = (
        f"Hola {empresa},\n\n"
        f"Encontramos {n} proceso(s) en SECOP que podrías ganar:\n\n"
        f"{_formato_oportunidades(oportunidades)}\n\n"
        "Entra a tu panel para gestionarlas.\n— Radar de Licitaciones"
    )
    enviar_email(destinatario, asunto, cuerpo)


def enviar_telegram(chat_id: str, mensaje: str) -> None:
    """Envía un mensaje por Telegram usando el bot de la plataforma.

    Si no hay token configurado, registra en consola en vez de enviar.
    """
    if not settings.telegram_bot_token:
        logger.info("[Telegram no configurado] a %s: %s", chat_id, mensaje)
        return
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    try:
        resp = httpx.post(
            url,
            json={"chat_id": chat_id, "text": mensaje, "disable_web_page_preview": True},
            timeout=15,
        )
        resp.raise_for_status()
        logger.info("Telegram enviado a %s", chat_id)
    except httpx.HTTPError:
        logger.exception("No se pudo enviar Telegram a %s", chat_id)


def alertar_telegram(chat_id: str, empresa: str, oportunidades: list[Opportunity]) -> None:
    """Notifica por Telegram sobre nuevos procesos que coinciden con el perfil."""
    if not oportunidades:
        return
    n = len(oportunidades)
    mensaje = (
        f"🎯 {n} nueva(s) oportunidad(es) para {empresa}:\n\n"
        f"{_formato_oportunidades(oportunidades)}\n\n"
        "Entra a tu panel para gestionarlas."
    )
    enviar_telegram(chat_id, mensaje)


def enviar_whatsapp(telefono: str, mensaje: str) -> None:
    """Fase 2. Placeholder de integración con una API de WhatsApp."""
    if not settings.whatsapp_api_url:
        logger.info("[WhatsApp no configurado] a %s: %s", telefono, mensaje)
        return
    httpx.post(
        settings.whatsapp_api_url,
        headers={"Authorization": f"Bearer {settings.whatsapp_api_token}"},
        json={"to": telefono, "message": mensaje},
        timeout=15,
    )
