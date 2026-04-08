import {
  OG_HOME_IMAGE_URL,
  OG_PROJECTS_IMAGE_URL,
  OG_VIDEOS_IMAGE_URL,
} from './constants.js';

const OG_HOME_IMAGE = OG_HOME_IMAGE_URL;
const OG_PROJECTS_IMAGE = OG_PROJECTS_IMAGE_URL;
const OG_VIDEOS_IMAGE = OG_VIDEOS_IMAGE_URL;

const defineRoute = (route) => Object.freeze(route);

export const ROUTES = Object.freeze({
  default: defineRoute({
    title:
      'Abdulkerim Sesli | Portfolio für Code, 3D, AI & digitale Experimente',
    description:
      'Persönliches Portfolio von Abdulkerim Sesli mit Web-Projekten, 3D-Interfaces, Fotografie, Videos und Build Notes.',
    title_en:
      'Abdulkerim Sesli — Portfolio for Code, 3D, AI & Digital Experiments',
    description_en:
      'Personal portfolio of Abdulkerim Sesli with web projects, 3D interfaces, photography, videos, and build notes.',
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
      'Persönliches Portfolio mit Hintergrund, Tech-Stack, Projekten und digitalen Experimenten von Abdulkerim Sesli.',
    description_en:
      'Personal portfolio with background, tech stack, projects, and digital experiments by Abdulkerim Sesli.',
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
      'Kontaktseite für Fragen, Feedback und persönlichen Austausch.',
    description_en:
      'Contact page for questions, feedback, and personal exchange.',
    type: 'ContactPage',
    image: OG_HOME_IMAGE,
  }),
  '/datenschutz/': defineRoute({
    title: 'Datenschutzerklärung | Abdulkerim Sesli',
    title_en: 'Privacy Policy | Abdulkerim Sesli',
    description:
      'Informationen zu Hosting, Kontaktformular, KI-Chat, Cookies und Datenverarbeitung gemäß DSGVO.',
    description_en:
      'Information about hosting, contact form, AI chat, cookies, and personal data processing under the GDPR.',
    type: 'WebPage',
    image: OG_HOME_IMAGE,
  }),
  '/cookies/': defineRoute({
    title: 'Cookie-Informationen | Abdulkerim Sesli',
    title_en: 'Cookie Information | Abdulkerim Sesli',
    description:
      'Übersicht zu Cookies, Browser-Speichern und optionalen Analysefunktionen auf der Website.',
    description_en:
      'Overview of cookies, browser storage, and optional analytics features used on the website.',
    type: 'WebPage',
    image: OG_HOME_IMAGE,
  }),
  '/impressum/': defineRoute({
    title: 'Impressum | Abdulkerim Sesli',
    title_en: 'Legal Notice | Abdulkerim Sesli',
    description:
      'Rechtliche Anbieterkennzeichnung, Kontaktangaben und medienrechtliche Hinweise.',
    description_en:
      'Legal notice with provider identification, contact details, and media-law information.',
    type: 'WebPage',
    image: OG_HOME_IMAGE,
  }),
});
