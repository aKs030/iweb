import { ogImageUrl } from './constants.js';

const OG_HOME_IMAGE = ogImageUrl('og-home-800.png');
const OG_PROJECTS_IMAGE = ogImageUrl('og-projekte-800.png');
const OG_VIDEOS_IMAGE = ogImageUrl('og-videos-800.png');

const defineRoute = (route) => Object.freeze(route);

export const ROUTES = Object.freeze({
  default: defineRoute({
    title:
      'Abdulkerim Sesli | Full-Stack Web Developer für Three.js, AI & Performance',
    description:
      'Offizielle Website von Abdulkerim Sesli (auch bekannt als Abdul Sesli). Portfolio mit moderner Webentwicklung, Three.js, AI-Integration, Projekten, Blog und Kontakt.',
    title_en:
      'Abdulkerim Sesli — Full-Stack Web Developer (Three.js, AI, Performance)',
    description_en:
      'Official website of Abdulkerim Sesli (also known as Abdul Sesli). Portfolio focused on modern web engineering, Three.js, AI integration, projects, blog, and contact.',
    type: 'ProfilePage',
    image: OG_HOME_IMAGE,
    imageWebp: OG_HOME_IMAGE,
  }),
  '/projekte/': defineRoute({
    title: 'Referenzen & Code-Projekte | Abdulkerim Sesli',
    description:
      'Entdecke interaktive Web-Experimente und produktionsnahe Apps. Fokus auf JavaScript ES2023+, Three.js, AI-Features und performantes UI Engineering.',
    title_en: 'References & Code Projects | Abdulkerim Sesli',
    description_en:
      'Explore interactive web experiments and production-minded apps. Focused on JavaScript ES2023+, Three.js, AI features, and high-performance UI engineering.',
    type: 'CollectionPage',
    image: OG_PROJECTS_IMAGE,
  }),
  '/blog/': defineRoute({
    title: 'Tech-Blog & Tutorials | Abdulkerim Sesli',
    description:
      'Expertenwissen zu JavaScript, CSS und Web-Architektur. Praxisnahe Tutorials und Einblicke in den Workflow eines Berliner Fullstack-Entwicklers.',
    title_en: 'Tech Blog & Tutorials | Web Development Berlin',
    description_en:
      'Practical articles on JavaScript, CSS and web architecture. Hands-on tutorials and insights from a Berlin-based developer.',
    type: 'Blog',
    image: OG_HOME_IMAGE,
  }),
  '/videos/': defineRoute({
    title: 'Videos — Abdulkerim Sesli',
    description:
      'Eine Auswahl meiner Arbeiten, kurzen Vorstellungen und Behind-the-Scenes.',
    title_en: 'Videos — Abdulkerim Sesli',
    description_en:
      'A selection of my work, brief presentations and behind-the-scenes.',
    type: 'CollectionPage',
    image: OG_VIDEOS_IMAGE,
  }),
  '/gallery/': defineRoute({
    title: 'Fotografie Portfolio | Abdulkerim Sesli',
    description:
      'Visuelle Ästhetik aus der Hauptstadt. Kuratierte Galerie mit Fokus auf Street Photography, Architektur und atmosphärische Portraits aus Berlin und Umgebung.',
    title_en: 'Photography Portfolio | Urban & Portraits Berlin',
    description_en:
      'Visual aesthetics from the capital. Curated gallery focused on street photography, architecture and atmospheric portraits from Berlin.',
    type: 'ImageGallery',
    image: OG_HOME_IMAGE,
  }),
  '/about/': defineRoute({
    title: 'Über mich | Abdulkerim Sesli',
    title_en: 'About me | Abdulkerim Sesli',
    description:
      'Der Mensch hinter dem Code. Detaillierter Lebenslauf, Tech-Stack Übersicht und direkte Kontaktmöglichkeiten für Projektanfragen und Kooperationen.',
    description_en:
      'The person behind the code. Detailed background, tech stack overview, and direct contact options for project inquiries and collaborations.',
    type: 'AboutPage',
    image: OG_HOME_IMAGE,
  }),
  '/abdul-sesli/': defineRoute({
    title: 'Abdul Sesli | Offizielles Profil von Abdulkerim Sesli',
    description:
      'Abdul Sesli ist die Kurzform von Abdulkerim Sesli. Diese Seite verweist auf das offizielle Portfolio mit Blog, Videos, Bildern und Projekten.',
    title_en: 'Abdul Sesli | Official profile of Abdulkerim Sesli',
    description_en:
      'Abdul Sesli is the short name of Abdulkerim Sesli. This page links to the official portfolio with blog, videos, images and projects.',
    type: 'ProfilePage',
    image: OG_HOME_IMAGE,
  }),
  '/contact/': defineRoute({
    title: 'Kontakt | Abdulkerim Sesli',
    title_en: 'Contact | Abdulkerim Sesli',
    description:
      'Projektanfrage oder Kooperation? Nimm direkt Kontakt auf und sende eine Nachricht.',
    description_en:
      'Project inquiry or collaboration? Get in touch directly and send a message.',
    type: 'ContactPage',
    image: OG_HOME_IMAGE,
  }),
  '/datenschutz/': defineRoute({
    title: 'Datenschutzerklärung | Abdulkerim Sesli',
    description:
      'Informationen zum Datenschutz und zur Verarbeitung personenbezogener Daten gemäß DSGVO.',
    type: 'WebPage',
    image: OG_HOME_IMAGE,
  }),
  '/impressum/': defineRoute({
    title: 'Impressum | Abdulkerim Sesli',
    description:
      'Rechtliche Anbieterkennzeichnung und Kontaktinformationen gemäß TMG.',
    type: 'WebPage',
    image: OG_HOME_IMAGE,
  }),
});
