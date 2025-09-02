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

export interface TaxSetting {
  id?: string;
  nameAr: string;
  nameEn: string;
  branch: string;
  parentAccount: string;
  percent: number;
  subAccountId?: string; // الحساب الفرعي المنشأ لإعداد الضريبة
  subAccountCode?: string; // كود الحساب الفرعي
  fiscalYear?: string;
}

const COLLECTION_NAME = 'taxSettings';

export const fetchTaxSettings = async (): Promise<TaxSetting[]> => {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as TaxSetting[];
  } catch (error) {
    console.error('Error fetching tax settings:', error);
    return [];
  }
};

export const addTaxSettingWithSubAccount = async (taxSettingData: {
  nameAr: string;
  nameEn: string;
  branch: string;
  parentAccount: string;
  percent: number;
  fiscalYear?: string;
}) => {
  try {
    // إنشاء حساب فرعي لإعداد الضريبة
    const subAccount = await createSubAccount(
      taxSettingData.parentAccount,
      `ضريبة - ${taxSettingData.nameAr}`,
      `Tax - ${taxSettingData.nameEn}`,
      taxSettingData.branch // استخدام الفرع كمركز تكلفة
    );

    // إنشاء إعداد الضريبة مع ربطه بالحساب الفرعي
    const taxSetting: Omit<TaxSetting, 'id'> = {
      nameAr: taxSettingData.nameAr,
      nameEn: taxSettingData.nameEn,
      branch: taxSettingData.branch,
      parentAccount: taxSettingData.parentAccount,
      percent: taxSettingData.percent,
      subAccountId: subAccount.id,
      subAccountCode: subAccount.code,
      fiscalYear: taxSettingData.fiscalYear
    };

    await addDoc(collection(db, COLLECTION_NAME), taxSetting);
    
    return {
      success: true,
      subAccount,
      taxSetting,
      message: 'تم إنشاء إعداد الضريبة والحساب الفرعي بنجاح'
    };
  } catch (error) {
    console.error('Error adding tax setting with sub account:', error);
    throw error;
  }
};

export const deleteTaxSettingWithSubAccount = async (id: string) => {
  try {
    // الحصول على بيانات إعداد الضريبة أولاً
    const taxSettings = await fetchTaxSettings();
    const taxSetting = taxSettings.find(ts => ts.id === id);
    
    if (!taxSetting) {
      throw new Error('إعداد الضريبة غير موجود');
    }

    // حذف الحساب الفرعي إذا كان موجوداً
    if (taxSetting.subAccountId) {
      await deleteAccount(taxSetting.subAccountId);
    }

    // حذف إعداد الضريبة
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    
    return {
      success: true,
      message: 'تم حذف إعداد الضريبة والحساب الفرعي بنجاح'
    };
  } catch (error) {
    console.error('Error deleting tax setting with sub account:', error);
    throw error;
  }
};

export const updateTaxSetting = async (id: string, data: Partial<TaxSetting>) => {
  try {
    await updateDoc(doc(db, COLLECTION_NAME, id), data);
    return {
      success: true,
      message: 'تم تحديث إعداد الضريبة بنجاح'
    };
  } catch (error) {
    console.error('Error updating tax setting:', error);
    throw error;
  }
};
