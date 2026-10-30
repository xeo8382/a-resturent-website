import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { CustomerFrame } from "@/components/customer-frame";
import "./globals.css";
import "./customer.css";
export const metadata: Metadata = {
  title: {
    default: "Ember & Table — Menu, orders & reservations",
    template: "%s | Ember & Table",
  },
  description:
    "Explore Ember & Table’s menu, order for pickup or configured delivery, and check table reservations. Real business details and launch approval are pending.",
  applicationName: "Ember & Table",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Providers>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <CustomerFrame>{children}</CustomerFrame>
        </Providers>
      </body>
    </html>
  );
}
