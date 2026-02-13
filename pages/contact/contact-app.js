import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const { createElement: h, Fragment } = React;

const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    _gotcha: '', // Honeypot
  });

  const [status, setStatus] = useState('idle'); // idle, submitting, success, error
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData._gotcha) return; // Spam detected

    setStatus('submitting');
    setErrorMessage('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Server antwortete mit ungültigem Format.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Ein Fehler ist aufgetreten.');
      }

      setStatus('success');
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: '',
        _gotcha: '',
      });
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage(
        err.message || 'Netzwerkfehler. Bitte prüfen Sie Ihre Verbindung.',
      );
    }
  };

  if (status === 'success') {
    return h(
      'div',
      { className: 'contact-form-card' },
      h(
        'div',
        {
          className: 'status-message status-success',
          style: {
            flexDirection: 'column',
            textAlign: 'center',
            padding: '3rem',
            background: 'transparent',
            border: 'none',
          },
        },
        h(CheckCircle, {
          size: 64,
          color: '#34d399',
          style: { marginBottom: '1rem' },
        }),
        h(
          'h2',
          {
            style: {
              fontSize: '1.8rem',
              marginBottom: '0.5rem',
              color: '#fff',
            },
          },
          'Nachricht gesendet!',
        ),
        h(
          'p',
          {
            style: {
              color: '#94a3b8',
              fontSize: '1.1rem',
              marginBottom: '2rem',
            },
          },
          'Vielen Dank für Ihre Nachricht. Ich werde mich so schnell wie möglich bei Ihnen melden.',
        ),
        h(
          'button',
          {
            className: 'btn-submit',
            style: { width: 'auto', padding: '0.8rem 2rem' },
            onClick: () => setStatus('idle'),
          },
          'Neue Nachricht senden',
        ),
      ),
    );
  }

  return h(
    'div',
    { className: 'contact-page-content' },
    h(
      'div',
      { className: 'contact-header' },
      h('h1', null, 'Lass uns sprechen'),
      h(
        'p',
        null,
        'Haben Sie eine Projektidee oder möchten Sie zusammenarbeiten? Füllen Sie das Formular aus und ich melde mich bei Ihnen.',
      ),
    ),
    h(
      'div',
      { className: 'contact-form-card' },
      h(
        'form',
        { onSubmit: handleSubmit },
        // Name
        h(
          'div',
          { className: 'form-group' },
          h('label', { htmlFor: 'name', className: 'form-label' }, 'Name'),
          h('input', {
            type: 'text',
            id: 'name',
            name: 'name',
            value: formData.name,
            onChange: handleChange,
            required: true,
            className: 'form-input',
            placeholder: 'Max Mustermann',
          }),
        ),
        // Email
        h(
          'div',
          { className: 'form-group' },
          h('label', { htmlFor: 'email', className: 'form-label' }, 'E-Mail'),
          h('input', {
            type: 'email',
            id: 'email',
            name: 'email',
            value: formData.email,
            onChange: handleChange,
            required: true,
            className: 'form-input',
            placeholder: 'max@beispiel.de',
          }),
        ),
        // Subject
        h(
          'div',
          { className: 'form-group' },
          h(
            'label',
            { htmlFor: 'subject', className: 'form-label' },
            'Betreff',
          ),
          h('input', {
            type: 'text',
            id: 'subject',
            name: 'subject',
            value: formData.subject,
            onChange: handleChange,
            className: 'form-input',
            placeholder: 'Projektanfrage...',
          }),
        ),
        // Message
        h(
          'div',
          { className: 'form-group' },
          h(
            'label',
            { htmlFor: 'message', className: 'form-label' },
            'Nachricht',
          ),
          h('textarea', {
            id: 'message',
            name: 'message',
            value: formData.message,
            onChange: handleChange,
            required: true,
            className: 'form-textarea',
            placeholder: 'Erzählen Sie mir von Ihrem Projekt...',
          }),
        ),
        // Honeypot
        h('input', {
          type: 'text',
          name: '_gotcha',
          value: formData._gotcha,
          onChange: handleChange,
          className: 'hidden-field',
          tabIndex: -1,
          autoComplete: 'off',
        }),

        // Error Message
        status === 'error' &&
          h(
            'div',
            {
              className: 'status-message status-error',
              style: { marginBottom: '1.5rem' },
            },
            h(AlertCircle, { size: 20 }),
            h('span', null, errorMessage),
          ),

        // Submit Button
        h(
          'div',
          { className: 'form-actions' },
          h(
            'button',
            {
              type: 'submit',
              className: 'btn-submit',
              disabled: status === 'submitting',
            },
            status === 'submitting'
              ? h(
                  Fragment,
                  null,
                  h(Loader2, { className: 'spinner', size: 18 }),
                  ' Wird gesendet...',
                )
              : h(Fragment, null, h(Send, { size: 18 }), ' Nachricht senden'),
          ),
        ),
      ),
    ),
  );
};

// Initialize
const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(h(ContactForm));
}
