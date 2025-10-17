"use client";

import { useState, useEffect, useRef, ChangeEvent, KeyboardEvent, useCallback } from 'react';
import Image from 'next/image';
import { addLog, getTagsByDepartment, getDepartmentsFromDB } from '../dbService';

// Cache interface
interface TagCache {
  [key: string]: string; // tag -> department
}

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
  const employeeIdInputRef = useRef<HTMLInputElement>(null);
  const ipadTagInputRef = useRef<HTMLInputElement>(null);
  const tagsCache = useRef<TagCache>({});
  const lastFetchTime = useRef<number>(0);
  const lastActivityTime = useRef<number>(Date.now());
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
  const tagCheckTimer = useRef<NodeJS.Timeout | null>(null);
  const employeeIdTimer = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutes

  // Track user activity and manage inactivity timer
  useEffect(() => {
    const handleActivity = () => {
      lastActivityTime.current = Date.now();
    };

    // Set up event listeners for user activity
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Check for inactivity every 30 seconds
    const checkInactivity = () => {
      const currentTime = Date.now();
      if (employeeId && (currentTime - lastActivityTime.current) >= INACTIVITY_TIMEOUT) {
        setEmployeeId('');
        employeeIdInputRef.current?.focus();
      }
    };

    const interval = setInterval(checkInactivity, 30000); // Check every 30 seconds

    // Clean up
    return () => {
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      clearInterval(interval);
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, [employeeId]);

  // Reset count when employeeId changes
  useEffect(() => {
    setCount(0);
    lastActivityTime.current = Date.now(); // Update activity time when employeeId changes
  }, [employeeId]);

  // Update date time
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
      const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
        'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
        'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      
      const day = now.getDay();
      const date = now.getDate();
      const month = now.getMonth();
      const year = now.getFullYear();
      const time = now.toLocaleTimeString('th-TH');
      
      setCurrentDateTime(`วัน${thaiDays[day]}ที่ ${date} ${thaiMonths[month]} ${year} เวลา ${time}`);
    };

    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);
    return () => {
      clearInterval(timer);
      if (tagCheckTimer.current !== null) {
        clearTimeout(tagCheckTimer.current);
        tagCheckTimer.current = null;
      }
    };
  }, []);

  // Load and cache tags
  const loadAndCacheTags = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchTime.current < CACHE_DURATION) return;

    try {
      const departments = await getDepartmentsFromDB();
      const newCache: TagCache = {};
      
      // Process departments in parallel
      await Promise.all(
        departments.map(async (dept) => {
          const tags = await getTagsByDepartment(dept);
          tags.forEach(tag => {
            newCache[tag] = dept;
          });
        })
      );
      
      tagsCache.current = newCache;
      lastFetchTime.current = now;
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }, []);

  // Initial load of tags
  useEffect(() => {
    loadAndCacheTags();
  }, [loadAndCacheTags]);

  // Refresh cache periodically
  useEffect(() => {
    const interval = setInterval(loadAndCacheTags, CACHE_DURATION);
    return () => clearInterval(interval);
  }, [loadAndCacheTags]);

  const findDepartmentForTag = (tag: string): string => {
    return tagsCache.current[tag] || 'ไม่ระบุแผนก';
  };

  const checkTagValidity = (tag: string): boolean => {
    if (!tag) {
      setIsValidTag(false);
      return false;
    }
    
    const isValid = tag in tagsCache.current;
    setIsValidTag(isValid);
    return isValid;
  };

  // Handle tag input change with auto-submit for valid tags
  const handleIpadTagChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setIpadTag(value);
    
    // Clear any previous timers
    if (tagCheckTimer.current !== null) {
      clearTimeout(tagCheckTimer.current);
      tagCheckTimer.current = null;
    }
    
    const tag = value.trim();
    
    if (!tag) {
      setIsValidTag(false);
      setSuccess('');
      return;
    }
    
    // Debounce the validation
    tagCheckTimer.current = setTimeout(() => {
      const isValid = checkTagValidity(tag);
      if (isValid) {
        processTag(tag);
      }
    }, 300); // 300ms debounce
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
      const isValid = checkTagValidity(tag);
      if (!isValid) {
        setError(`ไม่พบแท็ก: ${tag} ในระบบ`);
        return false;
      }
      
      const department = findDepartmentForTag(tag);
      
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
        setIpadTag(''); // Clear the iPad tag input
        setCount(prevCount => prevCount + 1);
        
        // Focus back on the tag input immediately
        requestAnimationFrame(() => {
          ipadTagInputRef.current?.focus({ preventScroll: true });
          ipadTagInputRef.current?.select();
        });
        
        // Clear success message after 3 seconds
        const timer = setTimeout(() => setSuccess(''), 3000);
        
        if (onSuccess) onSuccess();
        
        return () => {
          clearTimeout(timer);
        };
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

  const handleEmployeeIdKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ipadTagInputRef.current?.focus();
    }
  };

  const handleIpadTagKeyPress = async (e: KeyboardEvent<HTMLInputElement>) => {
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

  // Focus the employee ID input when component mounts
  useEffect(() => {
    employeeIdInputRef.current?.focus();
  }, []);

  return (
    <>
    <div className="w-full max-w-xl mx-auto bg-white rounded-xl shadow-lg p-6 md:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div className="w-32 h-32 relative flex-shrink-0">
            <Image 
              src="/ram-logo.jpg" 
              alt="Ram Logo" 
              fill 
              className="object-contain"
              sizes="128px"
            />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-500 to-blue-800 text-transparent bg-clip-text">
                {`บันทึกการ${status} IPad`}
              </h1>
              <div className="relative h-15 w-15 -mt-1">
                <Image 
                  src="/Screenshot 2025-10-17 113950.png" 
                  alt="" 
                  fill
                  className="object-contain"
                  style={{ objectFit: 'contain' }}
                />
              </div>
            </div>
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
            ref={employeeIdInputRef}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmployeeId(e.target.value)}
            onKeyDown={handleEmployeeIdKeyPress}
            onKeyPress={handleEmployeeIdKeyPress}
            disabled={isSubmitting}
            className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors disabled:opacity-70"
            autoComplete="off"
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
              onKeyPress={handleIpadTagKeyPress}
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
    <div className="mt-4 text-center text-gray-500 text-sm w-full">
      @2025 | For Ram Hospital | Chitiwat Turmcher
    </div>
    </>
  );
}
