(() => {
  const detail = document.querySelector("[data-news-detail]");
  if (!detail) return;

  const status = detail.querySelector("[data-news-detail-status]");
  const headerElement = detail.querySelector("[data-news-detail-header]");
  const dateElement = detail.querySelector("[data-news-detail-date]");
  const titleElement = detail.querySelector("[data-news-detail-title]");
  const contentElement = detail.querySelector("[data-news-detail-content]");
  const articleId = new URLSearchParams(window.location.search).get("id");

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  };

  const sanitizeHtml = (html) => {
    const parser = new DOMParser();
    const documentFragment = parser.parseFromString(html || "", "text/html");
    const allowedTags = new Set([
      "P", "BR", "H2", "H3", "H4", "UL", "OL", "LI", "STRONG", "EM",
      "B", "I", "U", "S", "BLOCKQUOTE", "A", "IMG", "FIGURE", "FIGCAPTION",
      "HR", "PRE", "CODE", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD",
    ]);

    const removedTags = new Set([
      "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON",
    ]);

    Array.from(documentFragment.body.querySelectorAll("*")).forEach((element) => {
      if (removedTags.has(element.tagName)) {
        element.remove();
        return;
      }

      if (!allowedTags.has(element.tagName)) {
        element.replaceWith(...element.childNodes);
        return;
      }

      const allowedAttributes = {
        A: new Set(["href", "target"]),
        IMG: new Set(["src", "alt", "width", "height"]),
        TH: new Set(["colspan", "rowspan"]),
        TD: new Set(["colspan", "rowspan"]),
      };

      Array.from(element.attributes).forEach((attribute) => {
        if (!allowedAttributes[element.tagName]?.has(attribute.name)) {
          element.removeAttribute(attribute.name);
        }
      });

      if (element.tagName === "A") {
        const href = element.getAttribute("href") || "";
        if (!/^(https?:|mailto:|tel:|\/|#)/i.test(href)) {
          element.removeAttribute("href");
        }
        if (element.getAttribute("target") === "_blank") {
          element.setAttribute("rel", "noopener noreferrer");
        } else {
          element.removeAttribute("target");
        }
      }

      if (element.tagName === "IMG") {
        const src = element.getAttribute("src") || "";
        if (!/^https?:\/\//i.test(src)) element.remove();
        else element.setAttribute("loading", "lazy");
      }
    });

    return documentFragment.body;
  };

  const showError = (message) => {
    detail.classList.add("news-detail-loading");
    status.textContent = message;
    status.classList.add("is-error");
    status.hidden = false;
  };

  const loadDetail = async () => {
    if (!articleId) {
      showError("お知らせが指定されていません。");
      return;
    }

    try {
      const response = await fetch(`/api/news?id=${encodeURIComponent(articleId)}`, {
        headers: { Accept: "application/json" },
      });

      if (response.status === 404) {
        showError("お知らせが見つかりませんでした。");
        return;
      }
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);

      const item = await response.json();
      dateElement.dateTime = item.publishedAt || "";
      dateElement.textContent = formatDate(item.publishedAt);
      titleElement.textContent = item.title || "無題のお知らせ";

      const safeContent = sanitizeHtml(item.content);
      contentElement.replaceChildren(...safeContent.childNodes);
      status.hidden = true;
      headerElement.hidden = false;
      dateElement.hidden = false;
      titleElement.hidden = false;
      contentElement.hidden = false;
      detail.classList.remove("news-detail-loading");
      document.title = `${item.title || "お知らせ"} | 海の見えるCafé T`;
    } catch (error) {
      console.error("Failed to load news detail:", error);
      showError(
        "お知らせを読み込めませんでした。時間をおいて再度お試しください。"
      );
    }
  };

  loadDetail();
})();
