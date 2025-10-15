"use client";

import { useState, useEffect, ChangeEvent, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, ArrowRight, ArrowLeft, Trash2, Plus, X, Download } from 'lucide-react';
import Image from 'next/image';
import BubbleBackground from '../components/BubbleBackground';
import { getLogs, Log, getDepartmentsFromDB, deleteLogs, getTagsByDepartment } from '../dbService';
import { VercelDateRangePicker } from '../components/VercelDateRangePicker';
import { isWithinInterval, parseISO } from 'date-fns';

interface SelectedLogs {
  [key: string]: boolean;
}

type DateRange = {
  startDate: string;
  endDate: string;
};

type SortOrder = 'asc' | 'desc';


export default function IPadTrackingSystem() {
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: '', endDate: '' });
  const [filterEmployee, setFilterEmployee] = useState<string>('');
  const [filterDept, setFilterDept] = useState<string>('ทั้งหมด');
  const [filterStatus, setFilterStatus] = useState<string>('ทั้งหมด');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [departments, setDepartments] = useState<string[]>(['ทั้งหมด']);
  const [showDeptSummary, setShowDeptSummary] = useState(false);
  const [selectedLogs, setSelectedLogs] = useState<SelectedLogs>({});
  const [selectedDeptLogs, setSelectedDeptLogs] = useState<SelectedLogs>({});
  const [selectAll, setSelectAll] = useState(false);
  const [selectAllDept, setSelectAllDept] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');
  const [newTags, setNewTags] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const itemsPerPage = 20;

  // Handle form submission for adding new department and tags
  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepartment.trim()) return;

    // Add new department if it doesn't exist
    if (!departments.includes(newDepartment)) {
      setDepartments(prev => [...prev, newDepartment]);
    }

    if (newTags) {
      const tagsToAdd = newTags.split(',').map(tag => tag.trim()).filter(Boolean);
      const uniqueNewTags = tagsToAdd.filter(tag => !tags.includes(tag));
      if (uniqueNewTags.length > 0) {
        setTags(prev => [...prev, ...uniqueNewTags]);
      }
    }

    // Reset form
    setNewDepartment('');
    setNewTags('');
    setShowAddForm(false);
  };

  // Toggle add form visibility
  const toggleAddForm = () => {
    setShowAddForm(!showAddForm);
    if (!showAddForm) {
      setNewDepartment('');
      setNewTags('');
    }
  };

  // Handle tag removal
  const removeTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  // Reset selections when logs change
  useEffect(() => {
    setSelectedLogs({});
    setSelectAll(false);
  }, [logs]);

  // Handle individual log selection
  const handleLogSelect = (logId: string) => {
    setSelectedLogs(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  // Handle select all logs on current page
  const handleSelectAllLogs = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    
    const newSelectedLogs: SelectedLogs = {};
    if (newSelectAll) {
      currentLogs.forEach(log => {
        newSelectedLogs[log.id] = true;
      });
    }
    setSelectedLogs(newSelectedLogs);
  };

  // Handle department log selection
  const handleDeptLogSelect = (dept: string) => {
    setSelectedDeptLogs(prev => ({
      ...prev,
      [dept]: !prev[dept]
    }));
  };

  // Handle select all department logs
  const handleSelectAllDeptLogs = () => {
    const newSelectAll = !selectAllDept;
    setSelectAllDept(newSelectAll);
    
    const newSelectedDeptLogs: SelectedLogs = {};
    if (newSelectAll) {
      departmentSummary.forEach(dept => {
        newSelectedDeptLogs[dept.department] = true;
      });
    }
    setSelectedDeptLogs(newSelectedDeptLogs);
  };

  // Handle delete selected logs
  const handleDeleteSelectedLogs = () => {
    const selectedIds = Object.entries(selectedLogs)
      .filter(([_, isSelected]) => isSelected)
      .map(([id]) => id);

    if (selectedIds.length > 0 && window.confirm(`คุณแน่ใจหรือไม่ที่จะลบ ${selectedIds.length} รายการที่เลือก?`)) {
      deleteLogs(selectedIds);
      setLogs(prevLogs => prevLogs.filter(log => !selectedIds.includes(log.id.toString())));
      setSelectedLogs({});
      setSelectAll(false);
    }
  };

  // Handle delete selected department logs
  const handleDeleteSelectedDeptLogs = () => {
    const selectedDepts = Object.entries(selectedDeptLogs)
      .filter(([_, isSelected]) => isSelected)
      .map(([dept]) => dept);

    if (selectedDepts.length > 0) {
      const selectedIds = logs
        .filter(log => selectedDepts.includes(log.department))
        .map(log => log.id.toString());

      if (selectedIds.length > 0 && window.confirm(`คุณแน่ใจหรือไม่ที่จะลบ ${selectedIds.length} รายการจากแผนกที่เลือก?`)) {
        deleteLogs(selectedIds);
        setLogs(prevLogs => prevLogs.filter(log => !selectedIds.includes(log.id.toString())));
        setSelectedDeptLogs({});
        setSelectAllDept(false);
      }
    }
  };

  const exportToCSV = () => {
    // Get current month and year for the filename
    const now = new Date();
    const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                       'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthYear = `${thaiMonths[month]} ${year}`;
    
    // Create title row
    const titleRow = [
      `"รายงานการส่งเข้า-ออกอุปกรณ์ ประจำเดือน${thaiMonths[month]} ${year}"`,
      ...Array(62).fill('') // Fill remaining cells in title row
    ];
    
    // Create headers
    const headers = ['แผนก', 'จำนวนแท็ก'];
    
    // Add day headers (1-31) with in/out subheaders
    for (let day = 1; day <= 31; day++) {
      headers.push(`วันที่ ${day} (เข้า)`, `วันที่ ${day} (ออก)`);
    }
    
    // Create department rows
    const rows = departmentSummary.map(dept => {
      const row = [
        `"${dept.department}"`,
        dept.tagCount
      ];
      
      // Add day data
      for (let i = 0; i < 31; i++) {
        const dayData = dept.days[i] || { in: 0, out: 0 };
        row.push(dayData.in, dayData.out);
      }
      
      return row.join(',');
    });
    
    // Combine all rows
    const csvContent = [
      titleRow.join(','),
      headers.join(','),
      ...rows
    ].join('\n');
    
    // Create download link
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = `${year}${(month + 1).toString().padStart(2, '0')}`;
    
    link.href = url;
    link.download = `ipad_summary_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

 
  const hasSelectedLogs = Object.values(selectedLogs).some(Boolean);
  const hasSelectedDeptLogs = Object.values(selectedDeptLogs).some(Boolean);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const logs = await getLogs();
        setLogs(logs);
      } catch (error) {
        console.error('Error fetching logs:', error);
      }
    };
    
    fetchLogs();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const depts = await getDepartmentsFromDB();
        setDepartments(['ทั้งหมด', ...depts]);
      } catch (e) {
        // ignore load errors for now
      }
    })();
  }, []);

  const filteredLogs = logs
    .filter((log: Log): boolean => {
      if (dateRange.startDate && dateRange.endDate) {
        const logDate = new Date(log.timestamp);
        const startDate = parseISO(dateRange.startDate);
        const endDate = parseISO(dateRange.endDate);
        if (!isWithinInterval(logDate, { start: startDate, end: endDate })) {
          return false;
        }
      }
      if (filterEmployee && !log.employeeId.includes(filterEmployee)) return false;
      if (filterDept !== 'ทั้งหมด' && log.department !== filterDept) return false;
      if (filterStatus !== 'ทั้งหมด' && log.status !== filterStatus) return false;
      return true;
    })
    .sort((a: Log, b: Log): number => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentLogs = filteredLogs.slice(startIndex, endIndex);

  // State to store all departments and their tag counts
  const [allDepartments, setAllDepartments] = useState<{name: string, tagCount: number}[]>([]);

  // Fetch all departments and their tag counts
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const depts = await getDepartmentsFromDB();
        const departmentsWithCounts = await Promise.all(
          depts.map(async (dept) => {
            const tags = await getTagsByDepartment(dept);
            return {
              name: dept,
              tagCount: tags.length
            };
          })
        );
        setAllDepartments(departmentsWithCounts);
      } catch (error) {
        console.error('Error fetching departments:', error);
      }
    };

    fetchDepartments();
  }, [showDeptSummary]);

  // Calculate department summary with per-day counts (1..31)
  type DeptDayCounts = {
    department: string;
    inCount: number;
    outCount: number;
    total: number;
    tagCount: number;
    days: { in: number; out: number }[]; // index 0 => day 1, ... index 30 => day 31
  };

  const departmentSummary = useMemo(() => {
    // Initialize maps
  const logCounts: Record<string, { in: number; out: number; days: { in: number; out: number }[] }> = {};

  // Prepare empty days array helper
  const emptyDays = () => Array.from({ length: 31 }, () => ({ in: 0, out: 0 }));

    // Aggregate filteredLogs into per-department totals and per-day buckets
    filteredLogs.forEach(log => {
      const dept = log.department || 'ไม่ระบุ';
      if (!logCounts[dept]) {
        logCounts[dept] = { in: 0, out: 0, days: emptyDays() };
      }

      // Count in/out
      if (log.status === 'ส่งเข้า') {
        logCounts[dept].in += 1;
      } else {
        logCounts[dept].out += 1;
      }

      // Determine day of month from timestamp or date field
      let day = 0;
      try {
        const d = new Date(log.timestamp);
        if (!Number.isNaN(d.getTime())) {
          day = d.getDate();
        }
      } catch (e) {
        // fallback if timestamp malformed
      }

      if (day >= 1 && day <= 31) {
        // increment day's in/out count for this dept
        if (log.status === 'ส่งเข้า') {
          logCounts[dept].days[day - 1].in += 1;
        } else {
          logCounts[dept].days[day - 1].out += 1;
        }
      }
    });

    // Ensure we include all departments from allDepartments even if they have zero logs
    const deptMap = new Map(allDepartments.map(dept => [dept.name, dept.tagCount]));

    const result: DeptDayCounts[] = Array.from(deptMap.entries()).map(([dept, tagCount]) => {
      const counts = logCounts[dept] || { in: 0, out: 0, days: emptyDays() };
      return {
        department: dept,
        inCount: counts.in,
        outCount: counts.out,
        total: counts.in + counts.out,
        tagCount: tagCount,
        days: counts.days
      };
    });

    // Also include any departments that appeared in logs but not in allDepartments (defensive)
    Object.keys(logCounts).forEach(dept => {
      if (!deptMap.has(dept)) {
        const counts = logCounts[dept];
        result.push({
          department: dept,
          inCount: counts.in,
          outCount: counts.out,
          total: counts.in + counts.out,
          tagCount: 0,
          days: counts.days
        });
      }
    });

    return result.sort((a, b) => b.total - a.total);
  }, [filteredLogs, allDepartments]);

  // Compute a display label for the month and year to show on the department summary header.
  // Prefer the selected date range (startDate..endDate). If the range is within a single month/year,
  // show that month and year. If it spans multiple months, show a start—end month/year range.
  // If no valid range is selected, fall back to the current month/year (Gregorian / ค.ศ.).
  const deptSummaryDateLabel = (() => {
    const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    try {
      if (dateRange.startDate && dateRange.endDate) {
        const start = parseISO(dateRange.startDate);
        const end = parseISO(dateRange.endDate);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
            return <span className="text-black">{thaiMonths[start.getMonth()]} {start.getFullYear()}</span>;
          }
          return <span className="text-black">{thaiMonths[start.getMonth()]} {start.getFullYear()} — {thaiMonths[end.getMonth()]} {end.getFullYear()}</span>;
        }
      }
    } catch (e) {
      // ignore and fall back
    }
    const now = new Date();
    return <span className="text-black">{thaiMonths[now.getMonth()]} {now.getFullYear()}</span>;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50 relative">
      <BubbleBackground />
      <div className="relative z-10 max-w-7xl mx-auto p-4 md:p-6">
        <div className="bg-gradient-to-r from-blue-600 to-sky-500 rounded-2xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-16 h-16 relative">
              <Image 
                src="/Instigator.jpg" 
                alt="Instigator Logo" 
                fill 
                className="rounded-full object-cover border-2 border-white shadow-md"
                sizes="64px"
                priority
              />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">IPad Tracking System</h1>
          </div>
          <p className="text-blue-100 text-lg">โรงพยาบาลรามคำแหง - ระบบบันทึกการส่งเข้า/ออกอุปกรณ์</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => router.push('/import')}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-400 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-500 transition-all shadow-lg text-lg"
            >
              <ArrowRight className="w-6 h-6" />
              บันทึกส่งเข้า
            </button>
            <button
              onClick={() => router.push('/export')}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-orange-500 to-amber-400 text-white font-bold rounded-xl hover:from-orange-600 hover:to-amber-500 transition-all shadow-lg text-lg"
            >
              <ArrowLeft className="w-6 h-6" />
              บันทึกส่งออก
            </button>
          </div>
          <button
            onClick={toggleAddForm}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-500 to-indigo-400 text-white font-bold rounded-xl hover:from-purple-600 hover:to-indigo-500 transition-all shadow-lg text-lg"
          >
            <Plus className="w-5 h-5" />
            {showAddForm ? 'ปิดฟอร์ม' : 'แก้ไขแผนก/แท็ก'}
          </button>
        </div>

        {showAddForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-blue-100">
            <h2 className="text-xl font-semibold text-blue-800 mb-4">แก้ไขแผนกและแท็ก</h2>
            <form onSubmit={handleAddDepartment} className="space-y-4">
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                  แผนก <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="department"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder=""
                  required
                />
                {departments.includes(newDepartment) && newDepartment && (
                  <p className="mt-1 text-sm text-amber-600">แผนกนี้มีอยู่ในระบบแล้ว</p>
                )}
              </div>
              
              <div>
                <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
                  แท็ก 
                </label>
                <input
                  type="text"
                  id="tags"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder=""
                />
              </div>

              {tags.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-700 mb-1">แท็กที่มีในระบบ:</p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span 
                        key={tag}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                      >
                        {tag}
                        <button 
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-200 hover:bg-blue-300 text-blue-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={toggleAddForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  disabled={!newDepartment.trim()}
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-blue-100">
          <h2 className="text-xl font-semibold text-blue-800 mb-4 flex items-center gap-2">
            
            ตัวกรองข้อมูล
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <VercelDateRangePicker 
              initialRange={dateRange}
              onDateRangeChange={(range) => {setDateRange(range); setCurrentPage(1);}} 
              className="lg:col-span-1"
            />
            <input
              type="text"
              placeholder="🔍 รหัสพนักงาน"
              value={filterEmployee}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {setFilterEmployee(e.target.value); setCurrentPage(1);}}
              className="px-4 py-2 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none"
            />
            <select
              value={filterDept}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {setFilterDept(e.target.value); setCurrentPage(1);}}
              className="px-4 py-2 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
                        <select
              value={filterStatus}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {setFilterStatus(e.target.value); setCurrentPage(1);}}
              className="px-4 py-2 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none"
            >
              <option value="ทั้งหมด">สถานะทั้งหมด</option>
              <option value="ส่งเข้า">ส่งเข้า</option>
              <option value="ส่งออก">ส่งออก</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSortOrder(e.target.value as SortOrder)}
              className="px-4 py-2 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none"
            >
              <option value="desc">ล่าสุดก่อน</option>
              <option value="asc">เก่าสุดก่อน</option>
            </select>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-sky-400 rounded-xl shadow-lg p-4 mb-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm opacity-90">แสดงข้อมูล</p>
              <p className="text-2xl font-bold">
                {totalItems > 0 ? `${startIndex + 1}-${endIndex}` : '0'} จาก {totalItems}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-90">ข้อมูลทั้งหมดในระบบ</p>
              <p className="text-2xl font-bold">{logs.length} รายการ</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden border border-blue-100">
          <div className="p-4 border-b border-blue-100 flex flex-wrap justify-between items-center gap-4">
            <h2 className="text-lg font-semibold text-blue-800">
              {showDeptSummary ? (
                <span>
                  สรุปการส่งเข้า/ออก แยกตามแผนก
                  <span className="ml-6 text-sm font-semibold text-black-100">{deptSummaryDateLabel}</span>
                </span>
              ) : (
                'รายการส่งเข้า/ส่งออก'
              )}
            </h2>
            <div className="flex items-center gap-3">
              {(hasSelectedLogs || hasSelectedDeptLogs) && (
                <button
                  onClick={showDeptSummary ? handleDeleteSelectedDeptLogs : handleDeleteSelectedLogs}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  ลบที่เลือก ({showDeptSummary ? Object.values(selectedDeptLogs).filter(Boolean).length : Object.values(selectedLogs).filter(Boolean).length})
                </button>
              )}
              {showDeptSummary && (
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  ส่งออก CSV
                </button>
              )}
              <button 
                onClick={() => setShowDeptSummary(!showDeptSummary)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
              >
                {showDeptSummary ? (
                  <>
                    <span>แสดงรายการทั้งหมด</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                    </svg>
                  </>
                ) : (
                  <>
                    <span>แสดงสรุปรายแผนก</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>

          {showDeptSummary ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-600 to-sky-500 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">แผนก</th>
                    {/* Day columns 1..31 */}
                    {Array.from({ length: 31 }, (_, i) => (
                      <th key={i} className="px-2 py-3 text-center text-sm font-semibold">{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {departmentSummary.length === 0 ? (
                    <tr>
                      <td colSpan={33} className="px-4 py-8 text-center text-gray-500">
                        ไม่มีข้อมูล
                      </td>
                    </tr>
                  ) : (
                    departmentSummary.map((dept) => (
                      <tr key={dept.department} className="border-b border-blue-50 hover:bg-blue-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-blue-700">
                          {dept.department}
                          {dept.tagCount > 0 && (
                            <span className="ml-2 text-xs font-normal text-gray-500">
                              ({dept.tagCount} แท็ก)
                            </span>
                          )}
                        </td>
                        {/* Render day counts (in/out badges) */}
                        {dept.days && dept.days.map((count, idx) => (
                          <td key={idx} className="px-2 py-2 text-center text-sm text-gray-700">
                            {count.in === 0 && count.out === 0 ? (
                              // render empty cell when both counts are zero
                              <span className="inline-block w-full h-full">&nbsp;</span>
                            ) : (
                              <div className="flex flex-col items-center gap-0">
                                {count.in > 0 && (
                                  <span className="text-sm font-semibold text-green-700">{count.in}</span>
                                )}
                                {count.out > 0 && (
                                  <span className="text-sm font-semibold text-orange-700">{count.out}</span>
                                )}
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-blue-600 to-sky-500 text-white">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">แท็กไอแพด</th>
                      <th className="px-4 py-3 text-left font-semibold">รหัสพนักงาน</th>
                      <th className="px-4 py-3 text-left font-semibold">แผนก</th>
                      <th className="px-4 py-3 text-left font-semibold">สถานะ</th>
                      <th className="px-4 py-3 text-left font-semibold">วันที่</th>
                      <th className="px-4 py-3 text-left font-semibold">เวลา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          ไม่มีข้อมูล
                        </td>
                      </tr>
                    ) : (
                      currentLogs.map((log: Log) => (
                        <tr key={log.id} className="border-b border-blue-50 hover:bg-blue-50 transition-colors">
                          <td className="px-4 py-3 text-gray-700 font-mono">{log.ipadTag}</td>
                          <td className="px-4 py-3 font-semibold text-blue-700">{log.employeeId}</td>
                          <td className="px-4 py-3 text-gray-700">{log.department}</td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              log.status === 'ส่งเข้า' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{log.date}</td>
                          <td className="px-4 py-3 text-gray-600">{log.time}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 bg-blue-50 border-t border-blue-100">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-white text-blue-600 border-2 border-blue-200 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50 transition-colors"
                  >
                    ← ก่อนหน้า
                  </button>
                  <span className="text-blue-700 font-semibold">
                    หน้า {currentPage} จาก {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-white text-blue-600 border-2 border-blue-200 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50 transition-colors"
                  >
                    ถัดไป →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}