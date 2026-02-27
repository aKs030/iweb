import React from 'react';
import { Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { i18n } from '../../core/i18n.js';

const { createElement: h, Fragment } = React;

function ContactForm() {
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    _gotcha: '', // Honeypot
  });

  const [status, setStatus] = React.useState('idle'); // idle, submitting, success, error
  const [errorMessage, setErrorMessage] = React.useState('');

  // UX: Focus management for accessibility
  const successRef = React.useRef(null);

  React.useEffect(() => {
    if (status === 'success' && successRef.current) {
      successRef.current.focus();
    }
  }, [status]);

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
        throw new Error(i18n.t('contact.error.server_format'));
      }

      if (!response.ok) {
        throw new Error(data.error || i18n.t('contact.error.generic'));
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
      setErrorMessage(err.message || i18n.t('contact.error.network'));
    }
  };

  if (status === 'success') {
    return h(
      'div',
      { className: 'contact-form-card' },
      h(
        'div',
        {
          ref: successRef,
          tabIndex: -1, // Make focusable programmatically
          role: 'status', // Announce status change
          'aria-live': 'polite',
          className: 'status-message status-success status-success-panel',
        },
        h(CheckCircle, {
          size: 64,
          className: 'contact-success-icon',
        }),
        h(
          'h2',
          { className: 'contact-success-title' },
          i18n.t('contact.success.title'),
        ),
        h(
          'p',
          { className: 'contact-success-text' },
          i18n.t('contact.success.message'),
        ),
        h(
          'button',
          {
            className: 'btn-submit btn-submit-inline',
            onClick: () => setStatus('idle'),
          },
          i18n.t('contact.success.new_message'),
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
      h('h1', null, i18n.t('contact.title')),
      h('p', null, i18n.t('contact.subtitle')),
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
          h(
            'label',
            { htmlFor: 'name', className: 'form-label' },
            i18n.t('contact.form.name'),
          ),
          h('input', {
            type: 'text',
            id: 'name',
            name: 'name',
            value: formData.name,
            onChange: handleChange,
            required: true,
            className: 'form-input',
            placeholder: i18n.t('contact.form.name_placeholder'),
          }),
        ),
        // Email
        h(
          'div',
          { className: 'form-group' },
          h(
            'label',
            { htmlFor: 'email', className: 'form-label' },
            i18n.t('contact.form.email'),
          ),
          h('input', {
            type: 'email',
            id: 'email',
            name: 'email',
            value: formData.email,
            onChange: handleChange,
            required: true,
            className: 'form-input',
            placeholder: i18n.t('contact.form.email_placeholder'),
          }),
        ),
        // Subject
        h(
          'div',
          { className: 'form-group' },
          h(
            'label',
            { htmlFor: 'subject', className: 'form-label' },
            i18n.t('contact.form.subject'),
          ),
          h('input', {
            type: 'text',
            id: 'subject',
            name: 'subject',
            value: formData.subject,
            onChange: handleChange,
            className: 'form-input',
            placeholder: i18n.t('contact.form.subject_placeholder'),
          }),
        ),
        // Message
        h(
          'div',
          { className: 'form-group' },
          h(
            'label',
            { htmlFor: 'message', className: 'form-label' },
            i18n.t('contact.form.message'),
          ),
          h('textarea', {
            id: 'message',
            name: 'message',
            value: formData.message,
            onChange: handleChange,
            required: true,
            className: 'form-textarea',
            placeholder: i18n.t('contact.form.message_placeholder'),
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
          'aria-hidden': 'true', // Hide from screen readers
        }),

        // Error Message
        status === 'error' &&
          h(
            'div',
            {
              className: 'status-message status-error status-error-inline',
              role: 'alert', // Announce errors immediately
              'aria-live': 'assertive',
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
                  ' ' + i18n.t('contact.form.submitting'),
                )
              : h(
                  Fragment,
                  null,
                  h(Send, { size: 18 }),
                  ' ' + i18n.t('contact.form.submit'),
                ),
          ),
        ),
      ),
    ),
  );
}

export default ContactForm;
