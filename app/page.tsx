import Link from 'next/link';
import { Database, FileText, Activity } from 'lucide-react';

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-8 mb-6">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            ยินดีต้อนรับสู่ระบบจัดการฐานข้อมูล
          </h1>
          <p className="text-xl text-gray-600">
            จัดการและดูข้อมูล MySQL ของคุณได้อย่างง่ายดาย
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Link href="/database">
            <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-500 rounded-lg mb-4">
                <Database className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                Database Explorer
              </h2>
              <p className="text-gray-600">
                สำรวจและจัดการ Datasets และ Tables ในฐานข้อมูล MySQL ของคุณ
              </p>
            </div>
          </Link>

          <Link href="/log">
            <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-green-500">
              <div className="flex items-center justify-center w-16 h-16 bg-green-500 rounded-lg mb-4">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                System Logs
              </h2>
              <p className="text-gray-600">
                ดูและติดตามกิจกรรมและ logs ของระบบทั้งหมด
              </p>
            </div>
          </Link>
        </div>

        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-full shadow-md">
            <Activity className="w-5 h-5 text-blue-500 animate-pulse" />
            <span className="text-gray-700 font-medium">System Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}
