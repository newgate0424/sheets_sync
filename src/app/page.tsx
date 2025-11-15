import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f7fa' }}>
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4" style={{ color: '#1f2937' }}>
            ยินดีต้อนรับสู่ระบบซิงค์ข้อมูล
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: '#6b7280' }}>
            ระบบซิงค์ข้อมูลจาก Google Sheets ไปยัง MySQL Database แบบเรียลไทม์
            รองรับข้อมูลขนาดใหญ่ถึง 10 ล้านแถว
          </p>
        </div>

        {/* Quick Start */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="bg-white rounded-xl p-8 shadow-sm">
            <h2 className="text-2xl font-semibold mb-6" style={{ color: '#1f2937' }}>
              🚀 เริ่มต้นใช้งาน
            </h2>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 text-white" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                  1
                </div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: '#1f2937' }}>ตั้งค่าชีต</h3>
                  <p className="text-sm mb-2" style={{ color: '#6b7280' }}>
                    เพิ่มการเชื่อมต่อ Google Sheets และกำหนด Schema
                  </p>
                  <Link href="/config" className="text-sm font-medium hover:underline" style={{ color: '#667eea' }}>
                    ไปที่หน้าตั้งค่า →
                  </Link>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 text-white" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                  2
                </div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: '#1f2937' }}>ซิงค์ข้อมูล</h3>
                  <p className="text-sm mb-2" style={{ color: '#6b7280' }}>
                    กดปุ่มซิงค์เพื่อดึงข้อมูลจาก Google Sheets
                  </p>
                  <Link href="/dashboard" className="text-sm font-medium hover:underline" style={{ color: '#667eea' }}>
                    ไปที่ Dashboard →
                  </Link>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 text-white" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                  3
                </div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: '#1f2937' }}>ดูข้อมูล</h3>
                  <p className="text-sm mb-2" style={{ color: '#6b7280' }}>
                    เรียกดูข้อมูลที่ซิงค์แล้วในฐานข้อมูล
                  </p>
                  <Link href="/tables" className="text-sm font-medium hover:underline" style={{ color: '#667eea' }}>
                    ไปที่หน้าดูข้อมูล →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-semibold mb-6 text-center" style={{ color: '#1f2937' }}>
            ✨ คุณสมบัติเด่น
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-start">
                <div className="text-2xl mr-3">🚀</div>
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: '#1f2937' }}>Smart Sync</h4>
                  <p className="text-sm" style={{ color: '#6b7280' }}>
                    ตรวจจับและอัปเดตเฉพาะข้อมูลที่เปลี่ยนแปลง
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-start">
                <div className="text-2xl mr-3">⚡</div>
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: '#1f2937' }}>Batch Processing</h4>
                  <p className="text-sm" style={{ color: '#6b7280' }}>
                    ประมวลผลทีละ 50,000 แถวเพื่อประสิทธิภาพสูงสุด
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-start">
                <div className="text-2xl mr-3">🔄</div>
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: '#1f2937' }}>Real-time Sync</h4>
                  <p className="text-sm" style={{ color: '#6b7280' }}>
                    รองรับการซิงค์ทุก 30 วินาทีผ่าน Cron Job
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-start">
                <div className="text-2xl mr-3">🛡️</div>
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: '#1f2937' }}>Auto Recovery</h4>
                  <p className="text-sm" style={{ color: '#6b7280' }}>
                    ระบบจัดการ Error และ Retry อัตโนมัติ
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
