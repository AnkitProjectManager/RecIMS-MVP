/** @type {import('next').NextConfig} */
const nextConfig = {
  generateEtags: false,
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
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
