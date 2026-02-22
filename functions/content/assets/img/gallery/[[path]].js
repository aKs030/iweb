export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  // Serve from R2 bucket
  if (env.GALLERY_BUCKET) {
    const key = url.pathname.replace(/^\/content\/assets\/img\/gallery\//, '');
    const object = await env.GALLERY_BUCKET.get(key);

    if (object) {
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      return new Response(object.body, { headers });
    }

    // In production/preview, missing gallery objects should return 404
    // instead of falling through to the SPA HTML response.
    if (!isLocal) {
      return new Response('Not Found', { status: 404 });
    }
  }

  return context.next();
}
