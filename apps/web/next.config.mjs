/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Shared @erp/* packages ship prebuilt CommonJS in dist/, so Next consumes
  // them as normal dependencies (no transpilePackages needed). If a future
  // package ships raw TS instead, add it to transpilePackages here.
};

export default nextConfig;
