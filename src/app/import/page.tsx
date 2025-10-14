"use client";

import { useRouter } from 'next/navigation';
import LogForm from '../../components/LogForm';
import BubbleBackground from '../../components/BubbleBackground';

export default function ImportPage() {
  const router = useRouter();

  const handleSuccess = () => {
    // Form will stay on the same page after submission
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50 flex items-center justify-center p-4">
      <BubbleBackground />
      <div className="relative z-10 w-full">
        <LogForm status="ส่งเข้า" onSuccess={handleSuccess} />
      </div>
    </div>
  );
}