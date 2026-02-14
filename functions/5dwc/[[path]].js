/**
 * Google Tag Manager Proxy Function
 * Handles requests to /5dwc/ and forwards them to the appropriate Google domain.
 * This works in conjunction with GTM Server-Side or custom loader configurations.
 */

export async function onRequest(context) {
  const { request, params } = context;
  const url = new URL(request.url);
  const pathSegments = params.path || [];

  // Default target is GTM
  let targetDomain = 'www.googletagmanager.com';
  let targetPath = pathSegments.join('/');

  // Map prefixes to specific Google domains
  // Based on GTM script logic:
  // /g/ -> www.google.com
  // /as/ -> www.googleadservices.com
  // /gs/ -> pagead2.googlesyndication.com
  if (pathSegments.length > 0) {
    const prefix = pathSegments[0];
    if (prefix === 'g') {
      targetDomain = 'www.google.com';
      targetPath = pathSegments.slice(1).join('/');
    } else if (prefix === 'as') {
      targetDomain = 'www.googleadservices.com';
      targetPath = pathSegments.slice(1).join('/');
    } else if (prefix === 'gs') {
      targetDomain = 'pagead2.googlesyndication.com';
      targetPath = pathSegments.slice(1).join('/');
    }
  }

  // Construct the new URL
  const targetUrl = new URL(
    `https://${targetDomain}/${targetPath}${url.search}`,
  );

  // Forward the request
  try {
    const modifiedRequest = new Request(targetUrl, request);

    // Ensure the host header matches the target
    modifiedRequest.headers.set('Host', targetDomain);

    // Forward the request
    const response = await fetch(modifiedRequest);

    // Return the response (proxying headers back)
    // We create a new response to ensure immutability/security context issues are handled
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (err) {
    console.error(
      `[GTM Proxy] Failed to forward request to ${targetUrl}:`,
      err,
    );
    return new Response('Proxy Error', { status: 502 });
  }
}
