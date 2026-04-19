import { ENV } from '../../config/env.config.js';
import { applyCspNonce } from '#core/csp-nonce.js';
import { createLogger } from '#core/logger.js';

const log = createLogger('head-analytics');

const GTM_ID = ENV.GTM_ID;
const GA4_MEASUREMENT_ID = ENV.GA4_ID;
const ADS_CONVERSION_ID = ENV.AW_ID;
const ADS_CONVERSION_LABEL = ENV.AW_LABEL;
const GTM_PLACEHOLDER = 'GTM-PLACEHOLDER';
const hasGtmId = Boolean(GTM_ID && GTM_ID !== GTM_PLACEHOLDER);
const hasGa4MeasurementId =
  typeof GA4_MEASUREMENT_ID === 'string' && GA4_MEASUREMENT_ID.startsWith('G-');

const dataLayer = (globalThis.dataLayer = globalThis.dataLayer || []);

function gtag(...args) {
  dataLayer.push(args);
}

function readCookie(name) {
  try {
    const escapedName = String(name || '').replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    );
    const match = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${escapedName}=([^;]+)`),
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function resolveConsentDecision(payloadValue, cookieName, legacyAccepted) {
  if (typeof payloadValue === 'boolean') return payloadValue;
  const cookieValue = readCookie(cookieName);
  if (cookieValue === 'accepted') return true;
  if (cookieValue === 'rejected') return false;
  return legacyAccepted;
}

function setupDataLayerProxy() {
  try {
    const originalPush = dataLayer.push.bind(dataLayer);
    dataLayer.push = (...args) => {
      try {
        args.forEach((arg) => {
          if (arg?.event === 'consentGranted') {
            try {
              const legacyAccepted =
                readCookie('cookie_consent') === 'accepted';
              const analyticsGranted = resolveConsentDecision(
                arg.analyticsGranted ?? arg.analytics,
                'cookie_analytics_consent',
                legacyAccepted,
              );
              const adsGranted = resolveConsentDecision(
                arg.adsGranted ?? arg.ads,
                'cookie_ads_consent',
                legacyAccepted,
              );
              gtag('consent', 'update', {
                ad_storage: adsGranted ? 'granted' : 'denied',
                analytics_storage: analyticsGranted ? 'granted' : 'denied',
                ad_user_data: adsGranted ? 'granted' : 'denied',
                ad_personalization: adsGranted ? 'granted' : 'denied',
              });
            } catch {
              /* ignore */
            }
          }
        });
      } catch {
        /* ignore */
      }
      return originalPush(...args);
    };
  } catch {
    /* ignore */
  }
}

function injectGA4Fallback() {
  try {
    if (!hasGa4MeasurementId) return;
    if (hasGtmId) {
      log.info(
        'GTM present — configure GA4 inside GTM instead of direct gtag load',
      );
      return;
    }

    if (
      !document.querySelector(`script[src*="gtag/js?id=${GA4_MEASUREMENT_ID}"]`)
    ) {
      const script = document.createElement('script');
      script.async = true;
      script.src =
        'https://www.googletagmanager.com/gtag/js?id=' + GA4_MEASUREMENT_ID;
      applyCspNonce(script);
      document.head.appendChild(script);
    }

    gtag('config', GA4_MEASUREMENT_ID);
  } catch (error) {
    log.warn('GA4 fallback failed', error);
  }
}

function injectGTM() {
  try {
    if (!hasGtmId) {
      log.info(
        'GTM not configured — set GTM_ID in content/config/env.config.js or window.ENV to enable',
      );
      return;
    }

    globalThis.dataLayer = globalThis.dataLayer || [];
    globalThis.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

    const firstScript = document.getElementsByTagName('script')[0];
    const gtmScript = document.createElement('script');
    gtmScript.async = true;
    gtmScript.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}&l=dataLayer`;
    applyCspNonce(gtmScript);
    firstScript.parentNode.insertBefore(gtmScript, firstScript);
  } catch (error) {
    log.warn('GTM injection failed', error);
  }
}

function ensureGTMNoScript(runWhenDomReady) {
  try {
    if (!hasGtmId) return;

    runWhenDomReady(() => {
      try {
        if (document.getElementById('gtm-noscript')) return;
        const noscript = document.createElement('noscript');
        noscript.id = 'gtm-noscript';

        const iframe = document.createElement('iframe');
        iframe.title = 'Google Tag Manager (noscript)';
        iframe.src = `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(GTM_ID)}`;
        iframe.height = '0';
        iframe.width = '0';
        iframe.style.display = 'none';
        iframe.style.visibility = 'hidden';
        noscript.appendChild(iframe);

        if (document.body?.firstChild) {
          document.body.insertBefore(noscript, document.body.firstChild);
        } else if (document.body) {
          document.body.appendChild(noscript);
        }
      } catch (error) {
        log.warn('insert noscript failed', error);
      }
    });
  } catch (error) {
    log.warn('GTM noscript setup failed', error);
  }
}

export function initAnalyticsBootstrap({ runWhenDomReady }) {
  try {
    gtag('consent', 'default', {
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  } catch {
    /* ignore */
  }

  setupDataLayerProxy();
  gtag('js', Date.now());
  dataLayer.push({
    gtm_autoconfig: true,
    ads_conversion_id: ADS_CONVERSION_ID,
    ads_conversion_label: ADS_CONVERSION_LABEL,
    ga4_measurement_id: GA4_MEASUREMENT_ID,
    gtm_id: GTM_ID,
  });

  injectGA4Fallback();
  injectGTM();
  ensureGTMNoScript(runWhenDomReady);
}

export function getAnalyticsBootstrapState() {
  return Object.freeze({
    hasGtmId,
    hasGa4MeasurementId,
  });
}
