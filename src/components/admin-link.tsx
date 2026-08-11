"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";

function isStaticPagesRouter() {
  return (
    typeof document !== "undefined" &&
    document
      .querySelector('meta[name="learning-platform-admin-router"]')
      ?.getAttribute("content") === "hash"
  );
}

function getStaticHref(href: string) {
  if (!isStaticPagesRouter() || !href.startsWith("/")) return href;
  return href === "/" ? "#/" : `#${href}`;
}

export function AdminLink({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={getStaticHref(href)} {...props}>
      {children}
    </a>
  );
}
