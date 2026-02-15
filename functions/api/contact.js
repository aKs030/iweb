/**
 * Handles contact form submissions.
 * POST /api/contact
 * Uses Resend API directly (no package needed)
 */
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
      console.error('RESEND_API_KEY is missing');
      return new Response(
        JSON.stringify({ error: 'Server configuration error.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      );
    }

    // Sanitize user input for HTML email and then call Resend API
    const escapeHtml = (s) =>
      String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const safeName = escapeHtml(name);
    const safeEmailDisplay = escapeHtml(email);
    const safeSubject = escapeHtml(subject || 'Kein Betreff');
    const safeMessageHtml = escapeHtml(message).replace(/\n/g, '<br>');

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
        subject: `Kontaktformular: ${safeSubject}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Neue Nachricht von ${safeName}</h2>
            <p><strong>Absender:</strong> ${safeName} (<a href="mailto:${safeEmailDisplay}">${safeEmailDisplay}</a>)</p>
            <p><strong>Betreff:</strong> ${safeSubject}</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <div style="white-space: pre-wrap; background: #f9f9f9; padding: 15px; border-radius: 5px;">${safeMessageHtml}</div>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">Diese E-Mail wurde über das Kontaktformular auf abdulkerimsesli.de gesendet.</p>
          </div>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('Resend API Error:', errorText);
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
  } catch (err) {
    console.error('Unexpected Error in /api/contact:', err);
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
