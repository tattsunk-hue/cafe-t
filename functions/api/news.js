const SITE_ID = "cafe-t";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;

const sendJson = (status, body, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return sendJson(405, { message: "Method Not Allowed" }, { Allow: "GET" });
  }

  const apiKey = env.MICROCMS_API_KEY;
  const serviceDomain = env.MICROCMS_SERVICE_DOMAIN;
  const endpoint = env.MICROCMS_NEWS_ENDPOINT;

  if (!apiKey || !serviceDomain || !endpoint) {
    console.error("microCMS environment variables are not configured.");
    return sendJson(500, { message: "News service is not configured." });
  }

  if (!/^[a-zA-Z0-9-]+$/.test(serviceDomain) || !/^[a-zA-Z0-9_-]+$/.test(endpoint)) {
    console.error("microCMS environment variables contain invalid values.");
    return sendJson(500, { message: "News service is not configured." });
  }

  const requestUrl = new URL(request.url);
  const articleId = requestUrl.searchParams.get("id");
  if (articleId && !/^[a-zA-Z0-9_-]+$/.test(articleId)) {
    return sendJson(400, { message: "Invalid news ID." });
  }

  const parsedLimit = Number.parseInt(requestUrl.searchParams.get("limit") || "", 10);
  const limit = Number.isInteger(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const apiUrl = new URL(
    "https://" + serviceDomain + ".microcms.io/api/v1/" + endpoint +
      (articleId ? "/" + encodeURIComponent(articleId) : "")
  );

  if (!articleId) {
    apiUrl.searchParams.set("filters", "site[contains]" + SITE_ID + "[and]publishedAt[exists]");
    apiUrl.searchParams.set("orders", "-publishedAt");
    apiUrl.searchParams.set("limit", String(limit));
    apiUrl.searchParams.set("fields", "id,title,publishedAt");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const microCmsResponse = await fetch(apiUrl, {
      headers: {
        "X-MICROCMS-API-KEY": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!microCmsResponse.ok) {
      const status = microCmsResponse.status === 404 ? 404 : 502;
      console.error("microCMS request failed with status " + microCmsResponse.status + ".");
      return sendJson(status, {
        message: status === 404 ? "News not found." : "Failed to load news.",
      });
    }

    const data = await microCmsResponse.json();
    if (
      articleId &&
      (!Array.isArray(data.site) || !data.site.includes(SITE_ID) || !data.publishedAt)
    ) {
      return sendJson(404, { message: "News not found." });
    }

    return sendJson(200, data, {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    });
  } catch (error) {
    console.error(
      error?.name === "AbortError"
        ? "microCMS request timed out."
        : "microCMS request failed."
    );
    return sendJson(502, { message: "Failed to load news." });
  } finally {
    clearTimeout(timeoutId);
  }
}
