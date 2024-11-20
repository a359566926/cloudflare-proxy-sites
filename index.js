addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

const proxiedDomains = [
  "www.v2ex.com",
  "cdn.v2ex.com",
  "imgur.com",
  "i.imgur.com",
];
 
const getTargetDomain = (host, rootDomain) => {
  return host.split(`.${rootDomain}`)[0]; 
}
 
const ownDomain = "serp.ing";

async function handleRequest(request) {
  const authResponse = checkAuth(request);
  if (authResponse) {
    return authResponse;
  }

  const url = new URL(request.url);
  const { host, pathname } = url;

  if (pathname === '/robots.txt') {
    const robots = `User-agent: *
Disallow: /
    `;
   return new Response(robots,{ status: 200 });
  }

  const targetDomain = getTargetDomain(host, ownDomain); 
  const origin = `https://${targetDomain}`; 
  const actualUrl = new URL(`${origin}${pathname}${url.search}${url.hash}`); 

  const modifiedRequestInit = {
    method: request.method,
    headers: request.headers,
    redirect: 'follow'
  };

  if (!['GET', 'HEAD'].includes(request.method)) {
    const requestBody = await request.clone().arrayBuffer();
    modifiedRequestInit.body = requestBody;
  }

  const modifiedRequest = new Request(actualUrl, modifiedRequestInit);

  const response = await fetch(modifiedRequest);

  let body = await response.arrayBuffer();
  const contentType = response.headers.get('content-type');

  // Check if the 'content-type' exists and matches JavaScript or any text/* types (e.g., text/html, text/xml)
  if (contentType && ( /^(application\/x-javascript|text\/)/i.test(contentType))) {
    let text = new TextDecoder('utf-8').decode(body);

    // Replace all instances of the proxy site domain with the current host domain in the text
    // text = text.replace(new RegExp( `(//|https?://)${targetDomain}`, 'g'), `$1${host}` );
    text = text.replace(new RegExp( `(//|https?://)(${proxiedDomains.join('|')})`, 'g'), `$1$2.${ownDomain}` );
    body = new TextEncoder().encode(text).buffer;
  }

  const modifiedResponse = new Response(body, response);
  modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
  return modifiedResponse; 
 
}

function checkAuth(request) {
  const validPasswords = ["lzm", "why"];
  const authHeader = request.headers.get("Authorization");

  // 检查 Authorization 是否存在
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return unauthorizedResponse();
  }

  // 提取 Base64 编码的用户名（无密码）
  const credentials = atob(authHeader.split(" ")[1]);
  const [username] = credentials.split(":");

  // 验证用户名是否正确
  if (!validPasswords.includes(username)) {
    return unauthorizedResponse();
  }

  return null;
}

function unauthorizedResponse() {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Restricted Area"',
    },
  });
}
