import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chromium ships as a binary beside its JavaScript. Bundling the package
  // rewrites the paths it uses to find that binary, and it then looks for a
  // directory the bundle never carried - which is exactly what the deployed
  // function reported. Left external, it is required at runtime and finds its
  // own files.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],

  // The PDF route reads the CV stylesheet and the fonts at request time rather
  // than duplicating them, so both have to travel with the function. The
  // chromium binary is listed for the same reason: tracing does not see a file
  // that is opened by a path built at runtime.
  outputFileTracingIncludes: {
    "/api/cvs/[id]/pdf": [
      "src/app/cv.css",
      "public/fonts/**/*",
      "node_modules/@sparticuz/chromium/bin/**/*",
    ],
  },
};

export default nextConfig;
