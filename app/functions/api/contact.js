// Pages Function (POST /api/contact): validates the contact form and emails it
// to contactform@streanga.com via Resend. Requires the RESEND_API_KEY env var.
// Plain JS, not TS: it runs in the Workers runtime, so it stays out of `astro check`.

const TO = "contactform@streanga.com";
const FROM = "streanga.com <noreply@streanga.com>";
const THANKS_URL = "/contact/thanks";
const MAX_MESSAGE = 1024;
const MAX_NAME = 256;

// Loose on purpose — real validation is whether mail bounces; the browser did type=email.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function errorPage(message) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Message not sent</title>
<style>:root{color-scheme:light dark}body{font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;line-height:1.6}</style>
</head><body><h1>Message not sent</h1><p>${escapeHtml(
        message,
    )}</p><p>You can also email me directly at <a href="mailto:${TO}">${TO}</a>.</p><p><a href="/#contact">&larr; Back to the form</a></p></body></html>`;
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const wantsJson = (request.headers.get("accept") || "").includes(
        "application/json",
    );

    // One responder for both callers: JSON for fetch(), 303-to-thanks / HTML for no-JS.
    const respond = (ok, statusCode, error) => {
        if (wantsJson) {
            return new Response(
                JSON.stringify(ok ? { ok: true } : { ok: false, error }),
                {
                    status: statusCode,
                    headers: { "content-type": "application/json" },
                },
            );
        }
        if (ok) {
            return new Response(null, {
                status: 303,
                headers: { Location: THANKS_URL },
            });
        }
        return new Response(errorPage(error || "Something went wrong."), {
            status: statusCode,
            headers: { "content-type": "text/html; charset=utf-8" },
        });
    };

    let form;
    try {
        form = await request.formData();
    } catch {
        return respond(false, 400, "Invalid form submission.");
    }

    // Honeypot: humans leave it empty. Silently succeed so bots can't tell they were caught.
    if (String(form.get("website") || "").trim() !== "") {
        return respond(true, 200);
    }

    const email = String(form.get("email") || "").trim();
    const name = String(form.get("name") || "")
        .trim()
        .slice(0, MAX_NAME);
    const message = String(form.get("message") || "").trim();

    if (!EMAIL_RE.test(email)) {
        return respond(false, 400, "Please provide a valid email address.");
    }
    if (message.length === 0) {
        return respond(false, 400, "Please include a message.");
    }
    if (message.length > MAX_MESSAGE) {
        return respond(
            false,
            400,
            `Message must be ${MAX_MESSAGE} characters or fewer.`,
        );
    }

    if (!env.RESEND_API_KEY) {
        return respond(
            false,
            500,
            `Email isn't configured yet. Please email ${TO} directly.`,
        );
    }

    const displayName = name || "(not provided)";
    const subject = `New contact message from ${name || email}`;
    const text =
        `New message from the streanga.com contact form.\n\n` +
        `Name: ${displayName}\n` +
        `Email: ${email}\n\n` +
        `Message:\n${message}\n`;
    const html = `<div style="font-family:system-ui,sans-serif;line-height:1.6">
  <h2 style="margin:0 0 16px">New contact form message</h2>
  <p style="margin:0 0 4px"><strong>Name:</strong> ${escapeHtml(displayName)}</p>
  <p style="margin:0 0 16px"><strong>Email:</strong> ${escapeHtml(email)}</p>
  <p style="margin:0 0 4px"><strong>Message:</strong></p>
  <p style="white-space:pre-wrap;margin:0">${escapeHtml(message)}</p>
</div>`;

    try {
        const sent = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                from: FROM,
                to: [TO],
                reply_to: email, // hitting "reply" goes straight to the sender
                subject,
                text,
                html,
            }),
        });

        if (!sent.ok) {
            return respond(
                false,
                502,
                `Couldn't send your message right now. Please email ${TO} directly.`,
            );
        }
    } catch {
        return respond(
            false,
            502,
            `Couldn't send your message right now. Please email ${TO} directly.`,
        );
    }

    return respond(true, 200);
}
