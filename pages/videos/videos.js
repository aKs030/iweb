import {createLogger} from '../../content/utils/shared-utilities.js'

const log = createLogger('videos')

// Share function for YouTube channel
function _shareChannel() {
  const url = 'https://www.youtube.com/@aks.030'
  const title = 'Abdulkerim Sesli - YouTube Kanal'
  if (navigator.share) {
    navigator.share({
      title: title,
      url: url
    })
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard
      .writeText(url)
      .then(() => {
        alert('Link kopiert: ' + url)
      })
      .catch(() => {
        // Fallback: open share dialog or just alert
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank')
      })
  }
}

// Videos page loader (moved from inline to avoid HTML parsing issues)
;(async function loadLatestVideos() {
  const apiKey = window.YOUTUBE_API_KEY
  const handle = (window.YOUTUBE_CHANNEL_HANDLE || 'aks.030').replace(/^@/, '')
  if (!apiKey) return

  // Use the structured logger `log` created above. Helper for warnings if needed:
  const _warn = msg => log.warn('[videos] ', msg)
  const setStatus = msg => {
    try {
      const el = document.getElementById('videos-status')
      if (el) el.textContent = msg || ''
    } catch {
      // ignore
    }
  }

  // Replace a thumbnail button with an autoplaying iframe (available globally so static thumbs work)
  function activateThumb(btn) {
    if (!btn || btn.dataset.loaded) return
    const vid = btn.dataset.videoId
    const title = btn.getAttribute('aria-label') || ''
    const wrapper = document.createElement('div')
    wrapper.className = 'embed'
    const iframe = document.createElement('iframe')
    iframe.width = '560'
    iframe.height = '315'
    iframe.src = `https://www.youtube.com/embed/${vid}?autoplay=1&rel=0`
    iframe.title = title
    iframe.setAttribute('frameborder', '0')
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture')
    iframe.setAttribute('allowfullscreen', '')
    wrapper.appendChild(iframe)
    btn.replaceWith(wrapper)
    try {
      iframe.focus()
    } catch {
      /* ignore */
    }
    btn.dataset.loaded = '1'
  }

  // Attach handlers for any static thumbnails (works even if API fetch doesn't run)
  function attachStaticThumbsStandalone() {
    try {
      document.querySelectorAll('.video-thumb').forEach(b => {
        if (b.dataset.bound) return
        b.addEventListener('click', () => activateThumb(b))
        b.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            activateThumb(b)
          }
        })
        b.dataset.bound = '1'
      })
    } catch {
      /* ignore */
    }
  }

  // Run asap so static page thumbnails are interactive even without API
  attachStaticThumbsStandalone()

  // Stable testing: if mock mode is active and no API key is present, render demo videos
  if (!apiKey && window.YOUTUBE_USE_MOCK) {
    setStatus('Lädt Demo‑Videos (Mock‑Modus)')
    const demo = [
      {
        videoId: 'dQw4w9WgXcQ',
        title: 'Demo Video 1 — Beispiel',
        desc: 'Beispielbeschreibung für Demo Video 1',
        thumb: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        pub: '2020-01-01'
      },
      {
        videoId: 'J---aiyznGQ',
        title: 'Demo Video 2 — Beispiel',
        desc: 'Beispielbeschreibung für Demo Video 2',
        thumb: 'https://i.ytimg.com/vi/J---aiyznGQ/hqdefault.jpg',
        pub: '2021-02-02'
      }
    ]

    const grid = document.querySelector('.video-grid')
    if (grid) {
      grid.innerHTML = ''
      demo.forEach(it => {
        const article = document.createElement('article')
        article.className = 'video-card'
        article.innerHTML = `
          <h2>${escapeHtml(it.title)} — Abdulkerim Sesli</h2>
          <p class="video-desc">${escapeHtml(it.desc)}</p>
        `

        const thumbBtn = document.createElement('button')
        thumbBtn.className = 'video-thumb'
        thumbBtn.setAttribute('aria-label', `Play ${it.title} — Abdulkerim`)
        thumbBtn.dataset.videoId = it.videoId
        thumbBtn.style.backgroundImage = `url('${it.thumb}')`
        thumbBtn.innerHTML =
          '<span class="play-button" aria-hidden="true"><svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><polygon points="70,55 70,145 145,100"/></svg></span>'

        const meta = document.createElement('div')
        meta.className = 'video-meta'
        meta.innerHTML = `<div class="video-info"><small class="pub-date">${it.pub}</small></div><div class="video-actions"><a href="https://youtu.be/${it.videoId}" target="_blank" rel="noopener">Auf YouTube öffnen</a></div>`

        const ld = document.createElement('script')
        ld.type = 'application/ld+json'
        ld.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          'name': it.title + ' – Abdulkerim Sesli',
          'description': it.desc,
          'thumbnailUrl': it.thumb,
          'uploadDate': it.pub || new Date().toISOString().split('T')[0],
          'contentUrl': `https://youtu.be/${it.videoId}`,
          'embedUrl': `https://www.youtube.com/embed/${it.videoId}`,
          'publisher': {'@type': 'Person', 'name': 'Abdulkerim Sesli'}
        })

        grid.appendChild(article)
        article.appendChild(thumbBtn)
        article.appendChild(meta)
        article.appendChild(ld)

        thumbBtn.addEventListener('click', () => activateThumb(thumbBtn))
        thumbBtn.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            activateThumb(thumbBtn)
          }
        })
      })
    }

    // Ensure static thumbs are bound and return early
    initStaticThumbs()
    setStatus('')
    return
  }

  try {
    if (location.protocol === 'file:') {
      log.warn('Running from file:// — network requests may be blocked. Serve site via http://localhost for proper API requests.')
      return
    }

    // Helper to fetch JSON and surface HTTP errors
    async function fetchJson(url) {
      const safeUrl = url.replace(/([?&]key=)[^&]+/, '$1[REDACTED]')
      log.warn(`Fetching ${safeUrl}`)
      const res = await fetch(url, {credentials: 'omit', mode: 'cors'})
      if (!res.ok) {
        let text = ''
        try {
          text = await res.text()
        } catch {
          /* noop */
        }
        const err = new Error(`Fetch failed: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`)
        err.status = res.status
        err.statusText = res.statusText
        err.body = text
        throw err
      }
      return await res.json()
    }

    // Resolve channelId via search
    setStatus('Videos werden geladen…')
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&maxResults=1&key=${apiKey}`
    const searchJson = await fetchJson(searchUrl)
    const channelId = searchJson?.items?.[0]?.snippet?.channelId || searchJson?.items?.[0]?.id?.channelId
    if (!channelId) {
      log.warn('Channel ID not found')
      return
    }

    // Get uploads playlist
    const chUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
    const chJson = await fetchJson(chUrl)
    const uploads = chJson?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploads) {
      log.warn('Uploads playlist not found')
      return
    }

    // Get latest 2 videos
    const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploads}&maxResults=2&key=${apiKey}`
    const plJson = await fetchJson(plUrl)
    const items = plJson.items || []
    if (!items.length) {
      log.warn('Keine Videos gefunden')
      return
    }

    const grid = document.querySelector('.video-grid')
    if (!grid) return
    grid.innerHTML = ''

    // Collect all video IDs and fetch details (duration, stats)
    const vidIds = items.map(it => it.snippet.resourceId.videoId).filter(Boolean)
    const detailsMap = {}
    try {
      if (vidIds.length) {
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${vidIds.join(',')}&key=${apiKey}`
        const videosJson = await fetchJson(videosUrl)(videosJson.items || []).forEach(v => {
          detailsMap[v.id] = v
        })
      }
    } catch (e) {
      log.warn('Could not fetch video details: ' + e.message)
    }

    items.forEach(it => {
      const vid = it.snippet.resourceId.videoId
      const title = it.snippet.title
      const desc = it.snippet.description || ''
      const thumb = it.snippet.thumbnails?.high?.url || it.snippet.thumbnails?.default?.url
      const pub = it.snippet.publishedAt ? it.snippet.publishedAt.split('T')[0] : ''

      const videoDetail = detailsMap[vid]
      const duration = videoDetail?.contentDetails?.duration // ISO 8601
      const viewCount = videoDetail?.statistics?.viewCount ? Number(videoDetail.statistics.viewCount) : undefined

      const article = document.createElement('article')
      article.className = 'video-card'
      article.innerHTML = `
        <h2>${escapeHtml(title)} — Abdulkerim Sesli</h2>
        <p class="video-desc">${escapeHtml(desc)}</p>
      `

      // Create thumbnail placeholder (click to load iframe)
      const thumbBtn = document.createElement('button')
      thumbBtn.className = 'video-thumb'
      thumbBtn.setAttribute('aria-label', `Play ${title} — Abdulkerim`)
      thumbBtn.dataset.videoId = vid
      thumbBtn.style.backgroundImage = `url('${thumb}')`
      thumbBtn.innerHTML =
        '<span class="play-button" aria-hidden="true"><svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><polygon points="70,55 70,145 145,100"/></svg></span>'

      // Meta row
      const meta = document.createElement('div')
      meta.className = 'video-meta'
      meta.innerHTML = `<div class="video-info"><small class="pub-date">${pub}</small></div><div class="video-actions"><a href="https://youtu.be/${vid}" target="_blank" rel="noopener">Auf YouTube öffnen</a></div>`

      // JSON-LD script
      const ldObj = {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        'name': title + ' – Abdulkerim Sesli',
        'description': desc,
        'thumbnailUrl': thumb,
        'uploadDate': pub || new Date().toISOString().split('T')[0],
        'contentUrl': `https://youtu.be/${vid}`,
        'embedUrl': `https://www.youtube.com/embed/${vid}`,
        'isFamilyFriendly': true,
        'publisher': {
          '@type': 'Organization',
          '@id': 'https://abdulkerimsesli.de/#organization',
          'name': 'Abdulkerim — Digital Creator Portfolio',
          'logo': {'@type': 'ImageObject', 'url': 'https://abdulkerimsesli.de/content/assets/img/icons/icon-512.png'}
        }
      }

      if (duration) ldObj.duration = duration
      if (typeof viewCount !== 'undefined') {
        ldObj.interactionStatistic = {
          '@type': 'InteractionCounter',
          'interactionType': 'http://schema.org/WatchAction',
          'userInteractionCount': viewCount
        }
      }

      const ld = document.createElement('script')
      ld.type = 'application/ld+json'
      ld.textContent = JSON.stringify(ldObj)

      grid.appendChild(article)
      article.appendChild(thumbBtn)
      article.appendChild(meta)
      article.appendChild(ld)

      // Activate thumb handlers
      thumbBtn.addEventListener('click', () => activateThumb(thumbBtn))
      thumbBtn.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activateThumb(thumbBtn)
        }
      })
    })

    // Attach handlers for static thumbnails already in the DOM
    function initStaticThumbs() {
      document.querySelectorAll('.video-thumb').forEach(b => {
        if (b.dataset.bound) return
        b.addEventListener('click', () => activateThumb(b))
        b.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            activateThumb(b)
          }
        })
        b.dataset.bound = '1'
      })
    }

    // Ensure static thumbs work even if API fetch replaced content
    initStaticThumbs()
    setStatus('')

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c])
    }
  } catch (err) {
    log.error('[videos] Fehler beim Laden der Videos', err)

    // Friendly message in page
    try {
      const container = document.querySelector('.videos-main .container') || document.body
      const el = document.createElement('aside')
      el.className = 'video-error'
      let message = 'Fehler beim Laden der Videos.'
      if (err && err.status === 403) {
        message += ' API-Zugriff verweigert (403). Prüfe deine API-Key Referrer-Einschränkungen oder teste über http://localhost:8000.'
        if (err.body && /API_KEY_HTTP_REFERRER_BLOCKED|Requests from referer/.test(err.body)) {
          message += ' Hinweis: Requests mit leerem Referer werden geblockt.'
        }
      } else if (err && err.message) {
        message += ' ' + String(err.message).slice(0, 200)
      }
      el.textContent = message
      container.insertBefore(el, container.firstChild)
      try {
        setStatus(el.textContent)
      } catch {
        /* ignore */
      }
    } catch {
      // ignore UI errors
    }
  }
})()
