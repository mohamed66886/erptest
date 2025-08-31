
import { useState, useEffect } from 'react';
import { addFinancialYear } from '@/services/financialYearsService';
import { X, Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select as AntdSelect } from 'antd';

interface AddFinancialYearModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (yearData: {
    year: number;
    startDate: string;
    endDate: string;
    status: string;
  }) => void;
  existingYears: number[];
  initialData?: {
    year: number;
    startDay: string;
    startMonth: string;
    startYear: string;
    endDay: string;
    endMonth: string;
    endYear: string;
    status: string;
  };
  saveButtonClassName?: string;
  fieldsLocked?: boolean;
}

const AddFinancialYearModal: React.FC<AddFinancialYearModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingYears,
  initialData,
  saveButtonClassName,
  fieldsLocked = false
}) => {
  const currentYear = new Date().getFullYear();
  const yearsList = Array.from({length: 20}, (_, i) => (currentYear - 10 + i).toString());
  const monthsList = [
    { value: '01', label: 'يناير' },
    { value: '02', label: 'فبراير' },
    { value: '03', label: 'مارس' },
    { value: '04', label: 'أبريل' },
    { value: '05', label: 'مايو' },
    { value: '06', label: 'يونيو' },
    { value: '07', label: 'يوليو' },
    { value: '08', label: 'أغسطس' },
    { value: '09', label: 'سبتمبر' },
    { value: '10', label: 'أكتوبر' },
    { value: '11', label: 'نوفمبر' },
    { value: '12', label: 'ديسمبر' },
  ];
  const daysList = Array.from({length: 31}, (_, i) => (i+1).toString().padStart(2, '0'));

  const [formData, setFormData] = useState(() => initialData ? initialData : {
    year: currentYear,
    startDay: '01',
    startMonth: '01',
    startYear: currentYear.toString(),
    endDay: '31',
    endMonth: '12',
    endYear: currentYear.toString(),
    status: 'معلقة'
  });
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        year: currentYear,
        startDay: '01',
        startMonth: '01',
        startYear: currentYear.toString(),
        endDay: '31',
        endMonth: '12',
        endYear: currentYear.toString(),
        status: 'معلقة'
      });
    }
  }, [initialData, isOpen, currentYear]);

  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    setIsSaving(true);
    // Validation
    const newErrors: {[key: string]: string} = {};
    const startDate = `${formData.startYear}-${formData.startMonth}-${formData.startDay}`;
    const endDate = `${formData.endYear}-${formData.endMonth}-${formData.endDay}`;
    if (!formData.year || Number(formData.year) < 1900 || Number(formData.year) > 2100) {
      newErrors.year = 'يرجى اختيار سنة صحيحة';
    }
    if (!initialData && existingYears.includes(Number(formData.year))) {
      newErrors.year = 'هذه السنة موجودة بالفعل';
    }
    if (!startDate) {
      newErrors.startDate = 'يرجى اختيار تاريخ بداية السنة';
    }
    if (!endDate) {
      newErrors.endDate = 'يرجى اختيار تاريخ نهاية السنة';
    }
    if (startDate && endDate && startDate >= endDate) {
      newErrors.endDate = 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      const yearData = {
        year: Number(formData.year),
        startDate,
        endDate,
        status: formData.status
      };
      try {
        if (!initialData) {
          await addFinancialYear(yearData);
        }
        onSave(yearData);
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          handleClose();
        }, 1200);
      } catch (err) {
        setErrors({ firebase: 'حدث خطأ أثناء الحفظ في قاعدة البيانات' });
      }
    }
    setIsSaving(false);
  };

  const handleClose = () => {
    setFormData({
      year: currentYear,
      startDay: '01',
      startMonth: '01',
      startYear: currentYear.toString(),
      endDay: '31',
      endMonth: '12',
      endYear: currentYear.toString(),
      status: 'معلقة'
    });
    setErrors({});
    onClose();
  };

  // تحديث السنة الميلادية الرئيسية
  const handleYearChange = (year: string) => {
    setFormData({
      ...formData,
      year: Number(year),
      startYear: year,
      endYear: year
    });
  };

  if (!isOpen) return null;


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
      <Card className="w-full max-w-md mx-4">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">إضافة سنة مالية جديدة</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Year Select */}
            <div className="space-y-2">
              <Label htmlFor="year">السنة الميلادية</Label>
              <AntdSelect
                value={formData.year.toString()}
                onChange={(value: string) => handleYearChange(value)}
                placeholder="اختر السنة"
                style={{ width: '100%' }}
                disabled={fieldsLocked}
              >
                {yearsList.map(y => (
                  <AntdSelect.Option key={y} value={y}>{y}</AntdSelect.Option>
                ))}
              </AntdSelect>
              {errors.year && (
                <p className="text-sm text-red-600">{errors.year}</p>
              )}
            </div>

            {/* Start Date Select */}
            <div className="space-y-2">
              <Label>بداية السنة المالية</Label>
              <div className="flex gap-2">
                <AntdSelect
                  value={formData.startDay}
                  onChange={(value: string) => setFormData({...formData, startDay: value})}
                  style={{ width: 80 }}
                  disabled={fieldsLocked}
                >
                  {daysList.map(day => (
                    <AntdSelect.Option key={day} value={day}>{day}</AntdSelect.Option>
                  ))}
                </AntdSelect>
                <AntdSelect
                  value={formData.startMonth}
                  onChange={(value: string) => setFormData({...formData, startMonth: value})}
                  style={{ width: 120 }}
                  disabled={fieldsLocked}
                >
                  {monthsList.map(month => (
                    <AntdSelect.Option key={month.value} value={month.value}>{month.label}</AntdSelect.Option>
                  ))}
                </AntdSelect>
                <AntdSelect
                  value={formData.startYear}
                  onChange={(value: string) => setFormData({...formData, startYear: value})}
                  style={{ width: 100 }}
                  disabled={fieldsLocked}
                >
                  {yearsList.map(y => (
                    <AntdSelect.Option key={y} value={y}>{y}</AntdSelect.Option>
                  ))}
                </AntdSelect>
              </div>
              {errors.startDate && (
                <p className="text-sm text-red-600">{errors.startDate}</p>
              )}
            </div>

            {/* End Date Select */}
            <div className="space-y-2">
              <Label>نهاية السنة المالية</Label>
              <div className="flex gap-2">
                <AntdSelect
                  value={formData.endDay}
                  onChange={(value: string) => setFormData({...formData, endDay: value})}
                  style={{ width: 80 }}
                  disabled={fieldsLocked}
                >
                  {daysList.map(day => (
                    <AntdSelect.Option key={day} value={day}>{day}</AntdSelect.Option>
                  ))}
                </AntdSelect>
                <AntdSelect
                  value={formData.endMonth}
                  onChange={(value: string) => setFormData({...formData, endMonth: value})}
                  style={{ width: 120 }}
                  disabled={fieldsLocked}
                >
                  {monthsList.map(month => (
                    <AntdSelect.Option key={month.value} value={month.value}>{month.label}</AntdSelect.Option>
                  ))}
                </AntdSelect>
                <AntdSelect
                  value={formData.endYear}
                  onChange={(value: string) => setFormData({...formData, endYear: value})}
                  style={{ width: 100 }}
                  disabled={fieldsLocked}
                >
                  {yearsList.map(y => (
                    <AntdSelect.Option key={y} value={y}>{y}</AntdSelect.Option>
                  ))}
                </AntdSelect>
              </div>
              {errors.endDate && (
                <p className="text-sm text-red-600">{errors.endDate}</p>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">حالة السنة المالية</Label>
              <AntdSelect
                value={formData.status}
                onChange={(value: string) => setFormData({...formData, status: value})}
                style={{ width: '100%' }}
              >
                <AntdSelect.Option value="مفتوحة">مفتوحة</AntdSelect.Option>
                <AntdSelect.Option value="مغلقة">مغلقة</AntdSelect.Option>
              </AntdSelect>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-2 space-x-reverse pt-4">
              <Button
                type="button"
                onClick={handleClose}
                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white"
                disabled={isSaving}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                className={`flex items-center space-x-2 space-x-reverse ${saveButtonClassName ? saveButtonClassName : ''}`}
                disabled={isSaving}
              >
                {isSaving ? (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{isSaving ? 'جاري الحفظ...' : saveSuccess ? 'تم الحفظ' : 'حفظ'}</span>
              </Button>
            </div>
            {saveSuccess && (
              <div className="text-green-600 text-center mt-2">تم الحفظ بنجاح</div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddFinancialYearModal;
