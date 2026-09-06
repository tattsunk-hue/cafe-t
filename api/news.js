const SITE_ID = "cafe-t";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;

const getQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

const sendJson = (response, statusCode, body) => {
  response.status(statusCode).json(body);
};

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { message: "Method Not Allowed" });
    return;
  }

  const apiKey = process.env.MICROCMS_API_KEY;
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN;
  const endpoint = process.env.MICROCMS_NEWS_ENDPOINT;

  if (!apiKey || !serviceDomain || !endpoint) {
    console.error("microCMS environment variables are not configured.");
    sendJson(response, 500, { message: "News service is not configured." });
    return;
  }

  if (!/^[a-zA-Z0-9-]+$/.test(serviceDomain) || !/^[a-zA-Z0-9_-]+$/.test(endpoint)) {
    console.error("microCMS environment variables contain invalid values.");
    sendJson(response, 500, { message: "News service is not configured." });
    return;
  }

  const articleId = getQueryValue(request.query?.id);
  if (articleId && !/^[a-zA-Z0-9_-]+$/.test(articleId)) {
    sendJson(response, 400, { message: "Invalid news ID." });
    return;
  }

  const parsedLimit = Number.parseInt(getQueryValue(request.query?.limit), 10);
  const limit = Number.isInteger(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const apiUrl = new URL(
    `https://${serviceDomain}.microcms.io/api/v1/${endpoint}${
      articleId ? `/${encodeURIComponent(articleId)}` : ""
    }`
  );

  if (!articleId) {
    apiUrl.searchParams.set(
      "filters",
      `site[equals]${SITE_ID}[and]publishedAt[exists]`
    );
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
      const statusCode = microCmsResponse.status === 404 ? 404 : 502;
      console.error(`microCMS request failed with status ${microCmsResponse.status}.`);
      sendJson(response, statusCode, {
        message: statusCode === 404 ? "News not found." : "Failed to load news.",
      });
      return;
    }

    const data = await microCmsResponse.json();

    if (articleId && (data.site !== SITE_ID || !data.publishedAt)) {
      sendJson(response, 404, { message: "News not found." });
      return;
    }

    response.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );
    sendJson(response, 200, data);
  } catch (error) {
    console.error(
      error?.name === "AbortError"
        ? "microCMS request timed out."
        : "microCMS request failed."
    );
    sendJson(response, 502, { message: "Failed to load news." });
  } finally {
    clearTimeout(timeoutId);
  }
};
