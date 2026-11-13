import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  distDir: process.env.NODE_ENV === "development" ? (process.env.LEVELUP_DEV_DIST || ".next-dev") : ".next",
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};
export default config;
