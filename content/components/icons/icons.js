import htm from 'https://esm.sh/htm@3.1.1';
import React from 'https://esm.sh/react@19.2.3';

const html = htm.bind(React.createElement);

/**
 * Base Icon Component
 */
export const IconBase = ({ children, className, style, ...props }) => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className=${className}
    style=${style}
    ...${props}
  >
    ${children}
  </svg>
`;

// --- Blog Icons ---

export const Clock = (props) => html`
  <${IconBase} width="14" height="14" ...${props}>
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  <//>
`;

export const ArrowRight = (props) => html`
  <${IconBase} width="16" height="16" ...${props}>
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  <//>
`;

export const Search = (props) => html`
  <${IconBase} width="18" height="18" ...${props}>
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  <//>
`;

export const ArrowUp = (props) => html`
  <${IconBase} width="20" height="20" ...${props}>
    <line x1="12" y1="19" x2="12" y2="5"></line>
    <polyline points="5 12 12 5 19 12"></polyline>
  <//>
`;

// --- Projects Icons ---

export const ExternalLink = (props) => html`
  <${IconBase} ...${props}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  <//>
`;

export const Github = (props) => html`
  <${IconBase} ...${props}>
    <path
      d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"
    />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  <//>
`;

export const ArrowDown = (props) => html`
  <${IconBase} ...${props}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  <//>
`;

export const MousePointerClick = (props) => html`
  <${IconBase} ...${props}>
    <path d="M14 4.1 12 6" />
    <path d="m5.1 8-2.9-.8" />
    <path d="m6 12-1.9 2" />
    <path d="M7.2 2.2 8 5.1" />
    <path
      d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"
    />
  <//>
`;

export const Palette = (props) => html`
  <${IconBase} ...${props}>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path
      d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
    />
  <//>
`;

export const Binary = (props) => html`
  <${IconBase} ...${props}>
    <rect x="14" y="14" width="4" height="6" rx="2" />
    <rect x="6" y="4" width="4" height="6" rx="2" />
    <path d="M6 20h4" />
    <path d="M14 10h4" />
    <path d="M6 14h2v6" />
    <path d="M14 4h2v6" />
  <//>
`;

export const Gamepad2 = (props) => html`
  <${IconBase} ...${props}>
    <line x1="6" x2="10" y1="11" y2="11" />
    <line x1="8" x2="8" y1="9" y2="13" />
    <line x1="15" x2="15.01" y1="12" y2="12" />
    <line x1="18" x2="18.01" y1="10" y2="10" />
    <path
      d="M17.3 2.9A2 2 0 0 0 15 2H9a2 2 0 0 0-2.3.9C3.8 5.7 3 9.4 4.2 13c1 3 3.6 5 6.8 5h2c3.2 0 5.8-2 6.8-5 1.2-3.6.4-7.3-2.5-10.1Z"
    />
  <//>
`;

export const ListTodo = (props) => html`
  <${IconBase} ...${props}>
    <rect x="3" y="5" width="6" height="6" rx="1" />
    <path d="m3 17 2 2 4-4" />
    <path d="M13 6h8" />
    <path d="M13 12h8" />
    <path d="M13 18h8" />
  <//>
`;

export const Check = (props) => html`
  <${IconBase} ...${props}>
    <path d="M20 6 9 17l-5-5" />
  <//>
`;

export const Code = (props) => html`
  <${IconBase} ...${props}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  <//>
`;

export const Globe = (props) => html`
  <${IconBase} ...${props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  <//>
`;

export const Zap = (props) => html`
  <${IconBase} ...${props}>
    <path
      d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
    />
  <//>
`;

export const Sparkles = (props) => html`
  <${IconBase} ...${props}>
    <path
      d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
    />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
    <path d="M4 17v2" />
    <path d="M5 18H3" />
  <//>
`;

export const Rocket = (props) => html`
  <${IconBase} ...${props}>
    <path
      d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"
    />
    <path
      d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"
    />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  <//>
`;

// --- Gallery-specific icon (migrated from pages/gallery/components/gallery-icons.js)
export const X_Icon = (props) => html`
  <${IconBase} width="20" height="20" ...${props}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  <//>
`;
