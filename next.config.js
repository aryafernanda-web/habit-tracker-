/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
}

let exportedConfig

try {
  const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
    buildExcludes: [/middleware-manifest\.json$/],
    fallbacks: {
      document: '/offline',
    },
  })
  exportedConfig = withPWA(nextConfig)
} catch {
  // next-pwa not installed yet
  exportedConfig = nextConfig
}

module.exports = exportedConfig
