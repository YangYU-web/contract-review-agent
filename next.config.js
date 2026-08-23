/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages: 不使用 serverComponentsExternalPackages，让所有包都被打包
  experimental: {},
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
