import { BASE_URL } from './constants.js';

export const ROUTES = {
  default: {
    title: 'Abdulkerim Sesli | Offizielles Portfolio für Web, Foto & Video',
    description:
      'Offizielle Website von Abdulkerim Sesli (auch bekannt als Abdul Sesli). Portfolio mit Webentwicklung, Fotografie, Videos, Projekten und Blog.',
    title_en: 'Abdulkerim Sesli — Web Developer & Photographer in Berlin',
    description_en:
      'Abdulkerim Sesli — Web Developer & Photographer in Berlin. Specialist in React, Three.js and urban photography. Portfolio, references & contact.',
    type: 'ProfilePage',
    image: `${BASE_URL}/content/assets/img/og/og-home-800.svg`,
    imageWebp: `${BASE_URL}/content/assets/img/og/og-home-800.svg`,
  },
  '/projekte/': {
    title: 'Referenzen & Code-Projekte | Abdulkerim Sesli',
    description:
      'Entdecke interaktive Web-Experimente aus Berlin (13507). Spezialisiert auf performante React-Lösungen, 3D-Web (Three.js) und modernes UI/UX Design.',
    title_en: 'References & Code Projects | Abdulkerim Sesli',
    description_en:
      'Explore interactive web experiments and business apps. Specialist in performant React solutions, 3D web (Three.js) and modern UI/UX.',
    type: 'CollectionPage',
    image: `${BASE_URL}/content/assets/img/og/og-projekte-800.svg`,
  },
  '/blog/': {
    title: 'Tech-Blog & Tutorials | Abdulkerim Sesli',
    description:
      'Expertenwissen zu JavaScript, CSS und Web-Architektur. Praxisnahe Tutorials und Einblicke in den Workflow eines Berliner Fullstack-Entwicklers.',
    title_en: 'Tech Blog & Tutorials | Web Development Berlin',
    description_en:
      'Practical articles on JavaScript, CSS and web architecture. Hands-on tutorials and insights from a Berlin-based developer.',
    type: 'Blog',
    image: `${BASE_URL}/content/assets/img/og/og-home-800.svg`,
  },
  '/videos/': {
    title: 'Videos — Abdulkerim Sesli',
    description:
      'Eine Auswahl meiner Arbeiten, kurzen Vorstellungen und Behind-the-Scenes.',
    title_en: 'Videos — Abdulkerim Sesli',
    description_en:
      'A selection of my work, brief presentations and behind-the-scenes.',
    type: 'CollectionPage',
    image: `${BASE_URL}/content/assets/img/og/og-videos-800.svg`,
  },
  '/gallery/': {
    title: 'Fotografie Portfolio | Abdulkerim Sesli',
    description:
      'Visuelle Ästhetik aus der Hauptstadt. Kuratierte Galerie mit Fokus auf Street Photography, Architektur und atmosphärische Portraits aus Berlin und Umgebung.',
    title_en: 'Photography Portfolio | Urban & Portraits Berlin',
    description_en:
      'Visual aesthetics from the capital. Curated gallery focused on street photography, architecture and atmospheric portraits from Berlin.',
    type: 'ImageGallery',
    image: `${BASE_URL}/content/assets/img/og/og-home-800.svg`,
  },
  '/about/': {
    title: 'Über mich | Abdulkerim Sesli',
    title_en: 'About me | Abdulkerim Sesli',
    description:
      'Der Mensch hinter dem Code. Detaillierter Lebenslauf, Tech-Stack Übersicht und direkte Kontaktmöglichkeiten für Projektanfragen und Kooperationen.',
    description_en:
      'The person behind the code. Detailed background, tech stack overview, and direct contact options for project inquiries and collaborations.',
    type: 'AboutPage',
    image: `${BASE_URL}/content/assets/img/og/og-home-800.svg`,
  },
  '/abdul-sesli/': {
    title: 'Abdul Sesli | Offizielles Profil von Abdulkerim Sesli',
    description:
      'Abdul Sesli ist die Kurzform von Abdulkerim Sesli. Diese Seite verweist auf das offizielle Portfolio mit Blog, Videos, Bildern und Projekten.',
    title_en: 'Abdul Sesli | Official profile of Abdulkerim Sesli',
    description_en:
      'Abdul Sesli is the short name of Abdulkerim Sesli. This page links to the official portfolio with blog, videos, images and projects.',
    type: 'ProfilePage',
    image: `${BASE_URL}/content/assets/img/og/og-home-800.svg`,
  },
  '/contact/': {
    title: 'Kontakt | Abdulkerim Sesli',
    title_en: 'Contact | Abdulkerim Sesli',
    description:
      'Projektanfrage oder Kooperation? Nimm direkt Kontakt auf und sende eine Nachricht.',
    description_en:
      'Project inquiry or collaboration? Get in touch directly and send a message.',
    type: 'ContactPage',
    image: `${BASE_URL}/content/assets/img/og/og-home-800.svg`,
  },
  '/datenschutz/': {
    title: 'Datenschutzerklärung | Abdulkerim Sesli',
    description:
      'Informationen zum Datenschutz und zur Verarbeitung personenbezogener Daten gemäß DSGVO.',
    type: 'WebPage',
    image: `${BASE_URL}/content/assets/img/og/og-home-800.svg`,
  },
  '/impressum/': {
    title: 'Impressum | Abdulkerim Sesli',
    description:
      'Rechtliche Anbieterkennzeichnung und Kontaktinformationen gemäß TMG.',
    type: 'WebPage',
    image: `${BASE_URL}/content/assets/img/og/og-home-800.svg`,
  },
};
