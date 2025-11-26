/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        // Ignore backend database files and logs that mutate outside the app
        ignored: [
          '**/backend/**',
          '**/*.db',
          '**/backend-dev.log',
        ],
      };
    }

    return config;
  },
};

module.exports = nextConfig;
