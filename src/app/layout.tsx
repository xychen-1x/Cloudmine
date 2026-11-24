import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Weathercast", description: "A Philippines-first weather companion. Phase 1 foundation." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
