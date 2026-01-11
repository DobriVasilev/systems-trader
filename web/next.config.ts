import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow external images for coin icons
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.coincap.io",
        pathname: "/assets/icons/**",
      },
      {
        protocol: "https",
        hostname: "assets.coingecko.com",
        pathname: "/coins/images/**",
      },
      {
        protocol: "https",
        hostname: "www.cryptocompare.com",
        pathname: "/media/**",
      },
    ],
  },
  // Security headers - applied to pages, not static assets
  async headers() {
    return [
      {
        // Exclude _next/static from custom headers (they need correct MIME types)
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [
          // Prevent clickjacking attacks
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Enable XSS filter in browsers
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Control referrer information
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Prevent information leakage
          { key: "X-DNS-Prefetch-Control", value: "off" },
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.upstash.io https://*.r2.dev https://*.neon.tech wss:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          // Permissions Policy
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
