/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: false,
  },
  // Allow external video sources
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  // Handle simple-peer (uses Node.js APIs not available in SSR)
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle simple-peer on server side
      config.externals = config.externals || [];
      config.externals.push('simple-peer');
    }
    return config;
  },
};

export default nextConfig;
