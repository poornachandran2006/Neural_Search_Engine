/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Suppress hydration warnings from browser extensions
  compiler: {
    reactRemoveProperties: false,
  },
  // Suppress specific hydration warnings
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

module.exports = nextConfig;
