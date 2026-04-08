import { normalizeHttpUrl } from '#core/url-utils.js';
import { buildToolResult, createDetail } from '../tool-result.js';

const SOCIAL_PROFILE_URLS = new Map([
  ['github', 'https://github.com/aKs030'],
  ['linkedin', 'https://linkedin.com/in/abdulkerim-s'],
  ['instagram', 'https://instagram.com/abdul.codes'],
  ['youtube', 'https://youtube.com/@abdulcodes'],
  ['x', 'https://x.com/kRm_030'],
]);

function openUrl(url, newTab = true) {
  if (newTab) {
    const ref = window.open(url, '_blank', 'noopener,noreferrer');
    return !!ref;
  }
  globalThis.location.href = url;
  return true;
}

function formatCalendarDateForGoogle(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function parseReminderDate(dateValue, timeValue = '09:00') {
  const rawDate = String(dateValue || '').trim();
  if (!rawDate) return null;

  let isoDate = rawDate;
  if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(rawDate)) {
    const parts = rawDate.split('.');
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    isoDate = `${year}-${month}-${day}`;
  }

  const safeTime = String(timeValue || '09:00').trim() || '09:00';
  const parsed = new Date(`${isoDate}T${safeTime}:00`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function executeOpenExternalLink(args) {
  const normalized = normalizeHttpUrl(args?.url);
  if (!normalized) {
    return buildToolResult(
      'openExternalLink',
      args,
      false,
      'Kein gueltiger Link uebergeben.',
      {
        summary: 'Fuer den externen Link fehlt eine gueltige URL.',
        accent: 'error',
        cta: false,
      },
    );
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return buildToolResult(
      'openExternalLink',
      args,
      false,
      'Link ist ungueltig.',
      {
        summary: 'Die URL konnte nicht verarbeitet werden.',
        accent: 'error',
        cta: false,
      },
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return buildToolResult(
      'openExternalLink',
      args,
      false,
      'Nur http/https Links sind erlaubt.',
      {
        summary: 'Es sind nur sichere Web-Links erlaubt.',
        accent: 'error',
        cta: false,
      },
    );
  }

  const opened = openUrl(parsed.toString(), args?.newTab !== false);
  return opened
    ? buildToolResult(
        'openExternalLink',
        args,
        true,
        'Externer Link geoeffnet.',
        {
          summary: 'Der externe Link wurde geoeffnet.',
          details: [createDetail('Ziel', parsed.hostname)],
        },
      )
    : buildToolResult(
        'openExternalLink',
        args,
        false,
        'Link konnte nicht geoeffnet werden.',
        {
          summary: 'Der Link konnte nicht geoeffnet werden.',
          accent: 'error',
          cta: false,
        },
      );
}

export function executeOpenSocialProfile(args) {
  const platform = String(args?.platform || '')
    .toLowerCase()
    .trim();
  const url = SOCIAL_PROFILE_URLS.get(platform);
  if (!url) {
    return buildToolResult(
      'openSocialProfile',
      args,
      false,
      `Unbekannte Plattform: ${platform}`,
      {
        summary: `Fuer "${platform}" ist kein Social-Profil hinterlegt.`,
        accent: 'error',
        cta: false,
      },
    );
  }

  const opened = openUrl(url, true);
  return opened
    ? buildToolResult(
        'openSocialProfile',
        args,
        true,
        `${platform} Profil geoeffnet.`,
        {
          summary: `Das ${platform}-Profil wurde in einem neuen Tab geoeffnet.`,
          details: [createDetail('Plattform', platform)],
        },
      )
    : buildToolResult(
        'openSocialProfile',
        args,
        false,
        `${platform} Profil konnte nicht geoeffnet werden.`,
        {
          summary: `Das ${platform}-Profil konnte nicht geoeffnet werden.`,
          accent: 'error',
          cta: false,
        },
      );
}

export function executeComposeEmail(args) {
  const to = String(args?.to || '').trim();
  if (!to || !to.includes('@')) {
    return buildToolResult(
      'composeEmail',
      args,
      false,
      'Ungueltige E-Mail-Adresse.',
      {
        summary:
          'Fuer den E-Mail-Entwurf fehlt eine gueltige Empfaengeradresse.',
        accent: 'error',
        cta: false,
      },
    );
  }

  const subject = String(args?.subject || '').trim();
  const body = String(args?.body || '').trim();
  const mailto =
    `mailto:${encodeURIComponent(to)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  const opened = openUrl(mailto, false);
  return opened
    ? buildToolResult('composeEmail', args, true, 'E-Mail-Entwurf geoeffnet.', {
        summary:
          'Der E-Mail-Client wurde mit einem vorbereiteten Entwurf geoeffnet.',
        details: [
          createDetail('An', to),
          createDetail('Betreff', subject || 'Ohne Betreff'),
        ],
      })
    : buildToolResult(
        'composeEmail',
        args,
        false,
        'E-Mail-Entwurf konnte nicht geoeffnet werden.',
        {
          summary: 'Der E-Mail-Client konnte nicht geoeffnet werden.',
          accent: 'error',
          cta: false,
        },
      );
}

export function executeCreateCalendarReminder(args) {
  const title = String(args?.title || '').trim() || 'Erinnerung';
  const start = parseReminderDate(args?.date, args?.time);
  if (!start) {
    return buildToolResult(
      'createCalendarReminder',
      args,
      false,
      'Ungueltiges Datum fuer Erinnerung.',
      {
        summary:
          'Fuer die Erinnerung konnte kein gueltiges Datum gelesen werden.',
        accent: 'error',
        cta: false,
      },
    );
  }

  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const details = String(args?.details || '').trim();
  const location = String(args?.url || '').trim();
  const url =
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${encodeURIComponent(
      `${formatCalendarDateForGoogle(start)}/${formatCalendarDateForGoogle(end)}`,
    )}` +
    `&details=${encodeURIComponent(details)}` +
    `&location=${encodeURIComponent(location)}`;

  const opened = openUrl(url, true);
  return opened
    ? buildToolResult(
        'createCalendarReminder',
        args,
        true,
        'Kalender-Erinnerung geoeffnet.',
        {
          summary: 'Ein Kalenderentwurf wurde in Google Calendar geoeffnet.',
          details: [
            createDetail('Titel', title),
            createDetail('Zeit', start.toLocaleString('de-DE')),
          ],
        },
      )
    : buildToolResult(
        'createCalendarReminder',
        args,
        false,
        'Kalender konnte nicht geoeffnet werden.',
        {
          summary: 'Der Kalenderentwurf konnte nicht geoeffnet werden.',
          accent: 'error',
          cta: false,
        },
      );
}
