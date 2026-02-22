# discourse-discordify

A Discourse theme component that transforms Discourse into a Discord-like experience for small, invite-only communities.

## What it does

### Category → Topic Redirect

When a user navigates to a category page, they are automatically redirected to the pinned topic whose title matches the category name (case-insensitive). This makes categories feel like "spaces" or "channels" rather than topic lists. Navigation lands on the first unread post, or the last post if everything has been read.

### Category Switcher Toolbar

A compact toolbar is rendered above the post stream on topic pages. It contains:

- **Category switcher** — a dropdown listing all accessible categories with their emoji icons, letting users jump between spaces without going back to a list page
- **Notification level picker** — sets watching/tracking/normal/muted for the current topic (icon only, no label)
- **Settings wrench** — links to the category edit page; visible to admins and moderators only

### Channel Topic List

At the bottom of every topic page, a two-column grid replaces Discourse's default "New & Unread Topics" section. It shows all other topics from the same category, sorted by creation date (newest first). Each entry shows the topic title (truncated with ellipsis if long) and its creation date. The list is fetched live from the category API and cached per topic so navigating between posts in the same topic doesn't re-fetch. On mobile the grid collapses to a single column.

### Categories List Tweaks

On the categories list page, the "Topics" column header is relabeled "Unread" and the count is replaced with each category's actual unread + new post count for the current user.

### Category Landing Page Styling

When the current topic title matches the category name, the topic title `h1` is hidden and the category badge is promoted to take its place as a large heading. This avoids redundant display of the same name twice.

## File structure

```
discourse-discordify/
├── about.json
├── common/
│   └── common.scss                         # All styles (desktop + mobile)
└── javascripts/
    └── discourse/
        ├── api-initializers/
        │   └── category-topic-links.js     # Route override + outlet registration
        └── components/
            └── category-admin-toolbar.gjs  # Glimmer component for the toolbar
```

## Installation

This component is distributed as a `.zip` file.

1. Create the zip (the archive must contain the folder itself, not just its contents):
   ```
   cd ..
   zip -r discourse-discordify.zip discourse-discordify/
   ```
2. In Discourse admin: **Customize → Themes → Install → From your device**
3. Upload the zip, then activate the component by adding it to your active theme.

Each upload creates a new theme version number in Discourse. Console error messages reference the theme by number, so the number will change with each reinstall.

## Setup

Each category that should act as a "space" needs:

- A pinned topic whose title exactly matches the category name (case-insensitive)
- An emoji set on the category (plain string, e.g. `hammer_and_wrench` — no colons)

Categories without a matching pinned topic will load normally.

## Requirements

- Discourse (tested on current stable)
- Categories must use emoji (not uploaded icons) for the switcher to display them correctly
