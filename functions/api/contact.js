import { createLogger } from '../../content/core/logger.js';

const log = createLogger('contact');
/**
 * Handles contact form submissions.
 * POST /api/contact
 * Uses Resend API directly (no package needed)
 * Security: Honeypot, Rate Limiting, Input Sanitization
 */

import { escapeHtml } from './_html-utils.js';
import { getCorsHeaders, handleOptions } from './_cors.js';
import { createWindowRateLimiter } from './_rate-limit.js';
import { getRequestClientIp } from './_request-utils.js';
import { errorJsonResponse, jsonResponse } from './_response.js';
import {
  CACHE_CONTROL_PRIVATE_NO_STORE,
  mergeHeaders,
} from '../_shared/http-headers.js';

const MAX_MESSAGES_PER_HOUR = 5;
const RATE_LIMIT_TTL = 3600; // 1 hour in seconds
const rateLimiter = createWindowRateLimiter({
  keyNamespace: 'contact_rate:v2',
  maxEntries: 1000,
});

function buildJsonHeaders(corsHeaders, extraHeaders = {}) {
  return mergeHeaders(
    corsHeaders,
    {
      'Cache-Control': CACHE_CONTROL_PRIVATE_NO_STORE,
    },
    extraHeaders,
  );
}

function jsonCorsResponse(
  corsHeaders,
  payload,
  status = 200,
  extraHeaders = {},
) {
  return jsonResponse(payload, {
    status,
    headers: buildJsonHeaders(corsHeaders, extraHeaders),
  });
}

function errorCorsResponse(
  corsHeaders,
  error,
  status = 500,
  extraHeaders = {},
) {
  return errorJsonResponse(error, {
    status,
    headers: buildJsonHeaders(corsHeaders, extraHeaders),
  });
}

export async function onRequestPost({ request, env }) {
  const corsHeaders = getCorsHeaders(request, env);

  try {
    // Check if body is JSON
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return errorCorsResponse(
        corsHeaders,
        'Content-Type must be application/json',
        400,
      );
    }

    // Rate limiting (IP-based)
    const clientIp = getRequestClientIp(request);
    const rateLimit = await rateLimiter.check(clientIp, {
      kv: env.RATE_LIMIT_KV,
      limit: MAX_MESSAGES_PER_HOUR,
      windowSeconds: RATE_LIMIT_TTL,
    });
    if (!rateLimit.allowed) {
      return errorCorsResponse(
        corsHeaders,
        {
          error:
            'Zu viele Nachrichten. Bitte versuchen Sie es in einer Stunde erneut.',
        },
        429,
        {
          'Retry-After': String(rateLimit.retryAfter || RATE_LIMIT_TTL),
        },
      );
    }

    const formData = await request.json();
    const { name, email, subject, message, _gotcha } = formData;

    // Honeypot check (anti-spam)
    if (_gotcha) {
      return jsonCorsResponse(corsHeaders, {
        success: true,
        message: 'Message received',
      });
    }

    // Validation
    if (!name || !email || !message) {
      return errorCorsResponse(
        corsHeaders,
        'Bitte füllen Sie alle Pflichtfelder aus.',
        400,
      );
    }

    // Length validation
    if (
      message.length > 5000 ||
      name.length > 200 ||
      (subject && subject.length > 300)
    ) {
      return errorCorsResponse(
        corsHeaders,
        'Eingabe zu lang. Bitte kürzen Sie Ihre Nachricht.',
        400,
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorCorsResponse(
        corsHeaders,
        'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
        400,
      );
    }

    if (!env.RESEND_API_KEY) {
      return errorCorsResponse(corsHeaders, 'Server configuration error.', 500);
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
        from: `Contact Form <${env.CONTACT_FROM_EMAIL || 'onboarding@resend.dev'}>`,
        to: [env.CONTACT_EMAIL],
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
      return errorCorsResponse(
        corsHeaders,
        'Fehler beim Senden der E-Mail.',
        500,
      );
    }

    // Save to Database for Admin Dashboard

    if (env.DB_LIKES) {
      try {
        await env.DB_LIKES.prepare(
          'INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
        )
          .bind(name, email, subject || 'Kein Betreff', message)
          .run();
      } catch (dbError) {
        log.error('Failed to save contact message to DB:', dbError);
        // We continue anyway since the email was sent successfully
      }
    }

    const data = await resendResponse.json();

    return jsonCorsResponse(corsHeaders, { success: true, id: data.id });
  } catch {
    return errorCorsResponse(
      corsHeaders,
      'Ein unerwarteter Fehler ist aufgetreten.',
      500,
    );
  }
}

export const onRequestOptions = handleOptions;
