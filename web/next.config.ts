import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The PDF route reads the CV stylesheet and the fonts at request time rather
  // than duplicating them, so both have to travel with the function.
  outputFileTracingIncludes: {
    "/api/cvs/[id]/pdf": ["src/app/cv.css", "public/fonts/**/*"],
  },
};

export default nextConfig;
