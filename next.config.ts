import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal, self-contained server bundle for the Docker image.
  output: "standalone",
  // Native / driver-adapter packages that must not be bundled by the compiler.
  serverExternalPackages: ["@node-rs/argon2", "@prisma/adapter-pg"],
  // Set at build time to the git commit being deployed (see Dockerfile +
  // deploy/update-agent.sh). Lets Next.js detect when a client's JS bundle is
  // talking to a server from a different deploy (e.g. after a self-update) and
  // force a full page reload instead of a broken client-side navigation.
  deploymentId: process.env.DEPLOYMENT_ID,
};

export default nextConfig;
