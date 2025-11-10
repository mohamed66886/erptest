import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { getSectionFromPath } from '../utils/sidebarMenus';

export type SectionType = 
  | 'default'
  | 'financial'
  | 'hr'
  | 'warehouse'
  | 'projects'
  | 'sales'
  | 'purchase'
  | 'contracts'
  | 'equipment'
  | 'delivery';

interface SidebarContextType {
  currentSection: SectionType;
  setCurrentSection: (section: SectionType) => void;
}

export const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

interface SidebarProviderProps {
  children: ReactNode;
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children }) => {
  const location = useLocation();
  
  // استخدام القسم المحفوظ في localStorage أو تحديده من URL
  const [currentSection, setCurrentSection] = useState<SectionType>(() => {
    const savedSection = localStorage.getItem('currentSection') as SectionType;
    const pathSection = getSectionFromPath(location.pathname);
    return pathSection !== 'default' ? pathSection : (savedSection || 'default');
  });

  // تحديث القسم عند تغيير URL
  useEffect(() => {
    const newSection = getSectionFromPath(location.pathname);
    if (newSection !== 'default') {
      setCurrentSection(newSection);
      localStorage.setItem('currentSection', newSection);
    }
  }, [location.pathname]);

  // حفظ القسم في localStorage عند تغييره
  const updateCurrentSection = (section: SectionType) => {
    setCurrentSection(section);
    localStorage.setItem('currentSection', section);
  };

  return (
    <SidebarContext.Provider value={{ currentSection, setCurrentSection: updateCurrentSection }}>
      {children}
    </SidebarContext.Provider>
  );
};
