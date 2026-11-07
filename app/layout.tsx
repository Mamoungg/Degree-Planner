import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "DegreeLinked", description: "Plan any degree, course by course." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,500;0,700;0,900;1,800;1,900&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
