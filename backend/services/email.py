"""Outbound email.

The system has, until now, been able to create an account but not tell anyone
about it -- an administrator adding an officer had to read the password down a
phone line -- and had no way at all to prove someone owns the address they are
trying to reset. Both of those need a message leaving the building, which is
what this module is for.

Three rules shape the design:

* **Sending never breaks the request.** An account creation that succeeded and
  an email that failed is a support call; an account creation rolled back
  because a mail server was down is a broken product. Every public function
  returns a result object and raises nothing.

* **SMTP runs off the event loop.** ``smtplib`` is blocking, and a mail server
  that takes eight seconds to answer would otherwise stall every other request
  the worker is serving. Delivery happens in a thread.

* **Unconfigured is a supported state, not an error.** With no SMTP_HOST the
  module logs what it would have sent and reports ``delivered=False``. That
  keeps the test suite, CI and a laptop demo working without a mail server --
  and it is why the reset code is written to the log *only* in that mode. Once
  SMTP is configured the code never touches the log, because a log line is a
  copy of a credential.
"""

from __future__ import annotations

import asyncio
import logging
import os
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr
from typing import List, Optional

logger = logging.getLogger(__name__)


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class EmailResult:
    """What happened to one message.

    ``delivered`` False is not necessarily a fault -- see ``reason``, which
    distinguishes "no mail server configured" from "the mail server refused".
    Callers surface this to the administrator so they know whether the new
    officer actually received their password.
    """

    delivered: bool
    reason: str = ""

    @property
    def configured(self) -> bool:
        return self.reason != "not-configured"


class EmailSettings:
    """SMTP configuration, read fresh so tests can monkeypatch the environment."""

    def __init__(self) -> None:
        self.enabled = _env_flag("MAIL_ENABLED", True)
        self.host = (os.getenv("SMTP_HOST") or "").strip()
        self.port = int(os.getenv("SMTP_PORT") or "587")
        self.username = (os.getenv("SMTP_USERNAME") or "").strip()
        self.password = os.getenv("SMTP_PASSWORD") or ""
        # STARTTLS on the submission port is the common case. SMTP_SSL is for
        # the implicit-TLS port (465), which is a different handshake entirely.
        self.use_tls = _env_flag("SMTP_USE_TLS", True)
        self.use_ssl = _env_flag("SMTP_USE_SSL", False)
        self.timeout = int(os.getenv("SMTP_TIMEOUT_SECONDS") or "15")

        self.from_address = (
            os.getenv("MAIL_FROM") or self.username or "no-reply@civicconnect.local"
        ).strip()
        self.from_name = (os.getenv("MAIL_FROM_NAME") or "CivicConnect").strip()

        # Used in message bodies so a recipient can reach the right place.
        self.support_email = (
            os.getenv("SUPPORT_EMAIL") or "support@civicconnect.gov.in"
        ).strip()
        self.app_name = (os.getenv("APP_NAME") or "CivicConnect").strip()
        self.app_url = (os.getenv("APP_PUBLIC_URL") or "http://localhost:3000").strip()

    @property
    def is_configured(self) -> bool:
        return bool(self.enabled and self.host)


def _send_blocking(settings: EmailSettings, message: EmailMessage) -> None:
    """Hand one message to the SMTP server. Blocking; called in a thread."""
    if settings.use_ssl:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(
            settings.host, settings.port, timeout=settings.timeout, context=context
        ) as server:
            if settings.username:
                server.login(settings.username, settings.password)
            server.send_message(message)
        return

    with smtplib.SMTP(settings.host, settings.port, timeout=settings.timeout) as server:
        server.ehlo()
        if settings.use_tls:
            server.starttls(context=ssl.create_default_context())
            server.ehlo()
        if settings.username:
            server.login(settings.username, settings.password)
        server.send_message(message)


async def send_email(
    *,
    to: str,
    subject: str,
    body: str,
    settings: Optional[EmailSettings] = None,
    log_body_when_unconfigured: bool = False,
) -> EmailResult:
    """Send one plain-text message. Never raises.

    ``log_body_when_unconfigured`` writes the body to the log when there is no
    mail server, so that a developer running locally can still complete a
    password reset. It is deliberately opt-in per call site rather than a global
    setting: it puts a live credential in the log, and it must be impossible to
    turn on by accident for every message the system sends.
    """
    settings = settings or EmailSettings()

    if not to or "@" not in to:
        logger.warning("refusing to send %r to an unusable address %r", subject, to)
        return EmailResult(False, "invalid-address")

    if not settings.is_configured:
        if log_body_when_unconfigured:
            logger.warning(
                "MAIL NOT CONFIGURED -- the message below was not sent.\n"
                "To: %s\nSubject: %s\n%s",
                to, subject, body,
            )
        else:
            logger.info(
                "MAIL NOT CONFIGURED -- would have sent %r to %s", subject, to
            )
        return EmailResult(False, "not-configured")

    message = EmailMessage()
    message["From"] = formataddr((settings.from_name, settings.from_address))
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    try:
        await asyncio.to_thread(_send_blocking, settings, message)
    except Exception as exc:  # noqa: BLE001 -- delivery must never break a request
        logger.exception("could not deliver %r to %s", subject, to)
        return EmailResult(False, f"{type(exc).__name__}: {exc}")

    logger.info("sent %r to %s", subject, to)
    return EmailResult(True)


# --- Message templates ---------------------------------------------------
# Plain text on purpose. These carry a credential or a code, and the recipient
# is as likely to be reading them in a webmail preview pane as anywhere else;
# HTML buys nothing and gives a spam filter another reason to be suspicious.


def _signature(settings: EmailSettings) -> str:
    return (
        "\n---\n" + settings.app_name + "\n"
        "Sign in: " + settings.app_url + "\n"
        "Questions: " + settings.support_email + "\n"
        "This message was sent automatically. Please do not reply to it.\n"
    )


async def send_account_credentials(
    *,
    to: str,
    name: str,
    role_label: str,
    temporary_password: str,
    created_by: Optional[str] = None,
    extra_lines: Optional[List[str]] = None,
) -> EmailResult:
    """Tell a newly created officer or field worker how to sign in.

    The password is in the body because there is nowhere else to put it: there
    is no invitation-link flow yet, and the alternative in place today is an
    administrator reading it aloud. It is described as temporary and the message
    says to change it, which is the honest framing of what it is.
    """
    settings = EmailSettings()
    creator = " by " + created_by if created_by else ""

    lines = [
        "Hello " + name + ",",
        "",
        "An account has been created for you" + creator + " on "
        + settings.app_name + " as a " + role_label + ".",
        "",
        "Sign in with:",
        "  Email:    " + to,
        "  Password: " + temporary_password,
        "",
        "  " + settings.app_url + "/login",
        "",
        "Please change this password after your first sign-in. Until you do,"
        " anyone who sees this message can sign in as you.",
    ]
    if extra_lines:
        lines.append("")
        lines.extend(extra_lines)
    lines.append(_signature(settings))

    return await send_email(
        to=to,
        subject="Your " + settings.app_name + " " + role_label + " account",
        body="\n".join(lines),
        settings=settings,
        # A brand-new account's password is no more sensitive than the request
        # that just created it, and without this a developer cannot test the
        # flow at all. Still opt-in, still only when no mail server exists.
        log_body_when_unconfigured=True,
    )


async def send_password_reset_code(
    *,
    to: str,
    name: str,
    code: str,
    minutes_valid: int,
) -> EmailResult:
    """Send the verification code that proves the requester owns this address.

    A code rather than a link: the reset is finished in the tab the person
    already has open, which means a link intercepted from an inbox is not on its
    own enough, and it works when mail is read on a different device from the
    one making the request.
    """
    settings = EmailSettings()

    body = "\n".join([
        "Hello " + name + ",",
        "",
        "Someone asked to reset the password for your " + settings.app_name
        + " account.",
        "Enter this verification code to continue:",
        "",
        "    " + code,
        "",
        "The code expires in " + str(minutes_valid)
        + " minutes and can be used once.",
        "",
        "If this was not you, no action is needed -- your password has not been"
        " changed and this code cannot do anything on its own. If you keep"
        " receiving these, tell us at " + settings.support_email + ".",
        _signature(settings),
    ])

    return await send_email(
        to=to,
        subject=settings.app_name + " password reset code",
        body=body,
        settings=settings,
        log_body_when_unconfigured=True,
    )
