"use client";

import { useRouter } from 'next/navigation';
import LogForm from '../../components/LogForm';
import BubbleBackground from '../../components/BubbleBackground';

export default function ExportPage() {
  const router = useRouter();

  const handleSuccess = () => {
 
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50 flex flex-col items-center justify-center p-4">
      <BubbleBackground />
      <div className="relative z-10 w-full">
        <LogForm status="ส่งออก" onSuccess={handleSuccess} />
      </div>
      <button
        onClick={() => router.push('/')}
        className="mt-6 px-8 py-3 bg-white text-gray-700 border-2 border-gray-200 rounded-lg font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
      >
        ย้อนกลับไปหน้าหลัก
      </button>
    </div>
  );
}