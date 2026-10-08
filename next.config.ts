import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hyperledger Fabric SDK and gRPC must not be bundled by Next.js/Turbopack —
  // they contain native addons (pkcs11js for HSM) that only run server-side.
  serverExternalPackages: [
    "@hyperledger/fabric-gateway",
    "@grpc/grpc-js",
    "pkcs11js",
  ],
};

export default nextConfig;
