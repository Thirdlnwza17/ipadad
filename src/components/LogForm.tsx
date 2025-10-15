"use client";

import { useState, useEffect, useRef, ChangeEvent, KeyboardEvent } from 'react';
import Image from 'next/image';
import { addLog, getTagsByDepartment, getDepartmentsFromDB } from '../dbService';

interface LogFormProps {
  status: 'ส่งเข้า' | 'ส่งออก';
  onSuccess?: () => void;
}


export default function LogForm({ status, onSuccess }: LogFormProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [ipadTag, setIpadTag] = useState('');
  const [currentDateTime, setCurrentDateTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isValidTag, setIsValidTag] = useState(false);
  const [count, setCount] = useState(0);
  const ipadTagInputRef = useRef<HTMLInputElement>(null);

  // Reset count when employeeId changes
  useEffect(() => {
    setCount(0);
  }, [employeeId]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const date = now.toLocaleDateString('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const time = now.toLocaleTimeString('th-TH');
      setCurrentDateTime(`${date} ${time}`);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const findDepartmentForTag = async (tag: string): Promise<string> => {
    try {
      const departments = await getDepartmentsFromDB();
      
      for (const dept of departments) {
        const tags = await getTagsByDepartment(dept);
        if (tags.includes(tag)) {
          return dept;
        }
      }
      return 'ไม่ระบุแผนก';
    } catch (error) {
      console.error('Error finding department for tag:', error);
      return 'ไม่ระบุแผนก';
    }
  };

 
  const checkTagValidity = async (tag: string) => {
    if (!tag) {
      setIsValidTag(false);
      return false;
    }
    
    try {
      const departments = await getDepartmentsFromDB();
      for (const dept of departments) {
        const tags = await getTagsByDepartment(dept);
        if (tags.includes(tag)) {
          setIsValidTag(true);
          return true;
        }
      }
      setIsValidTag(false);
      return false;
    } catch (error) {
      console.error('Error checking tag validity:', error);
      setIsValidTag(false);
      return false;
    }
  };

  // Handle tag input change with auto-submit for valid tags
  const handleIpadTagChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setIpadTag(value);
    
    const tag = value.trim();
    
    if (tag) {
      const isValid = await checkTagValidity(tag);
      if (isValid) {
        // Auto-submit when a complete valid tag is detected
        await processTag(tag);
      }
    } else {
      setIsValidTag(false);
      setSuccess('');
    }
  };

  const processTag = async (tag: string) => {
    if (!tag || !employeeId) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return false;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      // Check if tag is valid before proceeding
      const isValid = await checkTagValidity(tag);
      if (!isValid) {
        setError(`ไม่พบแท็ก: ${tag} ในระบบ`);
        return false;
      }
      
      const department = await findDepartmentForTag(tag);
      
      try {
        await addLog({ 
          employeeId, 
          ipadTag: tag,
          department,
          status 
        });
        
        const successMsg = status === 'ส่งเข้า' 
          ? `Ipad Tags นี้ส่งเข้าระบบแล้ว (รับคืนสำเร็จ)` 
          : `Ipad Tags นี้ส่งเข้าระบบแล้ว (ส่งคืนสำเร็จ)`;
        
        setSuccess(successMsg);
        setIpadTag(''); // Clear only the iPad tag input
        setCount(prevCount => prevCount + 1); // Increment count
        ipadTagInputRef.current?.focus(); // Focus back on the tag input
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
        
        // Trigger parent callback if exists
        if (onSuccess) onSuccess();
        return true;
      } catch (error) {
        // Handle specific error messages from addLog
        if (error instanceof Error) {
          setError(error.message);
        } else {
          console.error('Error saving log:', error);
          setError(`เกิดข้อผิดพลาดในการบันทึกแท็ก: ${tag}`);
        }
        return false;
      }
    } catch (error) {
      console.error('Error processing tag:', error);
      setError(`เกิดข้อผิดพลาดในการประมวลผลแท็ก: ${tag}`);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    const tags = ipadTag
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag !== '');
    
    if (tags.length === 0) {
      setError('กรุณากรอกแท็กไอแพดอย่างน้อย 1 รายการ');
      return;
    }
    
    for (const tag of tags) {
      await processTag(tag);
    }
  };

  const handleKeyPress = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tag = ipadTag.trim();
      if (tag) {
        await processTag(tag);
      }
    }
  };

  // Auto-submit when a tag is valid and user presses space or comma
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const tag = ipadTag.trim();
    if ((e.key === ' ' || e.key === ',') && tag && isValidTag) {
      e.preventDefault();
      processTag(tag);
    }
  };

  // Focus the input when component mounts
  useEffect(() => {
    ipadTagInputRef.current?.focus();
  }, []);

  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-xl shadow-lg p-6 md:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 relative flex-shrink-0">
            <Image 
              src="/ram-logo.jpg" 
              alt="Ram Logo" 
              fill 
              className="rounded-full object-cover border-2 border-white shadow-md"
              sizes="80px"
            />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-blue-800">{`บันทึกการ${status}`}</h1>
            <p className="text-gray-500">ระบบติดตามไอแพด</p>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">รหัสพนักงาน</label>
          <input
            type="text"
            placeholder=""
            value={employeeId}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmployeeId(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSubmitting}
            className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors disabled:opacity-70"
          />
        </div>
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-gray-700 text-sm font-bold" htmlFor="ipadTag">
              แท็กไอแพด {isValidTag && '✓'}
            </label>
            {count > 0 && (
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                จำนวน: {count}
              </span>
            )}
          </div>
          <form onSubmit={handleSubmit} className="relative">
            <input
              ref={ipadTagInputRef}
              type="text"
              placeholder=""
              value={ipadTag}
              onChange={handleIpadTagChange}
              onKeyPress={handleKeyPress}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors disabled:opacity-70 ${
                isValidTag && ipadTag.trim() 
                  ? 'border-green-500 bg-green-50' 
                  : ipadTag.trim() 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-blue-200'
              }`}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {ipadTag.trim() && (
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm font-medium ${
                isValidTag ? 'text-green-600' : 'text-red-500'
              }">
                {isValidTag ? '✓' : '✗'}
              </span>
            )}
          </form>
          <p className="mt-1 text-sm text-gray-500">
            {ipadTag.trim() && !isValidTag && 'ไม่พบแท็กนี้ในระบบ'}
            {!ipadTag.trim() && ''}
          </p>
          <div className="text-center text-lg font-semibold text-gray-600 mt-4 pt-2 border-t border-gray-200">
            {currentDateTime}
          </div>
        </div>
        
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        {success && (
          <div className="p-3 bg-green-100 text-green-700 rounded-lg text-sm">
            {success}
          </div>
        )}
      </div>
    </div>
  );
}
