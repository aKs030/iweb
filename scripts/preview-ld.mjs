// Ensure Node import does not trigger DOM work in the module: define `document` as undefined
// so `loadSharedHead` short-circuits when the module is imported.
global.document = undefined;
globalThis.location = {
  origin: "https://abdulkerimsesli.de",
  pathname: "/about/",
  href: "https://abdulkerimsesli.de/about/",
};

const headModule = await import("../content/components/head/head-complete.js");
const { generateSchemaGraph } = headModule;

// Minimal fake DOM to satisfy generateSchemaGraph expectations
const doc = {
  documentElement: { dataset: { forceProdCanonical: "true" } },
  head: {
    querySelector: (sel) => {
      // Simulate dateCreated meta when requested
      if (
        /meta\[property="article:published_time"\]|meta\[name="dateCreated"\]|meta\[property="og:published_time"\]/.test(
          sel
        )
      ) {
        return {
          getAttribute: (k) =>
            k === "content" ? "2025-12-31T12:00:00Z" : null,
        };
      }
      return null;
    },
  },
  querySelector: (sel) => {
    if (sel === "main")
      return {
        cloneNode: () => ({
          innerText: "Über mich — Entwickler, Fotograf. Portfolio, Kontakt.",
        }),
        innerText: "Über mich — Entwickler, Fotograf. Portfolio, Kontakt.",
      };
    if (
      sel ===
      'time[datetime][pubdate], time[datetime][itemprop="dateCreated"], time[datetime][data-created]'
    )
      return null;
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel === "main img, .profile-photo, .avatar")
      return [
        {
          src: "https://abdulkerimsesli.de/content/assets/img/icons/icon-512.png",
        },
      ];
    if (sel === ".faq-item") return [];
    if (sel === "article") return [];
    return [];
  },
};

const pageData = {
  type: "ProfilePage",
  title: "Kontakt & Profil | Abdulkerim Sesli",
  description:
    "Der Mensch hinter dem Code. Detaillierter Lebenslauf, Tech-Stack Übersicht und direkte Kontaktmöglichkeiten für Projektanfragen und Kooperationen.",
  image: "https://abdulkerimsesli.de/content/assets/img/og/og-about.png",
};

const BASE_URL = "https://abdulkerimsesli.de";

const BRAND_DATA = {
  name: "Abdulkerim Sesli",
  alternateName: ["Abdul Sesli", "Abdul Berlin", "Abdulkerim Berlin"],
  logo: `${BASE_URL}/content/assets/img/icons/icon-512.png`,
  sameAs: [
    "https://github.com/aKs030",
    "https://linkedin.com/in/abdulkerimsesli",
  ],
  followersCount: 5400,
  likesCount: 12000,
  postsCount: 234,
};

const BUSINESS_FAQS = [];

(async () => {
  try {
    const graph = generateSchemaGraph(
      pageData,
      `${BASE_URL}/about/`,
      BASE_URL,
      BRAND_DATA,
      BUSINESS_FAQS,
      doc
    );
    const payload = { "@context": "https://schema.org", "@graph": graph };
    console.log(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error("Error generating schema graph:", err);
    process.exit(1);
  }
})();
