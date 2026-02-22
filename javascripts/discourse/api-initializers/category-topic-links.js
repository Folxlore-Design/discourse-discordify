import { apiInitializer } from "discourse/lib/api";
import { ajax } from "discourse/lib/ajax";
import CategoryAdminToolbar from "../components/category-admin-toolbar";

function relativeTime(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(0, mins)}m`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(diff / 86400000);
  if (days < 365) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

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
      // Use data-category-id + site.categories for accurate category lookup
      // (href parsing can resolve to a parent category slug)
      const catBadgeEl = document.querySelector(
        ".topic-category [data-category-id]"
      );
      const catId = catBadgeEl
        ? parseInt(catBadgeEl.dataset.categoryId, 10)
        : null;
      const site = api.container.lookup("service:site");
      const category = catId
        ? (site.categories || []).find((c) => c.id === catId)
        : null;

      if (!category) {
        discordifyList?.remove();
      } else {
        const parent =
          category.parentCategory ||
          (category.parent_category_id
            ? (site.categories || []).find(
                (c) => c.id === category.parent_category_id
              )
            : null);
        const catSlug = parent
          ? `${parent.slug}/${category.slug}`
          : category.slug;
        const cacheKey = `${currentTopicId}:${catId}`;

        if (discordifyList?.dataset.cacheKey !== cacheKey) {
          discordifyList?.remove();
          const snapshotUrl = window.location.pathname;

          ajax(
            `/c/${catSlug}/${catId}.json?order=created&no_subcategories=true`
          )
            .then((result) => {
              if (window.location.pathname !== snapshotUrl) return;

              const topics = (result.topic_list?.topics || [])
                .filter((t) => String(t.id) !== currentTopicId)
                .sort(
                  (a, b) => new Date(b.created_at) - new Date(a.created_at)
                );

              if (!topics.length) return;

              // Build user lookup map for avatar URLs
              const userMap = {};
              (result.users || []).forEach((u) => {
                userMap[u.id] = u;
              });

              const el = document.createElement("div");
              el.id = "discordify-category-topics";
              el.dataset.cacheKey = cacheKey;

              const grid = document.createElement("div");
              grid.className = "discordify-topic-grid";

              topics.forEach((t) => {
                const a = document.createElement("a");
                a.href = `/t/${t.slug}/${t.id}`;
                a.className = "discordify-topic-item";

                // Avatar: find last poster, fall back to first poster
                const lastPoster =
                  t.posters?.find((p) => p.extras?.includes("latest")) ||
                  t.posters?.[0];
                const user = lastPoster ? userMap[lastPoster.user_id] : null;
                if (user?.avatar_template) {
                  const creator = document.createElement("div");
                  creator.className = "--topic-creator";
                  const img = document.createElement("img");
                  img.src = user.avatar_template.replace("{size}", "48");
                  img.className = "avatar";
                  img.alt = "";
                  img.title = user.name || user.username;
                  creator.appendChild(img);
                  a.appendChild(creator);
                }

                // Main content: title + metadata
                const main = document.createElement("div");
                main.className = "discordify-topic-main";

                // Top line: title
                const topLine = document.createElement("span");
                topLine.className = "link-top-line";
                const titleEl = document.createElement("span");
                titleEl.className = "title";
                titleEl.textContent = t.title;
                topLine.appendChild(titleEl);
                main.appendChild(topLine);

                // Bottom line: reply count + activity time
                const bottomLine = document.createElement("div");
                bottomLine.className = "link-bottom-line";

                const replyCount =
                  t.reply_count ?? Math.max((t.posts_count || 1) - 1, 0);
                if (replyCount > 0) {
                  const replies = document.createElement("span");
                  replies.className = "topic-replies";
                  replies.innerHTML = `<svg class="fa d-icon d-icon-reply svg-icon svg-string" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#reply"></use></svg><span class="number">${replyCount}</span>`;
                  bottomLine.appendChild(replies);
                }

                const actDate = new Date(
                  t.bumped_at || t.last_posted_at || t.created_at
                );
                const timeWrap = document.createElement("div");
                timeWrap.className = "topic-activity__time";
                const relDate = document.createElement("span");
                relDate.className = "relative-date";
                relDate.setAttribute("data-time", String(actDate.getTime()));
                relDate.setAttribute("data-format", "tiny");
                relDate.title = actDate.toLocaleString();
                relDate.textContent = relativeTime(actDate);
                timeWrap.appendChild(relDate);
                bottomLine.appendChild(timeWrap);

                main.appendChild(bottomLine);
                a.appendChild(main);
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
