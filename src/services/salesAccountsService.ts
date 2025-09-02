import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { createSubAccount, deleteAccount } from './accountsService';

export interface SalesAccount {
  id?: string;
  nameAr: string;
  nameEn: string;
  branch: string;
  parentAccount: string;
  subAccountId?: string; // الحساب الفرعي المنشأ لحساب المبيعات
  subAccountCode?: string; // كود الحساب الفرعي
  fiscalYear?: string;
}

const COLLECTION_NAME = 'salesAccounts';

export const fetchSalesAccounts = async (): Promise<SalesAccount[]> => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as SalesAccount[];
  } catch (error) {
    console.error('Error fetching sales accounts:', error);
    return [];
  }
};

export const addSalesAccountWithSubAccount = async (salesAccountData: {
  nameAr: string;
  nameEn: string;
  branch: string;
  parentAccount: string;
  fiscalYear?: string;
}) => {
  try {
    // إنشاء حساب فرعي لحساب المبيعات
    const subAccount = await createSubAccount(
      salesAccountData.parentAccount,
      salesAccountData.nameAr,
      salesAccountData.nameEn,
      salesAccountData.branch // استخدام الفرع كمركز تكلفة
    );

    // إنشاء حساب المبيعات مع ربطه بالحساب الفرعي
    const salesAccount: Omit<SalesAccount, 'id'> = {
      nameAr: salesAccountData.nameAr,
      nameEn: salesAccountData.nameEn,
      branch: salesAccountData.branch,
      parentAccount: salesAccountData.parentAccount,
      subAccountId: subAccount.id,
      subAccountCode: subAccount.code,
      fiscalYear: salesAccountData.fiscalYear
    };

    await addDoc(collection(db, COLLECTION_NAME), salesAccount);
    
    return {
      success: true,
      subAccount,
      salesAccount,
      message: 'تم إنشاء حساب المبيعات والحساب الفرعي بنجاح'
    };
  } catch (error) {
    console.error('Error adding sales account with sub account:', error);
    throw error;
  }
};

export const deleteSalesAccountWithSubAccount = async (id: string) => {
  try {
    // الحصول على بيانات حساب المبيعات أولاً
    const salesAccounts = await fetchSalesAccounts();
    const salesAccount = salesAccounts.find(sa => sa.id === id);
    
    if (!salesAccount) {
      throw new Error('حساب المبيعات غير موجود');
    }

    // حذف الحساب الفرعي إذا كان موجوداً
    if (salesAccount.subAccountId) {
      await deleteAccount(salesAccount.subAccountId);
    }

    // حذف حساب المبيعات
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    
    return {
      success: true,
      message: 'تم حذف حساب المبيعات والحساب الفرعي بنجاح'
    };
  } catch (error) {
    console.error('Error deleting sales account with sub account:', error);
    throw error;
  }
};

export const updateSalesAccount = async (id: string, data: Partial<SalesAccount>) => {
  try {
    await updateDoc(doc(db, COLLECTION_NAME, id), data);
    return {
      success: true,
      message: 'تم تحديث حساب المبيعات بنجاح'
    };
  } catch (error) {
    console.error('Error updating sales account:', error);
    throw error;
  }
};
