import { db } from './firebaseConfig';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  limit, 
  doc, 
  deleteDoc,
  writeBatch,
  Timestamp
} from 'firebase/firestore';

// Base log interface
export interface LogBase {
  employeeId: string;
  ipadTag: string;
  department: string;
  status: 'ส่งเข้า' | 'ส่งออก';
}

export interface Log extends LogBase {
  id: string;
  timestamp: string;
  date: string;
  time: string;
}

// Type for localStorage log (simplified version of Log)
interface LocalLog {
  id?: string;
  employeeId: string;
  ipadTag: string;
  department: string;
  status: 'ส่งเข้า' | 'ส่งออก';
  timestamp: string;
  date: string;
  time: string;
}

// Type guard for LocalLog
const isLocalLog = (data: unknown): data is LocalLog => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'employeeId' in data &&
    'ipadTag' in data &&
    'department' in data &&
    'status' in data &&
    'timestamp' in data &&
    'date' in data &&
    'time' in data &&
    (data.status === 'ส่งเข้า' || data.status === 'ส่งออก')
  );
};

// Type guard for Log
export const isLog = (data: unknown): data is Log => {
  if (!isLocalLog(data)) return false;
  return typeof data.id === 'string';
};

type FirestoreLog = Omit<LocalLog, 'id' | 'timestamp'> & {
  timestamp: Timestamp;
  date: string;
  time: string;
};

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

interface IpadDocument {
  department?: string;
  tags?: string[];
  [key: string]: unknown;
}

export const getLogs = async (): Promise<Log[]> => {
  try {
    const logsCollection = collection(db, 'logs');
    const q = query(logsCollection, orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const logs: Log[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as FirestoreLog;
      // Convert Firestore timestamp to ISO string
      const timestamp = data.timestamp?.toDate 
        ? data.timestamp.toDate().toISOString() 
        : typeof data.timestamp === 'string' 
          ? data.timestamp 
          : new Date().toISOString();
      
      const log: Log = {
        id: doc.id,
        employeeId: data.employeeId || '',
        ipadTag: data.ipadTag,
        department: data.department,
        status: data.status,
        timestamp,
        date: data.date || new Date(timestamp).toLocaleDateString('th-TH'),
        time: data.time || new Date(timestamp).toLocaleTimeString('th-TH')
      };
      
      if (isLog(log)) {
        logs.push(log);
      } else {
        console.warn('Invalid log data:', log);
      }
    });
    
    return logs;
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการดึงข้อมูลประวัติ:', error);
    return [];
  }
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

// ตรวจสอบสถานะล่าสุดของแท็กไอแพด
interface LocalStorageLog {
  ipadTag: string;
  status: 'ส่งเข้า' | 'ส่งออก';
  timestamp: string;
  [key: string]: unknown;
}

export const getIpadStatus = async (ipadTag: string): Promise<'ส่งเข้า' | 'ส่งออก' | null> => {
  try {
    // 1. ใช้ getLogs ซึ่งมี orderBy timestamp อยู่แล้ว
    const allLogs = await getLogs();
    
    // 2. กรองเฉพาะ log ของ ipadTag ที่ต้องการ
    const ipadLogs = allLogs.filter(log => log.ipadTag === ipadTag);
    
    // 3. เรียงลำดับตาม timestamp ล่าสุด
    ipadLogs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    // 4. คืนค่าสถานะล่าสุดถ้ามี
    return ipadLogs[0]?.status || null;
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการตรวจสอบสถานะไอแพด:', error);
    
    // Fallback 1: ลองค้นหาจาก cache ใหม่
    try {
      const logsCollection = collection(db, 'logs');
      const q = query(
        logsCollection, 
        where('ipadTag', '==', ipadTag), 
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data() as FirestoreLog;
        return data.status || null;
      }
    } catch (e) {
      console.error('Error in fallback query:', e instanceof Error ? e.message : String(e));
    }
    
    // Fallback 2: ใช้ localStorage
    try {
      const logsStr = localStorage.getItem('ipadLogs');
      if (!logsStr) return null;
      
      const logs = JSON.parse(logsStr) as unknown[];
      const ipadLogs = logs
        .filter((log): log is LocalStorageLog => 
          typeof log === 'object' && 
          log !== null && 
          'ipadTag' in log && 
          'status' in log &&
          'timestamp' in log
        )
        .filter(log => log.ipadTag === ipadTag)
        .sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      
      return ipadLogs[0]?.status || null;
    } catch (e) {
      console.error('Error getting status from localStorage:', e instanceof Error ? e.message : String(e));
      return null;
    }
  }
};

// ตรวจสอบว่าสามารถเพิ่ม log ใหม่ได้หรือไม่
export const canAddLog = async (ipadTag: string, newStatus: 'ส่งเข้า' | 'ส่งออก'): Promise<{ canAdd: boolean; message: string }> => {
  const currentStatus = await getIpadStatus(ipadTag);
  
  // ถ้ายังไม่มีประวัติ ให้สามารถส่งเข้าได้เลยในครั้งแรก
  if (!currentStatus) {
    return { canAdd: true, message: '' };
  }
  
  // ถ้าสถานะปัจจุบันเหมือนกับที่ต้องการเพิ่ม
  if (currentStatus === newStatus) {
    return { 
      canAdd: false, 
      message: `ไม่สามารถ${newStatus}ได้ เนื่องจากแท็กนี้อยู่ในสถานะ ${newStatus} อยู่แล้ว` 
    };
  }
  
  // อนุญาตให้ส่งออกได้เสมอถ้าเป็นสถานะส่งเข้า
  if (newStatus === 'ส่งออก' && currentStatus === 'ส่งเข้า') {
    return { canAdd: true, message: '' };
  }
  
  // อนุญาตให้ส่งเข้าได้ถ้าเป็นสถานะส่งออก
  if (newStatus === 'ส่งเข้า' && currentStatus === 'ส่งออก') {
    return { canAdd: true, message: '' };
  }
  
  return { 
    canAdd: false, 
    message: `ไม่สามารถ${newStatus}ได้ เนื่องจากสถานะปัจจุบันไม่สอดคล้อง` 
  };
};

// ตรวจสอบว่าแท็กไอแพดและแผนกถูกต้อง
const validateIpadTag = async (ipadTag: string, department: string): Promise<boolean> => {
  try {
    const ipadQuery = query(
      collection(db, 'ipad'),
      where('tags', 'array-contains', ipadTag),
      where('department', '==', department)
    );
    const querySnapshot = await getDocs(ipadQuery);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error validating iPad tag:', error);
    return false;
  }
};


export const addLog = async (log: LogBase): Promise<Log> => {
  try {
    // ตรวจสอบว่าแท็กไอแพดและแผนกถูกต้อง
    const isValid = await validateIpadTag(log.ipadTag, log.department);
    if (!isValid) {
      throw new Error('ไม่พบข้อมูลแท็กไอแพดหรือแผนกไม่ถูกต้อง');
    }

    // ตรวจสอบว่าสามารถเพิ่ม log ใหม่ได้หรือไม่
    const { canAdd, message } = await canAddLog(log.ipadTag, log.status);
    if (!canAdd) {
      throw new Error(message);
    }
    
    // ตรวจสอบสถานะปัจจุบันของแท็กไอแพด
    const currentStatus = await getIpadStatus(log.ipadTag);
    
    // ตรวจสอบการส่งเข้าซ้ำ (ไม่ให้ส่งเข้าซ้ำโดยไม่มีการส่งออก)
    if (currentStatus === 'ส่งเข้า' && log.status === 'ส่งเข้า') {
      throw new Error('ไม่สามารถส่งเข้าได้ เนื่องจากแท็กนี้ยังไม่ได้ถูกส่งออก');
    }
    
    // ตรวจสอบการส่งออกซ้ำ (ไม่ให้ส่งออกซ้ำโดยไม่มีการส่งเข้า)
    if (currentStatus === 'ส่งออก' && log.status === 'ส่งออก') {
      throw new Error('ไม่สามารถส่งออกได้ เนื่องจากแท็กนี้ยังไม่ถูกส่งเข้า');
    }
    
    // เพิ่มข้อมูลลงใน Firestore
    const logsCollection = collection(db, 'logs');
    const timestamp = serverTimestamp();
    const date = new Date().toLocaleDateString('en-US');
    const time = new Date().toLocaleTimeString('th-TH');
    
    const docRef = await addDoc(logsCollection, {
      ...log,
      timestamp,
      date,
      time
    });
    
    // ส่งกลับข้อมูล log พร้อม ID ที่สร้างขึ้น
    return {
      ...log,
      id: docRef.id,
      timestamp: new Date().toISOString(),
      date,
      time
    };
  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล:', error);
    const errorMessage = error instanceof Error ? error.message : 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง';
    throw new Error(errorMessage);
  }
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

export const deleteLogs = async (logIds: string[]): Promise<void> => {
  try {
    const batch = writeBatch(db);
    
    logIds.forEach(id => {
      const docRef = doc(db, 'logs', id);
      batch.delete(docRef);
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error deleting logs:', error);
    throw new Error('ไม่สามารถลบรายการที่เลือกได้');
  }
};