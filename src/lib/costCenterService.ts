// Firebase implementation of costCenterService.ts
import { db } from './firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';

export interface CostCenter {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  description?: string;
  type: 'رئيسي' | 'فرعي' | 'وحدة';
  level: number;
  parentId?: string;
  children?: CostCenter[];
  status: 'نشط' | 'غير نشط';
  hasSubCenters: boolean;
  manager?: string;
  department?: string;
  location?: string;
  budget?: number;
  actualCost?: number;
  variance?: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Get all cost centers from Firebase
export const getCostCenters = async (): Promise<CostCenter[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'costCenters'));
    const costCenters = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as CostCenter));
    
    console.log('Cost centers loaded from Firebase:', costCenters.length);
    return costCenters;
  } catch (error) {
    console.error('Error fetching cost centers:', error);
    throw error;
  }
};

// Add new cost center to Firebase
export const addCostCenter = async (costCenter: Omit<CostCenter, 'id'>): Promise<void> => {
  try {
    const costCenterWithTimestamp = {
      ...costCenter,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await addDoc(collection(db, 'costCenters'), costCenterWithTimestamp);
    console.log('Cost center added successfully');
  } catch (error) {
    console.error('Error adding cost center:', error);
    throw error;
  }
};

// Update cost center in Firebase
export const updateCostCenter = async (id: string, updates: Partial<CostCenter>): Promise<void> => {
  try {
    const updatesWithTimestamp = {
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await updateDoc(doc(db, 'costCenters', id), updatesWithTimestamp);
    console.log('Cost center updated successfully');
  } catch (error) {
    console.error('Error updating cost center:', error);
    throw error;
  }
};

// Delete cost center from Firebase
export const deleteCostCenter = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'costCenters', id));
    console.log('Cost center deleted successfully');
  } catch (error) {
    console.error('Error deleting cost center:', error);
    throw error;
  }
};


