"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

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

function navigateHash(href: string, event: MouseEvent<HTMLAnchorElement>) {
  if (!isStaticPagesRouter() || !href.startsWith("/")) return;
  event.preventDefault();
  const nextHash = href === "/" ? "#/" : `#${href}`;
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
}

export function AdminLink({
  href,
  children,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
}) {
  if (isStaticPagesRouter()) {
    return (
      <a
        href={getStaticHref(href)}
        onClick={(event) => {
          navigateHash(href, event);
          onClick?.(event);
        }}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} onClick={onClick} {...props}>
      {children}
    </Link>
  );
}
