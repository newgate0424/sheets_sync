/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  // เพิ่มการตั้งค่าสำหรับ production
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
}

module.exports = nextConfig
