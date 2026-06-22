import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal, self-contained server bundle for the Docker image.
  output: "standalone",
  // Native / driver-adapter packages that must not be bundled by the compiler.
  serverExternalPackages: ["@node-rs/argon2", "@prisma/adapter-pg"],
};

export default nextConfig;
