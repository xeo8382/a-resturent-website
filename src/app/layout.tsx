import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { CustomerFrame } from "@/components/customer-frame";
import "./globals.css";
import "./customer.css";
export const metadata: Metadata = {
  title: {
    default: "Ember & Table — Made by fire. Shared with love.",
    template: "%s | Ember & Table",
  },
  description:
    "An original restaurant concept. Fire-led food, generous plates, and good company. Explore the sample menu and order for delivery or pickup.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
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
