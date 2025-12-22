// Head inline helpers moved to external file to comply with CSP
// 1) gtag configuration (kept separate from gtag.js external loader)
window.dataLayer = window.dataLayer || []
function gtag() {
  dataLayer.push(arguments)
}
gtag('js', new Date())
gtag('config', 'AW-1036079663')

// 2) ensureTrigger helper: inject a footer trigger zone if missing
;(function ensureTrigger() {
  try {
    document.addEventListener(
      'DOMContentLoaded',
      function () {
        if (document.getElementById('footer-trigger-zone')) return
        const footerContainer = document.getElementById('footer-container')
        const trigger = document.createElement('div')
        trigger.id = 'footer-trigger-zone'
        trigger.className = 'footer-trigger-zone'
        trigger.setAttribute('aria-hidden', 'true')
        if (footerContainer && footerContainer.parentNode) {
          footerContainer.parentNode.insertBefore(trigger, footerContainer)
        } else {
          document.body.appendChild(trigger)
        }
      },
      {once: true}
    )
  } catch (e) {
    /* noop */
  }
})()
