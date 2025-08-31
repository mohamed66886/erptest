
import React, { useState, useEffect } from 'react';

// مكون للسويتش مع حالة محلية لكل صف
type SwitchCellProps = {
  year: FinancialYear;
  isActionDisabled: boolean;
  handleEdit: (year: FinancialYear) => void;
  handleDelete: (id: string) => void;
};

const SwitchCell: React.FC<SwitchCellProps> = ({ year, isActionDisabled, handleEdit, handleDelete }) => {
  const [switchChecked, setSwitchChecked] = useState(true);
  return (
    <div className="flex items-center justify-center gap-2">
      {/* Custom blue switch with label inside */}
      <label className="flex items-center cursor-pointer select-none">
        <div style={{ position: 'relative', minWidth: 70 }}>
          <Switch
            checked={switchChecked}
            onChange={setSwitchChecked}
            checkedChildren="نشطة"
            unCheckedChildren="موقوفة مؤقتاً"
            style={{ minWidth: 70, background: switchChecked ? '#2563eb' : '#eab308', color: '#fff', fontWeight: 'bold', fontSize: 16 }}
            disabled={isActionDisabled}
          />
          {isActionDisabled && (
            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}>
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            </span>
          )}
        </div>
      </label>
      <Button 
        size="icon" 
        variant="ghost" 
        onClick={() => handleEdit(year)} 
        aria-label="تعديل"
        className={`h-8 w-8 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 ${year.status !== 'مفتوحة' ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
        disabled={isActionDisabled}
      >
        <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </Button>
      <Button 
        size="icon" 
        variant="ghost" 
        onClick={() => handleDelete(year.id)} 
        aria-label="حذف"
        className="h-8 w-8 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50"
        disabled={isActionDisabled}
      >
        <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
      </Button>
    </div>
  );
};

import '../../styles/custom-table.css';
import { useNavigate } from 'react-router-dom';
import { getFinancialYears, deleteFinancialYear, updateFinancialYear } from '@/services/financialYearsService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AddFinancialYearModal from "@/components/AddFinancialYearModal";
import { Select as AntdSelect } from 'antd';
import { Switch } from 'antd';
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { 
  Calendar, 
  Plus, 
  FileDown, 
  Edit, 
  Trash2, 
  ArrowLeft,
  MoreHorizontal,
  AlertCircle,
  FileSpreadsheet,
  Loader2
} from 'lucide-react';
// ...existing code...
import { Table as AntdTable } from 'antd';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Breadcrumb from '@/components/Breadcrumb';
import type { FinancialYear } from '@/services/financialYearsService';

interface FinancialYearsPageProps {
  onBack?: () => void;
}

const FinancialYearsPage: React.FC<FinancialYearsPageProps> = ({ onBack }) => {
  // حالة تعطيل الإجراءات مؤقتاً
  const [isActionDisabled, setIsActionDisabled] = useState(false);
  // Ref for warning scroll
  const warningRef = React.useRef<HTMLDivElement>(null);
  // ...existing code...
  // تحذير إغلاق السنة المالية
  const [closeWarning, setCloseWarning] = useState<{open: boolean, year: FinancialYear | null}>({open: false, year: null});
  // Scroll to warning when it appears
  useEffect(() => {
    if (closeWarning.open && warningRef.current) {
      warningRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [closeWarning.open]);

  // إغلاق السنة المالية من الإجراءات مع تحذير
  const handleCloseYear = (year: FinancialYear) => {
    setCloseWarning({open: true, year});
  };
  // ...existing code...
  // السنة المالية
  const { currentFinancialYear, activeYears, setCurrentFinancialYear } = useFinancialYear();
  const [fiscalYear, setFiscalYear] = useState<string>("");

  useEffect(() => {
    if (currentFinancialYear) {
      setFiscalYear(currentFinancialYear.year.toString());
    }
  }, [currentFinancialYear]);

  const handleFiscalYearChange = (value: string) => {
    setFiscalYear(value);
    const selectedYear = activeYears.find(y => y.year.toString() === value);
    if (selectedYear) {
      setCurrentFinancialYear(selectedYear);
    }
  };
  const navigate = useNavigate();
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  useEffect(() => {
    getFinancialYears().then((years) => {
      // sort by year desc
      setFinancialYears(years.sort((a, b) => b.year - a.year));
    });
  }, []);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editYear, setEditYear] = useState<FinancialYear | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, yearId: string, yearName: string}>({
    isOpen: false,
    yearId: '',
    yearName: ''
  });

  const handleAddYear = () => {
    setIsAddModalOpen(true);
  };

  const handleSaveYear = async (yearData: {
    year: number;
    startDate: string;
    endDate: string;
    status: string;
  }) => {
    if (editYear) {
      // تعديل
      await updateFinancialYear(editYear.id, yearData);
      let updated = await getFinancialYears();
      // Check if closing the latest year and next year does not exist, add next year as active
      if (yearData.status === 'مغلقة') {
        const sortedYears = [...updated].sort((a, b) => b.year - a.year);
        const isLatest = editYear.year === sortedYears[0].year;
        const nextYear = editYear.year + 1;
        const nextYearExists = updated.some(y => y.year === nextYear);
        if (isLatest && !nextYearExists) {
          const startDate = `${nextYear}-01-01`;
          const endDate = `${nextYear}-12-31`;
          try {
            const addFinancialYear = (await import('@/services/financialYearsService')).addFinancialYear;
            await addFinancialYear({
              year: nextYear,
              startDate,
              endDate,
              status: 'مفتوحة'
            });
            updated = await getFinancialYears();
          } catch (e) {
            // ignore if service not available
          }
        }
      }
      setFinancialYears(updated.sort((a, b) => b.year - a.year));
      setEditYear(null);
      setIsAddModalOpen(false);
    } else {
      // إضافة
      // سيتم إضافة السنة من خلال AddFinancialYearModal مباشرة
      const updated = await getFinancialYears();
      setFinancialYears(updated.sort((a, b) => b.year - a.year));
      setIsAddModalOpen(false);
    }
  };

  const handleExport = () => {
    const csvData = financialYears.map(year => ({
      'السنة الميلادية': year.year,
      'بداية السنة': formatDate(year.startDate),
      'نهاية السنة': formatDate(year.endDate),
      'الحالة': year.status,
      'تاريخ الإنشاء': formatDate(year.createdAt)
    }));

    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `السنوات_المالية_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEdit = (year: FinancialYear) => {
    setEditYear(year);
    setIsAddModalOpen(true);
  };

  const handleDelete = (id: string) => {
    const year = financialYears.find(y => y.id === id);
    if (year) {
      setDeleteConfirm({
        isOpen: true,
        yearId: id,
        yearName: `${year.year}`
      });
    }
  };

  const confirmDelete = async () => {
    await deleteFinancialYear(deleteConfirm.yearId);
    const updated = await getFinancialYears();
    setFinancialYears(updated.sort((a, b) => b.year - a.year));
    setDeleteConfirm({isOpen: false, yearId: '', yearName: ''});
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'مفتوحة': { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', text: 'مفتوحة' },
      'مغلقة': { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', text: 'مغلقة' }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || { color: 'bg-gray-100 text-gray-800', text: status };
    return (
      <Badge className={`${config.color} hover:${config.color} rounded-md px-2 py-1 text-xs`}>
        {config.text}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="w-full p-6 space-y-6 min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800" dir="rtl">
      {/* Header */}
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
          <Calendar className="h-8 w-8 text-blue-600 dark:text-blue-300" />
        </div>
        <div className="flex flex-col ">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">اعدادات السنوات المالية</h1>
          <p className="text-gray-600 dark:text-gray-400">إدارة السنوات المالية والحالة المالية</p>
        </div>
      </div>
          
          {/* السنة المالية Dropdown */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <span className="flex items-center gap-2">
            <Calendar className="text-purple-600 dark:text-purple-300 w-6 h-6" />
              <label className="text-base font-medium text-gray-700 dark:text-gray-300">السنة المالية:</label>
            </span>
            <div className="min-w-[160px]">
              <AntdSelect
                value={fiscalYear}
                onChange={handleFiscalYearChange}
                style={{ 
                  width: 160, 
                  height: 40, 
                  fontSize: 16, 
                  borderRadius: 8, 
                  background: '#fff', 
                  textAlign: 'right', 
                  boxShadow: '0 1px 6px rgba(0,0,0,0.07)', 
                  border: '1px solid #e2e8f0'
                }}
                dropdownStyle={{ textAlign: 'right', fontSize: 16 }}
                size="middle"
                placeholder="السنة المالية"
              >
                {activeYears && activeYears.map(y => (
                  <AntdSelect.Option key={y.id} value={y.year.toString()}>{y.year}</AntdSelect.Option>
                ))}
              </AntdSelect>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-purple-500"></div>
      </div>
      
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "الادارة الماليه", to: "/management/financial" }, 
          { label: "السنوات المالية" }
        ]}
      />

      <Card className="border border-gray-200 dark:border-gray-700 shadow-lg bg-white rounded-xl overflow-hidden">
        <CardHeader className="bg-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold text-gray-800 dark:text-white">قائمة السنوات المالية</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                عرض وتعديل السنوات المالية المسجلة في النظام
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <Button 
                onClick={handleAddYear}
                className="flex items-center space-x-2 space-x-reverse bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة سنة مالية</span>
              </Button>
              <Button 
                onClick={handleExport}
                className="flex items-center space-x-2 space-x-reverse bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>تصدير</span>
              </Button>
            </div>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            إجمالي السنوات المالية: <span className="font-medium text-purple-600 dark:text-purple-400">{financialYears.length}</span>
            {/* تم حذف تحذير إغلاق السنة المالية */}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <AntdTable
              dataSource={financialYears}
              rowKey="id"
              pagination={false}
              locale={{ emptyText: (
                <div className="text-center py-12">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                    <Calendar className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">لا توجد سنوات مالية</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    لم يتم إضافة أي سنوات مالية بعد.
                  </p>
                  <div className="mt-6">
                    <Button 
                      onClick={handleAddYear}
                      className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة سنة مالية
                    </Button>
                  </div>
                </div>
              )}}
              columns={[
                {
                  title: 'السنة الميلادية',
                  dataIndex: 'year',
                  key: 'year',
                  align: 'right',
                  render: (text: number) => <span className="font-medium text-right text-gray-900 dark:text-white">{text}</span>
                },
                {
                  title: 'بداية السنة',
                  dataIndex: 'startDate',
                  key: 'startDate',
                  align: 'right',
                  render: (date: string) => <span className="text-right text-gray-700 dark:text-gray-300">{formatDate(date)}</span>
                },
                {
                  title: 'نهاية السنة',
                  dataIndex: 'endDate',
                  key: 'endDate',
                  align: 'right',
                  render: (date: string) => <span className="text-right text-gray-700 dark:text-gray-300">{formatDate(date)}</span>
                },
                {
                  title: 'الحالة',
                  dataIndex: 'status',
                  key: 'status',
                  align: 'right',
                  render: (status: string) => getStatusBadge(status)
                },
                {
                  title: 'تاريخ الإنشاء',
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  align: 'right',
                  render: (date: string) => <span className="text-right text-gray-700 dark:text-gray-300">{formatDate(date)}</span>
                },
                {
                  title: 'الإجراءات',
                  key: 'actions',
                  align: 'right',
                  render: (_: unknown, year: FinancialYear) => (
                    <SwitchCell year={year} isActionDisabled={isActionDisabled} handleEdit={handleEdit} handleDelete={handleDelete} />
                  )
// مكون للسويتش مع حالة محلية لكل صف
          }
        ]}
        className="min-w-full bg-transparent custom-table-header"
      />
          </div>
        </CardContent>
      </Card>

      {/* Add Financial Year Modal */}
      <AddFinancialYearModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setEditYear(null); }}
        onSave={handleSaveYear}
        existingYears={financialYears.map(year => year.year)}
        saveButtonClassName="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white transition-all duration-200"
        fieldsLocked={!!editYear}
        {...(editYear ? {
          initialData: {
            year: editYear.year,
            startDay: editYear.startDate.split('-')[2],
            startMonth: editYear.startDate.split('-')[1],
            startYear: editYear.startDate.split('-')[0],
            endDay: editYear.endDate.split('-')[2],
            endMonth: editYear.endDate.split('-')[1],
            endYear: editYear.endDate.split('-')[0],
            status: editYear.status
          }
        } : {})}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/30 backdrop-blur-sm p-4"
          dir="rtl"
        >
          <Card className="max-w-md w-full mx-auto border border-gray-200 dark:border-gray-700 shadow-2xl">
            <CardHeader>
              <div className="flex items-center space-x-2 space-x-reverse">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <CardTitle className="text-red-600">تأكيد الحذف</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-gray-700 dark:text-gray-300">
                هل أنت متأكد من رغبتك في حذف السنة المالية <strong className="text-gray-900 dark:text-white">{deleteConfirm.yearName}</strong>؟
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                سيتم حذف السنة المالية بشكل دائم ولن يمكنك استرجاعها لاحقاً.
              </p>
              <div className="flex items-center justify-end space-x-2 space-x-reverse">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm({isOpen: false, yearId: '', yearName: ''})}
                  className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  إلغاء
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  className="flex items-center space-x-2 space-x-reverse transition-all duration-200"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>حذف</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FinancialYearsPage;