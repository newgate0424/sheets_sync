/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  // เพิ่ม timeout สำหรับ API routes ที่ใช้เวลานาน
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: false,
  },
}

module.exports = nextConfig
