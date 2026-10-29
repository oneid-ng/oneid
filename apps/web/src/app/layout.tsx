import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ONEiD — One identity. More possibilities.",
  description: "Reusable, consent-based KYC for Nigeria on the Stellar network.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
