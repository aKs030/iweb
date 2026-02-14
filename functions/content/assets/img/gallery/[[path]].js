export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

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
  }

  return context.next();
}
