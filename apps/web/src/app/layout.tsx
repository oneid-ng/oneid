import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ONEiD — Reusable, Consent-Based KYC for Nigeria",
  description: "Reusable, consent-based KYC for Nigeria on the Stellar network.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>ONEiD — Reusable, Consent-Based KYC for Nigeria</title>
      </head>
      <body>{children}</body>
    </html>
  );
}
