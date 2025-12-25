import {createLogger} from '../../utils/shared-utilities.js'

const log = createLogger('head-inline')

// Head inline helpers moved to external file to comply with CSP
// 1) gtag configuration (kept separate from gtag.js external loader)
window.dataLayer = window.dataLayer || []
function gtag() {
  dataLayer.push(arguments)
}
gtag('js', new Date())
gtag('config', 'AW-1036079663')

// 2) ensureTrigger helper: inject a footer trigger zone if missing
;(function ensureFooterAndTrigger() {
  try {
    document.addEventListener(
      'DOMContentLoaded',
      function () {
        // Ensure menu container exists in a header - create header if missing
        let menuContainer = document.getElementById('menu-container')
        if (!menuContainer) {
          let headerEl = document.querySelector('header.site-header')
          if (!headerEl) {
            headerEl = document.createElement('header')
            headerEl.className = 'site-header'
            // Insert at top of body for consistent layout
            document.body.insertBefore(headerEl, document.body.firstChild)
          }
          menuContainer = document.createElement('div')
          menuContainer.id = 'menu-container'
          menuContainer.setAttribute('data-injected-by', 'head-inline')
          headerEl.appendChild(menuContainer)
        }

        // If both footer trigger and container already present, nothing else to do
        if (document.getElementById('footer-trigger-zone') && document.getElementById('footer-container')) return

        // Ensure footer container exists so FooterLoader can attach
        let footerContainer = document.getElementById('footer-container')
        if (!footerContainer) {
          footerContainer = document.createElement('div')
          footerContainer.id = 'footer-container'
          footerContainer.setAttribute('data-footer-src', '/content/components/footer/footer')
          // Not hidden: the loaded footer will control visibility
          footerContainer.setAttribute('aria-hidden', 'false')
          document.body.appendChild(footerContainer)
        }

        // Ensure trigger exists and is placed immediately before the footer container
        if (!document.getElementById('footer-trigger-zone')) {
          const trigger = document.createElement('div')
          trigger.id = 'footer-trigger-zone'
          trigger.className = 'footer-trigger-zone'

          // Make the trigger non-interactive but detectable by IntersectionObserver
          trigger.setAttribute('aria-hidden', 'true')
          trigger.setAttribute('role', 'presentation')
          trigger.style.pointerEvents = 'none'
          trigger.style.minHeight = '2px'
          trigger.style.width = '100%'

          // Default thresholds (can be overridden per page by setting data attributes)
          // Small numbers increase sensitivity so even the smallest scroll can trigger the footer on desktop
          trigger.dataset.expandThreshold = trigger.dataset.expandThreshold || '0.005'
          trigger.dataset.collapseThreshold = trigger.dataset.collapseThreshold || '0.002'

          if (footerContainer && footerContainer.parentNode) {
            footerContainer.parentNode.insertBefore(trigger, footerContainer)
          } else {
            document.body.appendChild(trigger)
          }
        }
      },
      {once: true}
    )
  } catch (err) {
    log.warn('head-inline: ensure footer/trigger setup failed', err)
  }
})()

// --- 3) Asset helper: non-blocking injection of core CSS/JS used across pages
;(function injectCoreAssets() {
  try {
    const STYLES = [
      '/content/styles/root.css',
      '/content/styles/main.css',
      '/content/components/menu/menu.css',
      '/content/components/robot-companion/robot-companion.css',
      '/content/components/footer/footer.css'
    ]

    const SCRIPTS = [
      {src: '/content/main.js', module: true},
      {src: '/content/components/menu/menu.js', module: true},
      {src: '/content/components/robot-companion/robot-companion.js', module: true},
      {src: '/content/components/footer/footer-complete.js', module: true}
    ]

    const upsertStyle = href => {
      if (!document.head.querySelector(`link[href="${href}"]`)) {
        const l = document.createElement('link')
        l.rel = 'stylesheet'
        l.href = href
        l.setAttribute('data-injected-by', 'head-inline')
        document.head.appendChild(l)
      }
    }

    const upsertModulePreload = href => {
      if (!document.head.querySelector(`link[rel="modulepreload"][href="${href}"]`)) {
        const l = document.createElement('link')
        l.rel = 'modulepreload'
        l.href = href
        l.setAttribute('data-injected-by', 'head-inline')
        document.head.appendChild(l)
      }
    }

    const upsertScript = ({src, module}) => {
      if (!document.head.querySelector(`script[src="${src}"]`)) {
        const s = document.createElement('script')
        s.src = src
        if (module) s.type = 'module'
        else s.defer = true
        s.setAttribute('data-injected-by', 'head-inline')
        document.head.appendChild(s)
      }
    }

    const performInjection = () => {
      STYLES.forEach(upsertStyle)
      SCRIPTS.filter(s => s.preload).forEach(s => upsertModulePreload(s.src))
      SCRIPTS.forEach(upsertScript)
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', performInjection, {once: true})
    } else {
      performInjection()
    }
  } catch (err) {
    log.warn('head-inline: injectCoreAssets failed', err)
  }
})()
