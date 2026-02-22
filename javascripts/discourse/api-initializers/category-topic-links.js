import { apiInitializer } from "discourse/lib/api";
import { ajax } from "discourse/lib/ajax";
import CategoryAdminToolbar from "../components/category-admin-toolbar";

export default apiInitializer((api) => {
  const currentUser = api.getCurrentUser();
  console.log("category-topic-links: init, currentUser", currentUser);

  // Render toolbar for all logged-in users
  if (currentUser) {
    console.log("category-topic-links: registering toolbar outlet");
    api.renderInOutlet("topic-above-post-stream", CategoryAdminToolbar);
  }
  api.onPageChange(() => {
    // === Category topic list at bottom of topic pages ===
    const discordifyList = document.getElementById("discordify-category-topics");
    const topicUrlMatch = window.location.pathname.match(/\/t\/[^/]+\/(\d+)/);
    const currentTopicId = topicUrlMatch ? topicUrlMatch[1] : null;

    if (!currentTopicId) {
      discordifyList?.remove();
    } else {
      const catLink = document.querySelector(
        ".topic-category .badge-category__wrapper"
      );
      const catHref = catLink?.getAttribute("href");
      const catMatch = catHref?.match(/\/c\/(.+?)\/(\d+)$/);

      if (!catMatch) {
        discordifyList?.remove();
      } else {
        const catSlug = catMatch[1];
        const catId = catMatch[2];
        const cacheKey = `${currentTopicId}:${catId}`;

        if (discordifyList?.dataset.cacheKey !== cacheKey) {
          discordifyList?.remove();
          const snapshotUrl = window.location.pathname;

          ajax(`/c/${catSlug}/${catId}.json?order=created`)
            .then((result) => {
              if (window.location.pathname !== snapshotUrl) return;

              const topics = (result.topic_list?.topics || [])
                .filter((t) => String(t.id) !== currentTopicId)
                .sort(
                  (a, b) => new Date(b.created_at) - new Date(a.created_at)
                );

              if (!topics.length) return;

              const el = document.createElement("div");
              el.id = "discordify-category-topics";
              el.dataset.cacheKey = cacheKey;

              const grid = document.createElement("div");
              grid.className = "discordify-topic-grid";

              topics.forEach((t) => {
                const a = document.createElement("a");
                a.href = `/t/${t.slug}/${t.id}`;
                a.className = "discordify-topic-item";

                const title = document.createElement("span");
                title.className = "discordify-topic-title";
                title.textContent = t.title;

                const date = document.createElement("span");
                date.className = "discordify-topic-date";
                const d = new Date(t.created_at);
                date.textContent = d.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                });

                a.appendChild(title);
                a.appendChild(date);
                grid.appendChild(a);
              });

              el.appendChild(grid);

              const moreTopics = document.querySelector(
                ".more-topics__container"
              );
              if (moreTopics?.parentNode) {
                moreTopics.parentNode.insertBefore(el, moreTopics);
              } else {
                const postStream = document.querySelector("#post-stream");
                if (postStream?.parentNode) {
                  postStream.parentNode.insertBefore(
                    el,
                    postStream.nextSibling
                  );
                }
              }
            })
            .catch((err) => {
              console.log(
                "category-topic-links: failed to fetch category topics",
                err
              );
            });
        }
      }
    }

    // Topic page: add is-category-landing class when topic title matches category name
    const topicTitle = document.querySelector("#topic-title");
    if (topicTitle) {
      const fancyTitle = document.querySelector(".fancy-title")?.textContent?.trim().toLowerCase();
      const categoryName = document.querySelector(".badge-category__name")?.textContent?.trim().toLowerCase();

      console.log("category-topic-links: onPageChange titles", fancyTitle, categoryName);

      if (fancyTitle && categoryName && fancyTitle === categoryName) {
        topicTitle.classList.add("is-category-landing");
        console.log("category-topic-links: added is-category-landing class");
      } else {
        topicTitle.classList.remove("is-category-landing");
      }
    }

    // Categories list page: rename "Topics" → "Unread" and show per-user unread+new counts
    const categoryTable = document.querySelector("table.category-list");
    const mobileCategoryFooters = document.querySelectorAll("footer.category-topics-count");
    if (categoryTable || mobileCategoryFooters.length) {
      const trackingState = api.container.lookup("service:topic-tracking-state");

      // Desktop: rename column header and update counts
      if (categoryTable) {
        const topicsHeader = categoryTable.querySelector("th.topics");
        if (topicsHeader) {
          topicsHeader.textContent = "Unread";
        }
        categoryTable.querySelectorAll("tbody tr[data-category-id]").forEach((row) => {
          const catId = parseInt(row.dataset.categoryId, 10);
          if (!catId) return;
          const total =
            (trackingState?.countNew({ categoryId: catId }) || 0) +
            (trackingState?.countUnread({ categoryId: catId }) || 0);
          const valueSpan = row.querySelector("td.topics .value");
          if (valueSpan) {
            valueSpan.textContent = total;
            const titleDiv = valueSpan.closest("div[title]");
            if (titleDiv) {
              titleDiv.title = `${total} unread`;
            }
          }
        });
      }

      // Mobile: update footer counts and replace "total" label with "unread"
      mobileCategoryFooters.forEach((footer) => {
        const link = footer.querySelector(".category-stat a");
        if (!link) return;
        const idMatch = link.getAttribute("href")?.match(/\/(\d+)$/);
        if (!idMatch) return;
        const catId = parseInt(idMatch[1], 10);
        if (!catId) return;
        const total =
          (trackingState?.countNew({ categoryId: catId }) || 0) +
          (trackingState?.countUnread({ categoryId: catId }) || 0);
        const valueSpan = link.querySelector(".value");
        if (valueSpan) {
          valueSpan.textContent = total;
          for (const node of link.childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.includes("total")) {
              node.textContent = " unread";
              break;
            }
          }
        }
      });
    }
  });
  // Everyone: redirect category page to matching pinned topic
  api.modifyClass("route:discovery.category", {
    pluginId: "category-topic-links",
    afterModel(model, transition) {
      console.log("category-topic-links: afterModel fired", model);
      this._super(model, transition);

      const category = model.category;
      if (!category) return;
      const categoryName = category.name.toLowerCase().trim();
      const path = `/c/${category.slug}/${category.id}.json?order=pinned`;
      const router = this.router;

      return ajax(path)
        .then(function (result) {
          console.log("category-topic-links: ajax result", result);
          const topics = result.topic_list && result.topic_list.topics;
          if (!topics) return;
          const match = topics.find(function (topic) {
            return topic.title.toLowerCase().trim() === categoryName;
          });
          console.log("category-topic-links: match result", match);
          if (match) {
            if (
              transition.from &&
              transition.from.parent &&
              transition.from.parent.name === "topic" &&
              transition.from.parent.params.id == match.id
            ) {
              return;
            }
            const target =
              match.last_read_post_number &&
              match.last_read_post_number < match.highest_post_number
                ? match.last_read_post_number + 1
                : match.highest_post_number;
            console.log("category-topic-links: redirecting to topic", match.id, "post", target);
            router.replaceWith(`/t/${match.slug}/${match.id}/${target}`);
          }
        })
        .catch(function (err) {
          console.log("category-topic-links: ajax error", err);
        });
    },
  });
});
