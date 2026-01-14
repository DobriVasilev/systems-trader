import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ToastProviderWrapper } from "@/components/providers/ToastProviderWrapper";
import { FeedbackProvider } from "@/contexts/FeedbackContext";
import { FeedbackModal } from "@/components/feedback/FeedbackModal";
import { FloatingFeedbackWidget } from "@/components/feedback/FloatingFeedbackWidget";
import { ElementInspector } from "@/components/feedback/ElementInspector";
import { ConsoleCapture } from "@/components/feedback/ConsoleCapture";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Systems Trader - Trading Pattern Validation",
  description: "Collaborative platform for validating and refining trading pattern detection algorithms",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "https://pub-5cc5403568f5455a945da44f4db19f23.r2.dev/systems_trader_logo.png", sizes: "any" },
    ],
    apple: "https://pub-5cc5403568f5455a945da44f4db19f23.r2.dev/systems_trader_logo.png",
  },
  openGraph: {
    title: "Systems Trader",
    description: "Collaborative platform for validating and refining trading pattern detection algorithms",
    images: ["https://pub-5cc5403568f5455a945da44f4db19f23.r2.dev/systems_trader_logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <FeedbackProvider>
            <ConsoleCapture />
            <ToastProviderWrapper>{children}</ToastProviderWrapper>
            <FeedbackModal />
            <FloatingFeedbackWidget />
            <ElementInspector />
          </FeedbackProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
