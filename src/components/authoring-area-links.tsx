"use client";

import { AdminLink } from "./admin-link";

/** Legacy cross-links removed from primary curriculum UI; kept for hidden routes if needed. */
export function AuthoringAreaLinks({
  current,
}: {
  current?: "curriculum" | "content-library" | "composition";
}) {
  if (!current || current === "curriculum") return null;
  return (
    <nav className="authoring-area-links" aria-label="Related authoring areas">
      <AdminLink className="button button--secondary" href="/curriculum">Open Curriculum</AdminLink>
    </nav>
  );
}
