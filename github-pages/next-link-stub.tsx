import type { AnchorHTMLAttributes, ReactNode } from "react";

/** GitHub Pages build stub — hash routing uses AdminLink's static branch instead. */
export default function Link({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
