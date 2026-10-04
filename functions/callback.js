export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookie = request.headers.get('Cookie') || '';
  const saved = (cookie.match(/oauth_state=([^;]+)/) || [])[1];

  let status, message;
  if (!code || !state || state !== saved) {
    status = 'error';
    message = { error: 'Invalid OAuth state' };
  } else {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const data = await res.json();
    if (data.access_token) {
      status = 'success';
      message = { token: data.access_token, provider: 'github' };
    } else {
      status = 'error';
      message = data;
    }
  }

  const payload = `authorization:github:${status}:${JSON.stringify(message)}`;
  const safe = JSON.stringify(payload).replace(/</g, '\\u003c');
  const html = `<!doctype html><script>
(function () {
  function receive(e) {
    window.opener.postMessage(${safe}, e.origin);
    window.removeEventListener('message', receive, false);
  }
  window.addEventListener('message', receive, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Set-Cookie': 'oauth_state=; Path=/; Max-Age=0',
    },
  });
}
