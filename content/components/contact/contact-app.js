import React from 'react';
import { createRoot } from 'react-dom/client';
import ContactForm from './contact-component.js';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(React.createElement(ContactForm));
}
