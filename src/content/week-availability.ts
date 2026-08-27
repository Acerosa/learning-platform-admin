import type { ContentDocument, ContentPackage } from "./types.ts";

/** Same values as `@learning-platform/content` `STATUSES`. Do not invent others. */
export const CONTENT_WEEK_STATUSES = ["planned", "available", "archived"] as const;
export type ContentWeekStatus = (typeof CONTENT_WEEK_STATUSES)[number];

/** Reminder shown after Post week / Remove week. Learners see changes only after platform publication. */
export const WEEK_VISIBILITY_PUBLISH_REMINDER =
  "Publish to Platform for learners to see this.";

export const REMOVE_WEEK_CONFIRM =
  "Learners will lose access until this week is posted again";

export function isContentWeekStatus(value: string): value is ContentWeekStatus {
  return (CONTENT_WEEK_STATUSES as readonly string[]).includes(value);
}

export function weekContentStatus(week: ContentDocument): string {
  return String(week.metadata.status || "planned");
}

export function canPostWeek(week: ContentDocument): boolean {
  return weekContentStatus(week) !== "available";
}

export function canRemoveWeek(week: ContentDocument): boolean {
  return weekContentStatus(week) === "available";
}

export function setWeekStatus(
  pkg: ContentPackage,
  weekId: string,
  status: ContentWeekStatus,
): ContentPackage {
  if (!isContentWeekStatus(status)) {
    throw new Error(`Unsupported week status: ${status}`);
  }
  let found = false;
  const weeks = pkg.weeks.map((week) => {
    if (week.id !== weekId) return week;
    found = true;
    return {
      ...week,
      metadata: {
        ...week.metadata,
        status,
      },
    };
  });
  if (!found) {
    throw new Error(`Week not found: ${weekId}`);
  }
  return { ...pkg, weeks };
}

/** Post week: mark metadata.status available. Does not delete content. */
export function postWeek(pkg: ContentPackage, weekId: string): ContentPackage {
  return setWeekStatus(pkg, weekId, "available");
}

/**
 * Remove week from learner visibility: mark metadata.status planned.
 * Never deletes the week, sessions, or activities.
 */
export function removeWeek(pkg: ContentPackage, weekId: string): ContentPackage {
  return setWeekStatus(pkg, weekId, "planned");
}
