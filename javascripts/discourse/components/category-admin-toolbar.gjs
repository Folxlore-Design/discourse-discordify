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
    const slug = parent
      ? `${parent.slug}/${cat.slug}`
      : cat.slug;

    return `/c/${slug}/edit/general`;
  }

  get notificationLevel() {
    return this.topic?.details?.notification_level;
  }

  @action
  goToSettings() {
    window.location = this.settingsUrl;
  }

  @action
  async onNotificationChange(level) {
    await this.topic.details.updateNotifications(level);
  }

  @action
  async switchToCategory(cat, closeMenu) {
    await closeMenu();
    try {
      const result = await ajax(`/c/${cat.slug}/${cat.id}.json?order=pinned`);
      const topics = result.topic_list && result.topic_list.topics;
      if (!topics) {
        window.location = `/c/${cat.slug}/${cat.id}`;
        return;
      }
      const match = topics.find(
        (t) => t.title.toLowerCase().trim() === cat.name.toLowerCase().trim()
      );
      if (match) {
        const target =
          match.last_read_post_number &&
          match.last_read_post_number < match.highest_post_number
            ? match.last_read_post_number + 1
            : match.highest_post_number;
        this.router.transitionTo(`/t/${match.slug}/${match.id}/${target}`);
      } else {
        window.location = `/c/${cat.slug}/${cat.id}`;
      }
    } catch {
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
