"use client";

import { AdminLink } from "./admin-link";

export function AuthoringAreaLinks({
  current,
}: {
  current?: "curriculum" | "content-library" | "composition";
}) {
  return (
    <nav className="authoring-area-links" aria-label="Related authoring areas">
      {current !== "content-library" ? (
        <AdminLink className="button button--secondary" href="/content-library">Open Content Library</AdminLink>
      ) : null}
      {current !== "composition" ? (
        <AdminLink className="button button--secondary" href="/composition">Open Composition</AdminLink>
      ) : null}
      {current !== "curriculum" ? (
        <AdminLink className="button button--secondary" href="/curriculum">Open Curriculum Authoring</AdminLink>
      ) : null}
    </nav>
  );
}
