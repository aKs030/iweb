import { BASE_URL } from './constants.js';

export const ROUTES = {
  default: {
    title:
      'Abdulkerim Sesli | Webentwicklung & Fotografie Berlin | Abdul Berlin',
    description:
      'Offizielles Portfolio von Abdulkerim Sesli (Abdul Berlin). Webentwickler (React, Three.js) und Fotograf aus Berlin. Nicht zu verwechseln mit Hörbuch-Verlagen.',
    title_en: 'Abdulkerim Sesli — Web Developer & Photographer in Berlin',
    description_en:
      'Abdulkerim Sesli — Web Developer & Photographer in Berlin. Specialist in React, Three.js and urban photography. Portfolio, references & contact.',
    type: 'ProfilePage',
    image: `${BASE_URL}/content/assets/img/og/og-home-800.webp`,
    imageWebp: `${BASE_URL}/content/assets/img/og/og-home-800.webp`,
  },
  '/projekte/': {
    title: 'Referenzen & Code-Projekte | Abdulkerim Sesli',
    description:
      'Entdecke interaktive Web-Experimente aus Berlin (13507). Spezialisiert auf performante React-Lösungen, 3D-Web (Three.js) und modernes UI/UX Design.',
    title_en: 'References & Code Projects | Abdulkerim Sesli',
    description_en:
      'Explore interactive web experiments and business apps. Specialist in performant React solutions, 3D web (Three.js) and modern UI/UX.',
    type: 'CollectionPage',
    image: `${BASE_URL}/content/assets/img/og/og-projekte-800.webp`,
  },
  '/blog/': {
    title: 'Tech-Blog & Tutorials | Webentwicklung Berlin',
    description:
      'Expertenwissen zu JavaScript, CSS und Web-Architektur. Praxisnahe Tutorials und Einblicke in den Workflow eines Berliner Fullstack-Entwicklers.',
    title_en: 'Tech Blog & Tutorials | Web Development Berlin',
    description_en:
      'Practical articles on JavaScript, CSS and web architecture. Hands-on tutorials and insights from a Berlin-based developer.',
    type: 'Blog',
    image: `${BASE_URL}/content/assets/img/og/og-home-800.webp`,
  },
  '/videos/': {
    title: 'Videos — Abdulkerim Sesli',
    description:
      'Eine Auswahl meiner Arbeiten, kurzen Vorstellungen und Behind-the-Scenes.',
    title_en: 'Videos — Abdulkerim Sesli',
    description_en:
      'A selection of my work, brief presentations and behind-the-scenes.',
    type: 'CollectionPage',
    image: `${BASE_URL}/content/assets/img/og/og-videos-800.webp`,
  },
  '/gallery/': {
    title: 'Fotografie Portfolio | Urban & Portrait Berlin',
    description:
      'Visuelle Ästhetik aus der Hauptstadt. Kuratierte Galerie mit Fokus auf Street Photography, Architektur und atmosphärische Portraits aus Berlin und Umgebung.',
    title_en: 'Photography Portfolio | Urban & Portraits Berlin',
    description_en:
      'Visual aesthetics from the capital. Curated gallery focused on street photography, architecture and atmospheric portraits from Berlin.',
    type: 'ImageGallery',
    image: `${BASE_URL}/content/assets/img/og/og-home-800.webp`,
  },
  '/about/': {
    title: 'Kontakt & Profil | Abdulkerim Sesli',
    description:
      'Der Mensch hinter dem Code. Detaillierter Lebenslauf, Tech-Stack Übersicht und direkte Kontaktmöglichkeiten für Projektanfragen und Kooperationen.',
    type: 'AboutPage',
    image: `${BASE_URL}/content/assets/img/og/og-home-800.webp`,
  },
  '/datenschutz/': {
    title: 'Datenschutzerklärung | Abdulkerim Sesli',
    description:
      'Informationen zum Datenschutz und zur Verarbeitung personenbezogener Daten gemäß DSGVO.',
    type: 'WebPage',
    image: `${BASE_URL}/content/assets/img/og/og-home-800.webp`,
  },
  '/impressum/': {
    title: 'Impressum | Abdulkerim Sesli',
    description:
      'Rechtliche Anbieterkennzeichnung und Kontaktinformationen gemäß TMG.',
    type: 'WebPage',
    image: `${BASE_URL}/content/assets/img/og/og-home-800.webp`,
  },
};
