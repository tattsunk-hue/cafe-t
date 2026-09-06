(() => {
  const newsList = document.querySelector("[data-news-list]");
  if (!newsList) return;

  const status = newsList.querySelector("[data-news-status]");
  const requestedLimit = Number.parseInt(newsList.dataset.limit || "100", 10);
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 100;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  };

  const createNewsItem = (item) => {
    const article = document.createElement("article");
    article.className = "news-item";

    const link = document.createElement("a");
    link.className = "news-item-link";
    link.href = `news-detail.html?id=${encodeURIComponent(item.id)}`;

    const time = document.createElement("time");
    time.className = "news-date";
    time.dateTime = item.publishedAt || "";
    time.textContent = formatDate(item.publishedAt);

    const title = document.createElement("span");
    title.className = "news-title";
    title.textContent = item.title || "無題のお知らせ";

    const arrow = document.createElement("span");
    arrow.className = "news-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";

    link.append(time, title, arrow);
    article.append(link);
    return article;
  };

  const showMessage = (message, isError = false) => {
    const messageElement = status || document.createElement("p");
    messageElement.className = `news-status${isError ? " is-error" : ""}`;
    messageElement.textContent = message;
    newsList.replaceChildren(messageElement);
    newsList.setAttribute("aria-busy", "false");
  };

  const loadNews = async () => {
    try {
      const response = await fetch(`/api/news?limit=${limit}`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error(`Request failed: ${response.status}`);

      const data = await response.json();
      const contents = Array.isArray(data.contents) ? data.contents : [];

      if (contents.length === 0) {
        showMessage("現在、お知らせはありません。");
        return;
      }

      newsList.replaceChildren(...contents.map(createNewsItem));
      newsList.setAttribute("aria-busy", "false");
    } catch (error) {
      console.error("Failed to load news:", error);
      showMessage(
        "お知らせを読み込めませんでした。時間をおいて再度お試しください。",
        true
      );
    }
  };

  loadNews();
})();
