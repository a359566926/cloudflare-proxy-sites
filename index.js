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

const AUTH_COOKIE_NAME = "CPS_AUTH_TOKEN"; // Cookie 名称

function checkAuth(request) {
  const validPasswords = ["lzm", "why"];
  const cookies = parseCookies(request.headers.get("Cookie"));
  const password = cookies[AUTH_COOKIE_NAME];

  // 验证用户名是否正确
  if (!validPasswords.includes(password)) {
    return unauthorizedResponse();
  }

  return null;
}

// 登录页面 HTML
function loginPage() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Set Cookie Example</title>
      <script>
        function setCookie() {
          // 获取用户输入
          const userInput = document.getElementById("password").value;
          // 设置 Cookie
          document.cookie = \`${AUTH_COOKIE_NAME}=\${encodeURIComponent(userInput)}\`;
          // 刷新页面
          window.location.reload();
        }
      </script>
    </head>
    <body>
      <h1>Restricted Access</h1>
      <form onsubmit="handleLogin(event)">
        <label for="password">Enter Password:</label>
        <input type="password" id="password" required>
        <button onclick="setCookie()">Submit</button>
      </form>
    </body>
    </html>
  `;
}

function unauthorizedResponse() {
  // 如果没有有效 Cookie，返回登录页面
  return new Response(loginPage(), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

// 解析 Cookie
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach(cookie => {
    const [name, ...value] = cookie.split("=");
    cookies[name.trim()] = value.join("=").trim();
  });

  return cookies;
}
