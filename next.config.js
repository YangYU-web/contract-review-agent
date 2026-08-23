/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth'],
  },
  allowedDevOrigins: [
    '*.traecontent.cn',
    '*.agent-sandbox-bj-c1-gw.traecontent.cn',
    '*.agent-sandbox-bj-a1-gw.traecontent.cn',
    'localhost:3000',
    'localhost:3001',
    '127.0.0.1:3000',
    '127.0.0.1:3001',
  ],
};

module.exports = nextConfig;
