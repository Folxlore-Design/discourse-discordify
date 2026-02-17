import Component from "@glimmer/component";
import { service } from "@ember/service";
import { action } from "@ember/object";
import { on } from "@ember/modifier";
import { fn, concat } from "@ember/helper";
import { eq } from "truth-helpers";
import { ajax } from "discourse/lib/ajax";
import DButton from "discourse/components/d-button";
import DMenu from "discourse/float-kit/components/d-menu";
import replaceEmoji from "discourse/helpers/replace-emoji";
import TopicNotificationsTracking from "discourse/components/topic-notifications-tracking";

export default class CategoryAdminToolbar extends Component {
  @service router;
  @service site;
  @service currentUser;

  get topic() {
    return this.args.outletArgs?.model;
  }

  get currentCategory() {
    return this.topic?.category;
  }

  get categories() {
    return this.site.categories || [];
  }

  get isAdminOrMod() {
    return this.currentUser?.admin || this.currentUser?.moderator;
  }

get settingsUrl() {
  const cat = this.currentCategory;
  if (!cat) return null;

  const parent = cat.parentCategory;
  console.log("category-admin-toolbar: category", cat.name, "parent", parent, "parent slug", parent?.slug);

  const slug = parent
    ? `${parent.slug}/${cat.slug}`
    : cat.slug;

  return `/c/${slug}/edit/general`;
}

  get notificationLevel() {
    const level = this.topic?.details?.notification_level;
    console.log("category-admin-toolbar: notification level", level);
    return level;
  }

  @action
  goToSettings() {
    console.log("category-admin-toolbar: navigating to settings", this.settingsUrl);
    window.location = this.settingsUrl;
  }

  @action
  async onNotificationChange(level) {
    console.log("category-admin-toolbar: changing notification level", level);
    await this.topic.setNotificationLevel(level);
  }

  @action
  async switchToCategory(cat, closeMenu) {
    console.log("category-admin-toolbar: switching to category", cat.slug, cat.id, cat.name);
    await closeMenu();
    try {
      const result = await ajax(`/c/${cat.slug}/${cat.id}.json?order=pinned`);
      console.log("category-admin-toolbar: ajax result", result);
      const topics = result.topic_list && result.topic_list.topics;
      if (!topics) {
        window.location = `/c/${cat.slug}/${cat.id}`;
        return;
      }
      const match = topics.find(
        (t) => t.title.toLowerCase().trim() === cat.name.toLowerCase().trim()
      );
      console.log("category-admin-toolbar: match", match);
      if (match) {
        this.router.transitionTo("topic.fromParamsNear", match.slug, match.id);
      } else {
        window.location = `/c/${cat.slug}/${cat.id}`;
      }
    } catch (err) {
      console.log("category-admin-toolbar: error", err);
      window.location = `/c/${cat.slug}/${cat.id}`;
    }
  }

  <template>
    {{#if this.currentCategory}}
      <div class="category-admin-toolbar">

        {{! Category switcher - visible to all }}
        <DMenu
          @identifier="category-switcher"
          @modalForMobile={{true}}
          @triggerClass="btn-default btn-icon category-switcher-trigger-btn"
        >
          <:trigger>
            {{#if this.currentCategory.emoji}}
              {{replaceEmoji (concat ":" this.currentCategory.emoji ":")}}
            {{else}}
              {{this.currentCategory.name}}
            {{/if}}
          </:trigger>
          <:content as |content|>
            <div class="fk-d-menu__inner-content">
              <ul class="dropdown-menu">
                {{#each this.categories as |cat|}}
                  <li class="dropdown-menu__item">
                    <button
                      class="btn no-text {{if (eq cat.id this.currentCategory.id) '-selected'}}"
                      type="button"
                      {{on "click" (fn this.switchToCategory cat content.close)}}
                    >
                      <div class="notifications-tracking-btn__icons">
                        {{#if cat.emoji}}
                          {{replaceEmoji (concat ":" cat.emoji ":")}}
                        {{/if}}
                      </div>
                      <div class="notifications-tracking-btn__texts">
                        <span class="notifications-tracking-btn__label">{{cat.name}}</span>
                      </div>
                    </button>
                  </li>
                {{/each}}
              </ul>
            </div>
          </:content>
        </DMenu>

        {{! Notification tracking - visible to all }}
        <TopicNotificationsTracking
          @topic={{this.topic}}
          @levelId={{this.notificationLevel}}
          @onChange={{this.onNotificationChange}}
          @showFullTitle={{false}}
          @showCaret={{false}}
        />

        {{! Category settings - admins and mods only }}
        {{#if this.isAdminOrMod}}
          {{#if this.settingsUrl}}
            <DButton
              @action={{this.goToSettings}}
              @icon="wrench"
              @title="Edit {{this.currentCategory.name}} category settings"
              class="category-settings-btn btn-flat"
            />
          {{/if}}
        {{/if}}

      </div>
    {{/if}}
  </template>
}
