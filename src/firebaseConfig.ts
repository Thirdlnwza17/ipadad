import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCl_R5MGZ04DBdORovo3NVCNSMdTE--Le4",
  authDomain: "ipadram-53fd4.firebaseapp.com",
  projectId: "ipadram-53fd4",
  storageBucket: "ipadram-53fd4.firebasestorage.app",
  messagingSenderId: "249870644269",
  appId: "1:249870644269:web:0f657867750a6011c5f4a4",
  measurementId: "G-4R9HLWEC5X"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

if (typeof window !== 'undefined') {
  try {
    getAnalytics(app);
  } catch {}
}

export const db = getFirestore(app);
export default app;