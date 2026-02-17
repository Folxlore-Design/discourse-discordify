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
    const topicTitle = document.querySelector("#topic-title");
    if (!topicTitle) return;

    const fancyTitle = document.querySelector(".fancy-title")?.textContent?.trim().toLowerCase();
    const categoryName = document.querySelector(".badge-category__name")?.textContent?.trim().toLowerCase();

    console.log("category-topic-links: onPageChange titles", fancyTitle, categoryName);

    if (fancyTitle && categoryName && fancyTitle === categoryName) {
      topicTitle.classList.add("is-category-landing");
      console.log("category-topic-links: added is-category-landing class");
    } else {
      topicTitle.classList.remove("is-category-landing");
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
            console.log("category-topic-links: redirecting to topic", match.id);
            router.replaceWith("/t/" + match.id);
          }
        })
        .catch(function (err) {
          console.log("category-topic-links: ajax error", err);
        });
    },
  });
});
