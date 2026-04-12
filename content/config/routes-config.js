import {
  OG_HOME_IMAGE_URL,
  OG_PROJECTS_IMAGE_URL,
  OG_VIDEOS_IMAGE_URL,
} from './constants.js';
import {
  SITE_DEFAULT_APP_TITLE,
  SITE_DEFAULT_ROBOTS,
  SITE_HOME_DESCRIPTION,
  SITE_HOME_DESCRIPTION_EN,
  SITE_HOME_KEYWORDS,
  SITE_HOME_OG_DESCRIPTION,
  SITE_HOME_TITLE,
  SITE_HOME_TITLE_EN,
} from './site-seo.js';

const OG_HOME_IMAGE = OG_HOME_IMAGE_URL;
const OG_PROJECTS_IMAGE = OG_PROJECTS_IMAGE_URL;
const OG_VIDEOS_IMAGE = OG_VIDEOS_IMAGE_URL;

const defineRoute = (route) => Object.freeze(route);

export const ROUTES = Object.freeze({
  default: defineRoute({
    title: SITE_HOME_TITLE,
    description: SITE_HOME_DESCRIPTION,
    title_en: SITE_HOME_TITLE_EN,
    description_en: SITE_HOME_DESCRIPTION_EN,
    type: 'ProfilePage',
    appTitle: SITE_DEFAULT_APP_TITLE,
    ogDescription: SITE_HOME_OG_DESCRIPTION,
    twitterDescription: SITE_HOME_OG_DESCRIPTION,
    keywords: SITE_HOME_KEYWORDS,
    robots: SITE_DEFAULT_ROBOTS,
    image: OG_HOME_IMAGE,
    imageWebp: OG_HOME_IMAGE,
  }),
  '/projekte/': defineRoute({
    title: 'Referenzen & Code-Projekte | Abdulkerim Sesli',
    description:
      'Entdecke interaktive Web-Experimente und Business-Anwendungen. Spezialisiert auf performante React-Lösungen, 3D-Web (Three.js) und modernes UI/UX Design.',
    title_en: 'References & Code Projects | Abdulkerim Sesli',
    description_en:
      'Discover interactive web experiments and business applications. Specialized in performant React solutions, 3D web experiences, and modern UI/UX design.',
    type: 'CollectionPage',
    appTitle: 'Projekte — Abdulkerim Sesli',
    image: OG_PROJECTS_IMAGE,
  }),
  '/blog/': defineRoute({
    title: 'Blog — Abdulkerim Sesli',
    description:
      'Blog von Abdulkerim Sesli: Tipps & Anleitungen zu Webdesign, SEO, Performance und Online-Marketing für Unternehmen und Selbstständige.',
    title_en: 'Blog | Abdulkerim Sesli',
    description_en:
      'Blog by Abdulkerim Sesli with tips and guides on web design, SEO, performance, and online marketing.',
    type: 'Blog',
    appTitle: 'Blog — Abdulkerim Sesli',
    ogDescription: 'Einblicke in Web-Performance, React und modernes UI-Design.',
    twitterDescription:
      'Tipps & Anleitungen zu Webdesign, SEO, Performance und Online-Marketing.',
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
    appTitle: 'Videos — Abdulkerim Sesli',
    image: OG_VIDEOS_IMAGE,
  }),
  '/gallery/': defineRoute({
    title: '3D Gallery | Abdulkerim Sesli',
    description:
      'Visuelle Ästhetik aus der Hauptstadt. Kuratierte Galerie mit Fokus auf Street Photography, Architektur und atmosphärische Portraits aus Berlin und Umgebung.',
    title_en: '3D Gallery | Abdulkerim Sesli',
    description_en:
      'Visual aesthetics from the capital. Curated gallery focused on street photography, architecture and atmospheric portraits from Berlin.',
    type: 'ImageGallery',
    appTitle: '3D Gallery',
    image: OG_HOME_IMAGE,
  }),
  '/about/': defineRoute({
    title: 'Über mich | Abdulkerim Sesli',
    title_en: 'About me | Abdulkerim Sesli',
    description:
      'Der Mensch hinter dem Code. Detaillierter Lebenslauf, Tech-Stack Übersicht und direkte Kontaktmöglichkeiten für Projektanfragen und Kooperationen.',
    description_en:
      'The person behind the code. Detailed profile, tech stack overview, and direct contact options for projects and collaborations.',
    type: 'AboutPage',
    appTitle: 'Über mich — Abdulkerim Sesli',
    ogType: 'profile',
    ogTitle: 'Kontakt & Profil | Abdulkerim Sesli',
    ogDescription:
      'Der Mensch hinter dem Code. Detaillierter Lebenslauf, Tech-Stack Übersicht und direkte Kontaktmöglichkeiten für Projektanfragen und Kooperationen.',
    twitterTitle: 'Kontakt & Profil | Abdulkerim Sesli',
    twitterDescription:
      'Der Mensch hinter dem Code. Detaillierter Lebenslauf und Tech-Stack Übersicht.',
    image: OG_HOME_IMAGE,
  }),
  '/abdul-sesli/': defineRoute({
    title: 'Abdul Sesli | Offizielles Profil von Abdulkerim Sesli',
    description:
      'Abdul Sesli ist die Kurzform von Abdulkerim Sesli. Hier findest du das offizielle Portfolio mit Blog, Videos, Fotogalerie und Projekten.',
    title_en: 'Abdul Sesli | Official profile of Abdulkerim Sesli',
    description_en:
      'Abdul Sesli is the short form of Abdulkerim Sesli. This page points to the official portfolio with blog, videos, gallery and projects.',
    type: 'ProfilePage',
    appTitle: 'Abdul Sesli | Abdulkerim Sesli',
    robots: 'index, follow, max-image-preview:large',
    image: OG_HOME_IMAGE,
  }),
  '/contact/': defineRoute({
    title: 'Kontakt | Abdulkerim Sesli',
    title_en: 'Contact | Abdulkerim Sesli',
    description:
      'Kontaktseite für Fragen, Feedback und persönlichen Austausch mit Abdulkerim Sesli.',
    description_en:
      'Contact page for questions, feedback, and personal exchange with Abdulkerim Sesli.',
    type: 'ContactPage',
    appTitle: 'Kontakt | Abdulkerim Sesli',
    robots: 'index, follow',
    image: OG_HOME_IMAGE,
  }),
  '/datenschutz/': defineRoute({
    title: 'Datenschutzerklärung | Abdulkerim Sesli',
    title_en: 'Privacy Policy | Abdulkerim Sesli',
    description:
      'Datenschutzerklärung für abdulkerimsesli.de mit Informationen zu Hosting, Kontaktformular, KI-Chat, Cookies und optionaler Reichweitenmessung.',
    description_en:
      'Privacy policy for abdulkerimsesli.de covering hosting, contact form, AI chat, cookies, and optional analytics.',
    type: 'WebPage',
    appTitle: 'Datenschutzerklärung',
    robots: 'noindex, follow',
    image: OG_HOME_IMAGE,
  }),
  '/cookies/': defineRoute({
    title: 'Cookie-Informationen | Abdulkerim Sesli',
    title_en: 'Cookie Information | Abdulkerim Sesli',
    description:
      'Informationen zu Cookies, Local Storage, optionalem Chat-Profilnamen und Reichweitenmessung auf abdulkerimsesli.de.',
    description_en:
      'Information about cookies, local storage, optional chat profile names, and analytics on abdulkerimsesli.de.',
    type: 'WebPage',
    appTitle: 'Cookie-Informationen',
    robots: 'noindex, follow',
    image: OG_HOME_IMAGE,
  }),
  '/impressum/': defineRoute({
    title: 'Impressum | Abdulkerim Sesli',
    title_en: 'Legal Notice | Abdulkerim Sesli',
    description:
      'Impressum mit Anbieterkennzeichnung, Kontaktangaben und medienrechtlichen Hinweisen für abdulkerimsesli.de.',
    description_en:
      'Legal notice with provider identification, contact details, and media-law information for abdulkerimsesli.de.',
    type: 'WebPage',
    appTitle: 'Impressum',
    robots: 'noindex, follow',
    image: OG_HOME_IMAGE,
  }),
  '/ai-info/': defineRoute({
    title: 'Abdulkerim Sesli - AI & Profile Hub',
    title_en: 'Abdulkerim Sesli - AI & Profile Hub',
    description:
      'AI & Profile Hub von Abdulkerim Sesli: Profil, Projekte, Technologien und AI-Indexing-Ressourcen für ein persönliches Portfolio.',
    description_en:
      'AI and profile hub for Abdulkerim Sesli with projects, technologies, and discovery resources for AI systems.',
    type: 'ProfilePage',
    appTitle: 'AI Info',
    keywords:
      'Abdulkerim Sesli, Abdul Sesli, Full-Stack Developer, Three.js, JavaScript, Cloudflare, AI Integration, Portfolio',
    image: OG_HOME_IMAGE,
  }),
});
