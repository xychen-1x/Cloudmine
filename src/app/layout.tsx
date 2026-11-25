import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Weathercast — Philippine Weather",
  description: "A non-commercial, ad-free weather dashboard for cities and towns across the Philippines.",
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
