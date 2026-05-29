# Contact helpfulness ratings — design

**Date:** 2026-05-29
**Component:** `src/components/ProjectContacts.vue`

## Goal

Let users rate how helpful a project contact is, on a 5-level scale from
**Useless** to **Amazing**. Admins are excluded. A rating follows the *person*
across every project they appear in.

## Who gets rated

Every project contact **except admins**. A contact counts as an admin when its
email matches a `project_members` row with role `owner`/`admin` (already loaded
into `memberProfiles`). Admin contacts show no rating control. A contact with
neither email nor name can't be rated — nothing to key off.

## Scale

Five named levels, stored as `smallint` 1–5; unrated = no row.

| 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|
| Useless | Poor | OK | Great | Amazing |

Colours: red, orange, amber, lime, green.

## Data model — "follow the person", shared-for-admins / private-for-others

New table `public.contact_ratings`, keyed by **person** (not the per-project
contact row), so a rating shows up everywhere that person appears. Match key:
`email:<lowercased email>`, falling back to `name:<lowercased name>`.

Two scopes share the table:

- **`shared`** — one row per person, `user_id` NULL. Visible/editable only by
  project admins/owners. Last write wins.
- **`personal`** — one row per (person, user). Each non-admin keeps their own
  private rating; nobody else can see it.

What a user reads/writes depends on their role on the **current project**
(reusing `canManageProject`):

- **admin/owner** → the *shared* rating.
- **editor/viewer** → *their own* rating.

Enforced with RLS:

- personal rows: visible/editable only by their owner (`user_id = auth.uid()`).
- shared rows: visible/editable only by users who are `owner`/`admin` on some
  project. A viewer therefore cannot read the shared rating at all.

Judgment call: the shared rating is **global per person**, editable by anyone
who is an admin on any project. (Not project-scoped, because the rating follows
the person across projects.)

## UI

- **Contact detail modal** — a "Helpfulness" row: 5 colour segments
  (Useless…Amazing) + Clear; clicking sets instantly. Caption reads
  *"Your private rating"* (non-admin) or *"Shared team rating"* (admin).
- **Contact card** in the list — a small colour chip with the label when rated.
- **Edit form untouched** — ratings are separate from the shared
  `project_contacts` fields.

## Files

- `migrations/create_contact_ratings.sql` — table, partial unique indexes, RLS.
- `src/services/contactRatingsService.js` — `loadMap` / `setRating` /
  `clearRating`, tolerating the table being absent (same pattern as
  `userContactsService.js`), plus `ratingMatchKey` + `RATING_LEVELS`.
- `src/components/ProjectContacts.vue` — load ratings, modal control, card chip.

## Rollout

The service tolerates the table being missing, so the frontend is safe to ship
before the migration runs. Migration is written to a file and applied
separately (Supabase tooling or dashboard) — not auto-applied to prod. Version
bump + changelog + Login badge on push, per project convention.
