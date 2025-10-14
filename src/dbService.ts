import { db } from './firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';

export interface LogBase {
  employeeId: string;
  ipadTag: string;
  department: string;
  status: 'ส่งเข้า' | 'ส่งออก';
}

export interface Log extends LogBase {
  id: number;
  timestamp: string;
  date: string;
  time: string;
}

const LOGS_KEY = 'ipadTrackingLogs';

export const getDepartmentsFromDB = async (): Promise<string[]> => {
  try {
    const snap = await getDocs(collection(db, 'ipad'));
    const departments = new Set<string>();
    snap.forEach(doc => {
      const data = doc.data();
      if (data.department) {
        departments.add(data.department);
      }
    });
    return Array.from(departments).sort((a, b) => a.localeCompare(b, 'th'));
  } catch (error) {
    console.error('Error fetching departments:', error);
    return [];
  }
};

export const getLogs = (): Log[] => {
  if (typeof window === 'undefined') return [];
  const logsJson = localStorage.getItem(LOGS_KEY);
  return logsJson ? JSON.parse(logsJson) : [];
};

const getDepartmentFromIpadTag = (ipadTag: string): string => {
  const mappings: { [key: string]: string } = {
    'ER': 'ห้องฉุกเฉิน',
    'OR': 'ห้องผ่าตัด',
    'COM': 'ห้องคอมพิวเตอร์',
    'IPD': 'ห้องพักผู้ป่วย',
    'OPD': 'ห้องตรวจ',
    'XRAY': 'แผนกรังสี',
    'DENT': 'ห้องทันตกรรม',
  };
  const prefix = ipadTag.split('-')[0].toUpperCase();
  return mappings[prefix] || 'ไม่ระบุแผนก';
};

// Check the current status of an iPad tag
export const getIpadStatus = (ipadTag: string): 'ส่งเข้า' | 'ส่งออก' | null => {
  const logs = getLogs();
  // Find the most recent log for this iPad tag
  const latestLog = logs
    .filter(log => log.ipadTag === ipadTag)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  
  return latestLog ? latestLog.status : null;
};

export const addLog = async (log: LogBase): Promise<Log> => {
  const logs = getLogs();
  
  // Check if the iPad already has the same status
  const currentStatus = getIpadStatus(log.ipadTag);
  if (currentStatus === log.status) {
    throw new Error(`ไม่สามารถ${log.status}ได้ เนื่องจากแท็กนี้อยู่ในสถานะ ${log.status} อยู่แล้ว`);
  }
  
  // If current status is 'ส่งเข้า' and new status is also 'ส่งเข้า', throw error
  if (currentStatus === 'ส่งเข้า' && log.status === 'ส่งเข้า') {
    throw new Error('ไม่สามารถส่งเข้าได้ เนื่องจากแท็กนี้ยังไม่ได้ถูกส่งออก');
  }
  
  const newLog: Log = {
    ...log,
    id: Date.now(),
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString('th-TH'),
    time: new Date().toLocaleTimeString('th-TH'),
  };
  
  const updatedLogs = [newLog, ...logs];
  localStorage.setItem(LOGS_KEY, JSON.stringify(updatedLogs));
  return newLog;
};


export const getTagsByDepartment = async (department: string): Promise<string[]> => {
  const q = query(collection(db, 'ipad'), where('department', '==', department));
  const snap = await getDocs(q);
  const tagSet = new Set<string>();
  snap.forEach(doc => {
    const data = doc.data() as { tags?: string[] };
    if (Array.isArray(data?.tags)) {
      for (const t of data.tags) {
        if (typeof t === 'string' && t.trim()) tagSet.add(t.trim());
      }
    }
  });
  return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'th'));
};

export const deleteLogs = (logIds: string[]): void => {
  if (typeof window === 'undefined') return;
  
  const logs = getLogs();
  const logIdsSet = new Set(logIds);
  const updatedLogs = logs.filter(log => !logIdsSet.has(log.id.toString()));
  
  localStorage.setItem(LOGS_KEY, JSON.stringify(updatedLogs));
};