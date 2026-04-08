/** Detect if user prompt asks for an action that requires tools. */
const ACTION_PATTERNS =
  /\b(zeig|geh|navigier|oeffn|öffn|schlie(?:ss|ß)|schließ|such|find|mach|wechsel|dark|light|toggle|theme|dunkel|hell|merk|merke|erinner|scroll|oben|top|menü|menu|name ist|hei(?:ss|ß)e|ich bin |ich hei(?:ss|ß)|nenn mich|kennst du mich|wei(?:ss|ß)t du (meinen|wer ich)|bin der |bin die |empfehl|kopier|link|url|upload|bild hoch|chatverlauf|verlauf l[oö]sch|history)/i;
const MEMORY_RECALL_PATTERNS =
  /\b(kennst du mich noch|erinnerst du dich|wei(?:ss|ß)t du (meinen namen|wer ich bin)|wie hei(?:ss|ß)e ich)\b/i;
const NAME_CONTEXT_STOPWORDS = new Set([
  'aus',
  'von',
  'und',
  'aber',
  'im',
  'in',
  'mit',
  'bei',
  'als',
  'ein',
  'eine',
  'einer',
  'einem',
  'eines',
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'bin',
  'heisse',
  'heiße',
  'nenne',
  'nennen',
  'arbeite',
  'komme',
  'wohne',
  'mag',
  'liebe',
  'interessiere',
  'interessiert',
  'habe',
  'hab',
  'will',
  'moechte',
  'möchte',
]);
const NON_NAME_SINGLE_WORDS = new Set([
  'muede',
  'müde',
  'hungrig',
  'bereit',
  'hier',
  'da',
  'neu',
  'krank',
  'ok',
  'okay',
  'gut',
  'schlecht',
  'traurig',
  'verwirrt',
  'gespannt',
  'froh',
  'cool',
  'fertig',
]);
const TOOL_LEAK_INLINE_PATTERN =
  /\s+tools?\s*:\s*(?:navigate|setTheme|searchBlog|toggleMenu|scrollToSection|openSearch|closeSearch|focusSearch|scrollTop|copyCurrentUrl|openImageUpload|clearChatHistory|rememberUser|recallMemory|recommend)\b[^\n]*/gi;
const TOOL_LEAK_LINE_PATTERN = /(?:^|\n)\s*tools?\s*:[^\n]*(?=\n|$)/gi;

export function promptNeedsTools(prompt) {
  return ACTION_PATTERNS.test(prompt);
}

export function promptNeedsMemoryRecall(prompt) {
  return MEMORY_RECALL_PATTERNS.test(String(prompt || ''));
}

function normalizeExtractedValue(value, maxLength = 120) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.,;:!?]+$/g, '')
    .slice(0, maxLength);
}

function isLikelyNameToken(token) {
  return /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’-]{0,29}$/.test(token);
}

function normalizeNameCandidate(candidate) {
  const cleaned = normalizeExtractedValue(candidate, 60);
  if (!cleaned) return '';

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (!tokens.length) return '';

  const selected = [];
  for (const rawToken of tokens) {
    const token = rawToken.replace(/^['’`]+|['’`]+$/g, '');
    const lower = token.toLowerCase();

    if (!token) continue;
    if (selected.length === 0 && NAME_CONTEXT_STOPWORDS.has(lower)) continue;
    if (selected.length > 0 && NAME_CONTEXT_STOPWORDS.has(lower)) break;
    if (!isLikelyNameToken(token)) break;

    selected.push(token);
    if (selected.length >= 3) break;
  }

  if (!selected.length) return '';
  if (
    selected.length === 1 &&
    NON_NAME_SINGLE_WORDS.has(selected[0].toLowerCase())
  ) {
    return '';
  }

  const name = selected.join(' ').trim();
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’ -]{1,39}$/.test(name)) {
    return '';
  }
  return name;
}

function extractNameFromPrompt(promptText) {
  const text = String(promptText || '');
  if (!text.trim()) return '';

  const patterns = [
    /(?:\bich\s+hei(?:ss|ß)e\b|\bmein\s+name\s+ist\b|\bnenn\s+mich\b|\bdu\s+kannst\s+mich\b)\s+([^\n.,;:!?]{2,60})/i,
    /(?:\bich\s+bin\b|\bich\s+bin's\b|\bich\s+bins\b)\s+([^\n.,;:!?]{2,60})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const name = normalizeNameCandidate(match[1]);
    if (name) return name;
  }

  return '';
}

export function sanitizeAssistantText(rawText) {
  const input = String(rawText || '');
  if (!input) return '';

  return input
    .replace(TOOL_LEAK_INLINE_PATTERN, '')
    .replace(TOOL_LEAK_LINE_PATTERN, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractPromptMemoryFacts(prompt) {
  const text = String(prompt || '');
  if (!text.trim()) return [];

  const extracted = [];

  const extractedName = extractNameFromPrompt(text);
  if (extractedName) {
    extracted.push({ key: 'name', value: extractedName });
  }

  const interestMatch = text.match(
    /(?:\bich\s+(?:mag|liebe|interessiere mich(?: sehr)? (?:fuer|für)|arbeite(?:\s+gern)?\s+mit)\b)\s+([^\n.!?]{3,120})/i,
  );
  if (interestMatch?.[1]) {
    const cleanedInterest = normalizeExtractedValue(interestMatch[1], 120);
    if (cleanedInterest.length >= 3) {
      extracted.push({ key: 'interest', value: cleanedInterest });
    }
  }

  const preferenceMatch = text.match(
    /(?:\bich\s+(?:bevorzuge|nutze am liebsten)\b|\bbitte immer\b)\s+([^\n.!?]{3,120})/i,
  );
  if (preferenceMatch?.[1]) {
    const cleanedPreference = normalizeExtractedValue(preferenceMatch[1], 120);
    if (cleanedPreference.length >= 3) {
      extracted.push({ key: 'preference', value: cleanedPreference });
    }
  }

  const unique = [];
  const seen = new Set();
  for (const item of extracted) {
    const hash = `${item.key}:${item.value.toLowerCase()}`;
    if (seen.has(hash)) continue;
    seen.add(hash);
    unique.push(item);
  }

  return unique;
}

export function inferClientToolCallsFromPrompt(prompt) {
  const text = String(prompt || '').toLowerCase();
  if (!text.trim()) return [];

  const inferred = [];
  const addTool = (name, args = {}) => {
    if (inferred.some((item) => item.name === name)) return;
    inferred.push({ name, arguments: args });
  };

  if (
    /(chatverlauf|verlauf|history).*(lösch|loesch|clear|zurueck)|(\blösch|\bloesch).*(chatverlauf|verlauf|history)/i.test(
      text,
    )
  ) {
    addTool('clearChatHistory');
  }

  if (/(kopier|copy).*(link|url)|(link|url).*(kopier|copy)/i.test(text)) {
    addTool('copyCurrentUrl');
  }

  if (
    /(scroll|geh).*(nach oben|ganz nach oben|top)|\bscroll top\b|seite nach oben/i.test(
      text,
    )
  ) {
    addTool('scrollTop');
  }

  if (
    /(öffn|oeffn|aufmachen|mach auf).*(menü|menu)|(menü|menu).*(öffn|oeffn|aufmachen|mach auf)/i.test(
      text,
    )
  ) {
    addTool('toggleMenu', { state: 'open' });
  } else if (
    /(schließ|schliess|schließe|schliesse|zu machen|zumachen).*(menü|menu)|(menü|menu).*(schließ|schliess|schließe|schliesse|zu machen|zumachen)/i.test(
      text,
    )
  ) {
    addTool('toggleMenu', { state: 'close' });
  }

  if (
    /(öffn|oeffn|zeige).*(suche|search)|(suche|search).*(öffn|oeffn|auf)/i.test(
      text,
    )
  ) {
    addTool('openSearch');
  }

  const searchMatch = text.match(
    /(?:such(?:e)?|finde?)\s+(?:nach\s+)?(.{2,120})$/i,
  );
  if (searchMatch?.[1]) {
    addTool('focusSearch', { query: normalizeExtractedValue(searchMatch[1]) });
  }

  if (/(dunkel|dark mode|dark theme|\bdark\b)/i.test(text)) {
    addTool('setTheme', { theme: 'dark' });
  } else if (/(hell|light mode|light theme|\blight\b)/i.test(text)) {
    addTool('setTheme', { theme: 'light' });
  } else if (/(toggle theme|theme wechseln|farbmodus wechseln)/i.test(text)) {
    addTool('setTheme', { theme: 'toggle' });
  }

  if (/(bild hoch|image upload|foto hochladen|upload bild)/i.test(text)) {
    addTool('openImageUpload');
  }

  const sectionMatch = text.match(
    /(header|footer|kontakt|contact|hero|projects|projekte|skills)/i,
  );
  if (/(scroll|geh|spring)/i.test(text) && sectionMatch?.[1]) {
    const section = sectionMatch[1].toLowerCase();
    addTool('scrollToSection', {
      section:
        section === 'kontakt'
          ? 'contact'
          : section === 'projekte'
            ? 'projects'
            : section,
    });
  }

  if (/(geh|navigier|zeige|öffn|oeffn).*(about|über|profil)/i.test(text)) {
    addTool('navigate', { page: 'about' });
  } else if (
    /(geh|navigier|zeige|öffn|oeffn).*(projekt|projekte|apps)/i.test(text)
  ) {
    addTool('navigate', { page: 'projekte' });
  } else if (/(geh|navigier|zeige|öffn|oeffn).*(gallery|galerie)/i.test(text)) {
    addTool('navigate', { page: 'gallery' });
  } else if (/(geh|navigier|zeige|öffn|oeffn).*(blog|journal)/i.test(text)) {
    addTool('navigate', { page: 'blog' });
  } else if (/(geh|navigier|zeige|öffn|oeffn).*(videos)\b/i.test(text)) {
    addTool('navigate', { page: 'videos' });
  } else if (
    /(geh|navigier|zeige|öffn|oeffn).*(kontakt|contact|footer)\b/i.test(text)
  ) {
    addTool('navigate', { page: 'kontakt' });
  } else if (/(geh|navigier|zeige|öffn|oeffn).*(start|home)\b/i.test(text)) {
    addTool('navigate', { page: 'home' });
  }

  return inferred;
}
