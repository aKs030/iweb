/* global React, ReactDOM */
/**
 * Interactive Projects Module
 * Migrated from inline script for better maintainability and performance.
 */

const e = React.createElement;

// --- Components ---
const IconBase = ({ children, className, style, ...props }) =>
  e(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '24',
      height: '24',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: className,
      style: style,
      ...props
    },
    children
  );

const ExternalLink = (props) =>
  e(
    IconBase,
    props,
    e('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
    e('polyline', { points: '15 3 21 3 21 9' }),
    e('line', { x1: '10', x2: '21', y1: '14', y2: '3' })
  );
const Github = (props) =>
  e(
    IconBase,
    props,
    e('path', {
      d: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4'
    }),
    e('path', { d: 'M9 18c-4.51 2-5-2-7-2' })
  );
const ArrowDown = (props) =>
  e(IconBase, props, e('path', { d: 'M12 5v14' }), e('path', { d: 'm19 12-7 7-7-7' }));
const MousePointerClick = (props) =>
  e(
    IconBase,
    props,
    e('path', { d: 'M14 4.1 12 6' }),
    e('path', { d: 'm5.1 8-2.9-.8' }),
    e('path', { d: 'm6 12-1.9 2' }),
    e('path', { d: 'M7.2 2.2 8 5.1' }),
    e('path', {
      d: 'M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z'
    })
  );
const Palette = (props) =>
  e(
    IconBase,
    props,
    e('circle', { cx: '13.5', cy: '6.5', r: '.5', fill: 'currentColor' }),
    e('circle', { cx: '17.5', cy: '10.5', r: '.5', fill: 'currentColor' }),
    e('circle', { cx: '8.5', cy: '7.5', r: '.5', fill: 'currentColor' }),
    e('circle', { cx: '6.5', cy: '12.5', r: '.5', fill: 'currentColor' }),
    e('path', {
      d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z'
    })
  );
const Binary = (props) =>
  e(
    IconBase,
    props,
    e('rect', { x: '14', y: '14', width: '4', height: '6', rx: '2' }),
    e('rect', { x: '6', y: '4', width: '4', height: '6', rx: '2' }),
    e('path', { d: 'M6 20h4' }),
    e('path', { d: 'M14 10h4' }),
    e('path', { d: 'M6 14h2v6' }),
    e('path', { d: 'M14 4h2v6' })
  );
const Gamepad2 = (props) =>
  e(
    IconBase,
    props,
    e('line', { x1: '6', x2: '10', y1: '11', y2: '11' }),
    e('line', { x1: '8', x2: '8', y1: '9', y2: '13' }),
    e('line', { x1: '15', x2: '15.01', y1: '12', y2: '12' }),
    e('line', { x1: '18', x2: '18.01', y1: '10', y2: '10' }),
    e('path', {
      d: 'M17.3 2.9A2 2 0 0 0 15 2H9a2 2 0 0 0-2.3.9C3.8 5.7 3 9.4 4.2 13c1 3 3.6 5 6.8 5h2c3.2 0 5.8-2 6.8-5 1.2-3.6.4-7.3-2.5-10.1Z'
    })
  );
const ListTodo = (props) =>
  e(
    IconBase,
    props,
    e('rect', { x: '3', y: '5', width: '6', height: '6', rx: '1' }),
    e('path', { d: 'm3 17 2 2 4-4' }),
    e('path', { d: 'M13 6h8' }),
    e('path', { d: 'M13 12h8' }),
    e('path', { d: 'M13 18h8' })
  );
const Check = (props) => e(IconBase, props, e('path', { d: 'M20 6 9 17l-5-5' }));

// --- DATA ---
const projects = [
  {
    id: 1,
    title: 'Schere Stein Papier',
    description: 'Der Klassiker gegen den Computer!',
    tags: ['JavaScript', 'Game Logic'],
    category: 'Game',
    bgStyle: {
      background:
        'linear-gradient(to bottom right, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))'
    },
    glowColor: '#a855f7',
    icon: e(Gamepad2, { style: { color: '#c084fc', width: '32px', height: '32px' } }),
    previewContent: e(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          width: '100%',
          height: '100%',
          position: 'relative',
          zIndex: 10
        }
      },
      e('div', { style: { fontSize: '3rem' } }, '🪨'),
      e('div', { style: { fontSize: '1.5rem', opacity: 0.5 } }, 'VS'),
      e('div', { style: { fontSize: '3rem' } }, '✂️')
    )
  },
  {
    id: 2,
    title: 'Zahlen Raten',
    description: 'Finde die geheime Zahl zwischen 1 und 100.',
    tags: ['Logic', 'Input'],
    category: 'Puzzle',
    bgStyle: {
      background:
        'linear-gradient(to bottom right, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.2))'
    },
    glowColor: '#10b981',
    icon: e(Binary, { style: { color: '#34d399', width: '32px', height: '32px' } }),
    previewContent: e(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }
      },
      e('span', { style: { fontSize: '4rem', color: '#6ee7b7', fontWeight: 'bold' } }, '?')
    )
  },
  {
    id: 3,
    title: 'Color Changer',
    description: 'Dynamische Hintergrundfarben per Klick.',
    tags: ['DOM', 'Events'],
    category: 'UI',
    bgStyle: {
      background:
        'linear-gradient(to bottom right, rgba(249, 115, 22, 0.2), rgba(236, 72, 153, 0.2))'
    },
    glowColor: '#ec4899',
    icon: e(Palette, { style: { color: '#f472b6', width: '32px', height: '32px' } }),
    previewContent: e(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }
      },
      e(Palette, { style: { width: '4rem', height: '4rem', color: '#f472b6' } })
    )
  },
  {
    id: 4,
    title: 'To-Do Liste',
    description: 'Produktivitäts-Tool zum Verwalten von Aufgaben.',
    tags: ['CRUD', 'Arrays'],
    category: 'App',
    bgStyle: {
      background:
        'linear-gradient(to bottom right, rgba(59, 130, 246, 0.2), rgba(6, 182, 212, 0.2))'
    },
    glowColor: '#06b6d4',
    icon: e(ListTodo, { style: { color: '#22d3ee', width: '32px', height: '32px' } }),
    previewContent: e(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }
      },
      e(Check, { style: { width: '4rem', height: '4rem', color: '#22d3ee' } })
    )
  }
];

// --- APP ---
function App() {
  const scrollToProjects = () => {
    const firstProject = document.getElementById('project-1');
    if (firstProject) firstProject.scrollIntoView({ behavior: 'smooth' });
  };

  return e(
    React.Fragment,
    null,
    

    // Hero Section
    e(
      'section',
      { className: 'snap-section', id: 'hero' },
      e(
        'div',
        { className: 'container-center' },
        e(
          'div',
          { className: 'badge' },
          e(
            'span',
            { className: 'badge-dot-container' },
            e('span', { className: 'badge-dot-ping' }),
            e('span', { className: 'badge-dot' })
          ),
          'JavaScript & React'
        ),
        e(
          'h1',
          { className: 'headline' },
          e('span', { className: 'text-gradient-main' }, 'Meine'),
          e('span', { className: 'text-gradient-accent' }, 'Projekte.')
        ),
        e(
          'p',
          { className: 'description' },
          'Willkommen in meiner digitalen Werkstatt. Hier sammle ich meine Experimente, vom ersten console.log bis zu interaktiven Web-Apps.'
        ),
        e(
          'div',
          { className: 'btn-group' },
          e(
            'button',
            { onClick: scrollToProjects, className: 'btn btn-primary' },
            "Los geht's ",
            e(ArrowDown, { style: { width: '1rem', height: '1rem' } })
          )
        )
      )
    ),

    // Project Sections
    projects.map((project, _index) =>
      e(
        'section',
        { key: project.id, id: `project-${project.id}`, className: 'snap-section' },
        e('div', { className: 'glow-bg', style: project.bgStyle }),
        e(
          'div',
          { className: 'project-grid' },
          // Left Side (Mockup)
          e(
            'div',
            {
              className: 'group',
              style: { order: 2, display: 'flex', justifyContent: 'center', position: 'relative' }
            },
            e('div', { className: 'back-glow', style: { backgroundColor: project.glowColor } }),
            e(
              'div',
              { className: 'window-mockup' },
              e(
                'div',
                { className: 'mockup-content' },
                e('div', { className: 'mockup-bg-pattern' }),
                project.previewContent,
                e('div', { className: 'mockup-icon' }, project.icon)
              )
            )
          ),
          // Right Side (Content)
          e(
            'div',
            { className: 'project-info', style: { order: 1 } },
            e(
              'div',
              { className: 'project-header' },
              e('h2', { className: 'project-title' }, project.title),
              e('div', { className: 'divider' }),
              e('span', { className: 'project-category' }, project.category)
            ),
            e('p', { className: 'project-desc' }, project.description),
            e(
              'div',
              { className: 'tags-container' },
              project.tags.map((tag, i) => e('span', { key: i, className: 'tag' }, tag))
            ),
            e(
              'div',
              { className: 'project-actions' },
              e(
                'button',
                { className: 'btn btn-primary btn-small', rel: 'noopener noreferrer' },
                e(ExternalLink, { style: { width: '1rem', height: '1rem' } }),
                ' Ansehen'
              ),
              e(
                'button',
                { className: 'btn btn-outline btn-small', rel: 'noopener noreferrer' },
                e(Github, { style: { width: '1rem', height: '1rem' } }),
                ' Code'
              )
            )
          )
        )
      )
    ),

    // Contact Section
    e(
      'section',
      { className: 'snap-section contact-section', id: 'contact' },
      e(
        'div',
        { className: 'container-center' },
        e(
          'div',
          { style: { marginBottom: '2rem' } },
          e(
            'div',
            { className: 'contact-icon-wrapper' },
            e(MousePointerClick, { style: { width: '2.5rem', height: '2.5rem', color: '#60a5fa' } })
          )
        ),
        e('h2', { className: 'contact-title' }, 'Lust auf ein Spiel?'),
        e(
          'p',
          { className: 'contact-text' },
          'Ich lerne jeden Tag dazu. Hast du Ideen für mein nächstes kleines Projekt?'
        ),
        e(
          'div',
          { className: 'btn-group' },
          e(
            'button',
            { className: 'btn btn-primary', style: { backgroundColor: '#2563eb', color: 'white' } },
            'Schreib mir'
          )
        )
      )
    )
  );
}

// Init Function to be called from HTML
export function initProjectsApp() {
  const rootEl = document.getElementById('root');
  if (rootEl && window.ReactDOM && window.React) {
    const root = ReactDOM.createRoot(rootEl);
    root.render(e(App));
  } else {
    console.error('React dependencies or root element missing');
  }
}
