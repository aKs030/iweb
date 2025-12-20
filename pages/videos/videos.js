// Videos page loader (moved from inline to avoid HTML parsing issues)
;(async function loadLatestVideos(){
  const apiKey = window.YOUTUBE_API_KEY
  const handle = (window.YOUTUBE_CHANNEL_HANDLE || 'aks.030').replace(/^@/, '')
  if (!apiKey) return

  const log = msg => console.info('[videos] ', msg)

  try {
    if (location.protocol === 'file:') {
      log('Running from file:// — network requests may be blocked. Serve site via http://localhost for proper API requests.')
      return
    }

    // Helper to fetch JSON and surface HTTP errors
    async function fetchJson(url) {
      const safeUrl = url.replace(/([?&]key=)[^&]+/, '$1[REDACTED]')
      log(`Fetching ${safeUrl}`)
      const res = await fetch(url, {credentials: 'omit', mode: 'cors'})
      if (!res.ok) {
        let text = ''
        try { text = await res.text() } catch (e) { /* noop */ }
        const err = new Error(`Fetch failed: ${res.status} ${res.statusText} — ${text.slice(0,200)}`)
        err.status = res.status
        err.statusText = res.statusText
        err.body = text
        throw err
      }
      return await res.json()
    }

    // Resolve channelId via search
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&maxResults=1&key=${apiKey}`
    const searchJson = await fetchJson(searchUrl)
    const channelId = searchJson?.items?.[0]?.snippet?.channelId || searchJson?.items?.[0]?.id?.channelId
    if (!channelId) { log('Channel ID not found'); return }

    // Get uploads playlist
    const chUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
    const chJson = await fetchJson(chUrl)
    const uploads = chJson?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploads) { log('Uploads playlist not found'); return }

    // Get latest 2 videos
    const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploads}&maxResults=2&key=${apiKey}`
    const plJson = await fetchJson(plUrl)
    const items = plJson.items || []
    if (!items.length) { log('Keine Videos gefunden'); return }

    const grid = document.querySelector('.video-grid')
    if (!grid) return
    grid.innerHTML = ''

    items.forEach(it => {
      const vid = it.snippet.resourceId.videoId
      const title = it.snippet.title
      const desc = it.snippet.description || ''
      const thumb = it.snippet.thumbnails?.high?.url || it.snippet.thumbnails?.default?.url
      const pub = it.snippet.publishedAt ? it.snippet.publishedAt.split('T')[0] : ''

      const article = document.createElement('article')
      article.className = 'video-card'
      article.innerHTML = `
        <h2>${escapeHtml(title)} — Abdulkerim Sesli</h2>
        <div class="embed"><iframe width="560" height="315" src="https://www.youtube.com/embed/${vid}" title="${escapeHtml(title)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>
        <p class="video-desc">${escapeHtml(desc)}</p>
      `

      // Create JSON-LD script element via DOM to avoid embedding </script> inside a JS template literal
      const ld = document.createElement('script')
      ld.type = 'application/ld+json'
      ld.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: title + ' – Abdulkerim Sesli',
        description: desc,
        thumbnailUrl: thumb,
        uploadDate: pub || new Date().toISOString().split('T')[0],
        contentUrl: `https://youtu.be/${vid}`,
        embedUrl: `https://www.youtube.com/embed/${vid}`,
        publisher: { '@type': 'Person', name: 'Abdulkerim Sesli' }
      })

      grid.appendChild(article)
      article.appendChild(ld)
    })

    function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]) }

  } catch (err) {
    console.error('[videos] Fehler beim Laden der Videos', err)

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
        message += ' ' + String(err.message).slice(0,200)
      }
      el.textContent = message
      container.insertBefore(el, container.firstChild)
    } catch (e) {
      // ignore UI errors
    }
  }
})()
