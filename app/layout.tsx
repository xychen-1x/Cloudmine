import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Weathercast — Weather, with intelligence", description: "Live weather, forecast insights, and an AI weather companion." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
