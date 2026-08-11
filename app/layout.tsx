import type { Metadata } from "next";
import "@learning-platform/core/tokens.css";
import "@learning-platform/core/theme.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Learning Platform Administration",
    template: "%s · Learning Platform Administration",
  },
  description:
    "Central administration portal for hubs, curriculum, people, delivery, assurance and platform operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
