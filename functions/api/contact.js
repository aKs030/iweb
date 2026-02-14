import { Resend } from 'resend';
import { getCorsHeaders, handleOptions } from './_cors.js';

/**
 * Handles contact form submissions.
 * POST /api/contact
 */
export async function onRequestPost({ request, env }) {
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
      // Return success to confuse bots, but don't send email
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

    const resend = new Resend(env.RESEND_API_KEY);

    // Send email via Resend
    // Note: 'onboarding@resend.dev' works only for testing.
    // In production, you should verify a domain and use it.
    // If using the free tier without a domain, you can only send to your own email address.
    const { data, error } = await resend.emails.send({
      from: 'Contact Form <onboarding@resend.dev>',
      to: ['krm19030@gmail.com'],
      reply_to: email,
      subject: `Kontaktformular: ${subject || 'Kein Betreff'}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Neue Nachricht von ${name}</h2>
          <p><strong>Absender:</strong> ${name} (<a href="mailto:${email}">${email}</a>)</p>
          <p><strong>Betreff:</strong> ${subject || 'Kein Betreff'}</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <div style="white-space: pre-wrap; background: #f9f9f9; padding: 15px; border-radius: 5px;">${message}</div>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">Diese E-Mail wurde über das Kontaktformular auf abdulkerimsesli.de gesendet.</p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend API Error:', error);
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

export const onRequestOptions = handleOptions;
