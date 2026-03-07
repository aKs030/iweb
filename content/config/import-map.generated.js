export const IMPORT_MAP_VERSIONS = Object.freeze({
  react: "19.2.4",
  "react-dom": "19.2.4",
  "lucide-react": "0.577.0",
  three: "0.183.2",
  htm: "3.1.1",
  "idb-keyval": "6.2.1",
});

export const IMPORT_MAP = Object.freeze({
  imports: Object.freeze({
    react: "https://esm.sh/react@19.2.4",
    "react-dom": "https://esm.sh/react-dom@19.2.4",
    "react-dom/client": "https://esm.sh/react-dom@19.2.4/client",
    "lucide-react": "https://esm.sh/lucide-react@0.577.0",
    three:
      "https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.min.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/",
    htm: "https://esm.sh/htm@3.1.1",
    "idb-keyval": "https://esm.sh/idb-keyval@6.2.1",
    "#core/": "/content/core/",
    "#components/": "/content/components/",
    "#config/": "/content/config/",
    "#pages/": "/pages/",
  }),
  scopes: Object.freeze({
    "https://esm.sh/": Object.freeze({
      react: "https://esm.sh/react@19.2.4",
    }),
  }),
});

export const SEARCH_PRELOAD_IMPORT_KEYS = Object.freeze([
  "htm",
  "react-dom",
  "react-dom/client",
]);

export const SEARCH_PRELOAD_URLS = Object.freeze(
  SEARCH_PRELOAD_IMPORT_KEYS.map((key) => IMPORT_MAP.imports[key]).filter(
    Boolean,
  ),
);
