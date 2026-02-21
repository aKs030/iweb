/**
 * Handles contact form submissions.
 * POST /api/contact
 * Uses Resend API directly (no package needed)
 * Security: Honeypot, Rate Limiting, Input Sanitization
 */

import { escapeHtml } from './_html-utils.js';

const MAX_MESSAGES_PER_HOUR = 5;
const RATE_LIMIT_TTL = 3600; // 1 hour in seconds
const inMemoryRateLimitStore = new Map();

/**
 * Resolve a stable client identifier from common proxy headers
 * @param {Request} request
 * @returns {string}
 */
function getClientIp(request) {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return 'unknown';
}

/**
 * Best-effort in-memory fallback rate limit (per isolate)
 * @param {string} ip
 * @returns {{allowed: boolean, remaining: number, retryAfter?: number}}
 */
function checkInMemoryRateLimit(ip) {
  const now = Date.now();
  const windowMs = RATE_LIMIT_TTL * 1000;

  if (inMemoryRateLimitStore.size > 1000) {
    for (const [key, value] of inMemoryRateLimitStore.entries()) {
      if (value.expiresAt <= now) inMemoryRateLimitStore.delete(key);
    }
  }

  const entry = inMemoryRateLimitStore.get(ip);
  if (!entry || entry.expiresAt <= now) {
    inMemoryRateLimitStore.set(ip, {
      count: 1,
      expiresAt: now + windowMs,
    });
    return { allowed: true, remaining: MAX_MESSAGES_PER_HOUR - 1 };
  }

  if (entry.count >= MAX_MESSAGES_PER_HOUR) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)),
    };
  }

  entry.count += 1;
  return { allowed: true, remaining: MAX_MESSAGES_PER_HOUR - entry.count };
}

/**
 * Check rate limit using Cloudflare KV
 * @param {string} ip
 * @param {Object} env
 * @returns {Promise<{allowed: boolean, remaining: number, retryAfter?: number}>}
 */
async function checkRateLimit(ip, env) {
  if (!env.RATE_LIMIT_KV) {
    return checkInMemoryRateLimit(ip);
  }

  const key = `contact_rate:${ip}`;
  try {
    const raw = await env.RATE_LIMIT_KV.get(key);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    const count = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

    if (count >= MAX_MESSAGES_PER_HOUR) {
      return { allowed: false, remaining: 0, retryAfter: RATE_LIMIT_TTL };
    }

    await env.RATE_LIMIT_KV.put(key, String(count + 1), {
      expirationTtl: RATE_LIMIT_TTL,
    });

    return { allowed: true, remaining: MAX_MESSAGES_PER_HOUR - count - 1 };
  } catch {
    // If KV fails, degrade gracefully to in-memory limiter.
    return checkInMemoryRateLimit(ip);
  }
}

export async function onRequestPost({ request, env }) {
  const { getCorsHeaders } = await import('./_cors.js');
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // Check if body is JSON
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be application/json' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    // Rate limiting (IP-based)
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(clientIp, env);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error:
            'Zu viele Nachrichten. Bitte versuchen Sie es in einer Stunde erneut.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.retryAfter || RATE_LIMIT_TTL),
            ...corsHeaders,
          },
        },
      );
    }

    const formData = await request.json();
    const { name, email, subject, message, _gotcha } = formData;

    // Honeypot check (anti-spam)
    if (_gotcha) {
      return new Response(
        JSON.stringify({ success: true, message: 'Message received' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    // Validation
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Bitte füllen Sie alle Pflichtfelder aus.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    // Length validation
    if (
      message.length > 5000 ||
      name.length > 200 ||
      (subject && subject.length > 300)
    ) {
      return new Response(
        JSON.stringify({
          error: 'Eingabe zu lang. Bitte kürzen Sie Ihre Nachricht.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({
          error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    if (!env.RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    // Sanitize all user inputs for email HTML
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    // Call Resend API directly
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Contact Form <onboarding@resend.dev>',
        to: ['krm19030@gmail.com'],
        reply_to: email,
        subject: `Kontaktformular: ${safeSubject || 'Kein Betreff'}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Neue Nachricht von ${safeName}</h2>
            <p><strong>Absender:</strong> ${safeName} (<a href="mailto:${safeEmail}">${safeEmail}</a>)</p>
            <p><strong>Betreff:</strong> ${safeSubject || 'Kein Betreff'}</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <div style="white-space: pre-wrap; background: #f9f9f9; padding: 15px; border-radius: 5px;">${safeMessage}</div>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">Diese E-Mail wurde über das Kontaktformular auf abdulkerimsesli.de gesendet.</p>
          </div>
        `,
      }),
    });

    if (!resendResponse.ok) {
      await resendResponse.text(); // Consume response body
      return new Response(
        JSON.stringify({
          error:
            'Fehler beim Senden der E-Mail. Bitte versuchen Sie es später erneut.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    const data = await resendResponse.json();

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: 'Ein unerwarteter Fehler ist aufgetreten.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
}

export async function onRequestOptions({ request, env }) {
  const { handleOptions } = await import('./_cors.js');
  return handleOptions({ request, env });
}
