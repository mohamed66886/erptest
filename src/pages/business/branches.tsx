import React, { useEffect, useState } from 'react';
import { Edit, Trash2, Plus, Building2, ChevronDown, ChevronUp, Upload, Download } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Breadcrumb from '@/components/Breadcrumb';
import * as XLSX from 'xlsx';
import { message } from 'antd';

interface Branch {
  id?: string;
  code: string;
  name: string;
  address: string;
  taxFile: string;
  commercialReg: string;
  postalCode: string;
  poBox: string;
  manager: string;
}

const Branches: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Branch>({ 
    code: '', 
    name: '', 
    address: '', 
    taxFile: '', 
    commercialReg: '', 
    postalCode: '', 
    poBox: '', 
    manager: '' 
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchBranches();
    fetchManagers();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    const querySnapshot = await getDocs(collection(db, 'branches'));
    setBranches(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
    setLoading(false);
  };

  const fetchManagers = async () => {
    const querySnapshot = await getDocs(collection(db, 'managers'));
    setManagers(querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const existingBranch = branches.find(b =>
      (b.name.toLowerCase() === form.name.toLowerCase() || b.code === form.code) &&
      b.id !== editId
    );
    
    if (existingBranch) {
      alert('اسم الفرع أو رقم الفرع موجود بالفعل، يرجى اختيار اسم/رقم آخر');
      return;
    }
    
    try {
      if (editId) {
        const { id, ...branchData } = form;
        await updateDoc(doc(db, 'branches', editId), branchData);
      } else {
        await addDoc(collection(db, 'branches'), form);
      }
      setShowForm(false);
      setForm({ code: '', name: '', address: '', taxFile: '', commercialReg: '', postalCode: '', poBox: '', manager: '' });
      setEditId(null);
      fetchBranches();
    } catch (error) {
      console.error('Error saving branch:', error);
      alert('حدث خطأ أثناء حفظ بيانات الفرع');
    }
  };

  const handleEdit = (branch: Branch) => {
    setForm(branch);
    setEditId(branch.id!);
    setShowForm(true);
    setExpandedBranch(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الفرع؟ سيتم حذف جميع البيانات المرتبطة به.')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'branches', id));
      fetchBranches();
    } catch (error) {
      console.error('Error deleting branch:', error);
      alert('حدث خطأ أثناء حذف الفرع');
    }
  };

  const toggleExpandBranch = (id: string) => {
    setExpandedBranch(expandedBranch === id ? null : id);
  };

  // دالة تصدير الفروع إلى Excel
  const handleExportToExcel = () => {
    try {
      setExporting(true);
      
      // تحضير البيانات للتصدير (رقم الفرع واسم الفرع فقط)
      const exportData = branches.map(branch => ({
        'رقم الفرع': branch.code,
        'اسم الفرع': branch.name
      }));

      // إنشاء ورقة عمل
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // تعيين عرض الأعمدة
      const columnWidths = [
        { wch: 15 }, // رقم الفرع
        { wch: 30 }  // اسم الفرع
      ];
      worksheet['!cols'] = columnWidths;

      // إنشاء كتاب عمل
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'الفروع');

      // تنزيل الملف
      XLSX.writeFile(workbook, `الفروع_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      message.success('تم تصدير الفروع بنجاح');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      message.error('حدث خطأ أثناء تصدير الملف');
    } finally {
      setExporting(false);
    }
  };

  // دالة استيراد الفروع من Excel
  const handleImportFromExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التحقق من نوع الملف
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (!validTypes.includes(file.type)) {
      message.error('يرجى اختيار ملف Excel صحيح (.xlsx أو .xls)');
      e.target.value = '';
      return;
    }

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

        if (jsonData.length === 0) {
          message.warning('الملف فارغ، لا توجد بيانات للاستيراد');
          setImporting(false);
          e.target.value = '';
          return;
        }

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        // معالجة كل صف
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          // استخراج البيانات من الأعمدة (رقم الفرع واسم الفرع فقط)
          const branchCode = row['رقم الفرع'] || row['code'] || row['Code'];
          const branchName = row['اسم الفرع'] || row['name'] || row['Name'];

          // التحقق من البيانات الأساسية
          if (!branchCode || !branchName) {
            errors.push(`الصف ${i + 2}: رقم الفرع واسم الفرع مطلوبان`);
            errorCount++;
            continue;
          }

          // التحقق من عدم تكرار رقم الفرع أو اسم الفرع
          const existingBranch = branches.find(b => 
            b.code === String(branchCode) || b.name.toLowerCase() === String(branchName).toLowerCase()
          );

          if (existingBranch) {
            errors.push(`الصف ${i + 2}: الفرع "${branchName}" أو الرقم "${branchCode}" موجود بالفعل`);
            errorCount++;
            continue;
          }

          try {
            // إضافة الفرع إلى قاعدة البيانات (رقم الفرع واسم الفرع فقط)
            await addDoc(collection(db, 'branches'), {
              code: String(branchCode),
              name: String(branchName),
              address: '',
              taxFile: '',
              commercialReg: '',
              postalCode: '',
              poBox: '',
              manager: ''
            });
            
            successCount++;
          } catch (error) {
            console.error(`Error importing branch at row ${i + 2}:`, error);
            errors.push(`الصف ${i + 2}: حدث خطأ أثناء الحفظ`);
            errorCount++;
          }
        }

        // عرض النتائج
        if (successCount > 0) {
          message.success(`تم استيراد ${successCount} فرع بنجاح`);
          fetchBranches(); // إعادة تحميل الفروع
        }
        
        if (errorCount > 0) {
          message.warning(`فشل استيراد ${errorCount} فرع. ${errors.slice(0, 3).join(', ')}`);
          console.log('Import errors:', errors);
        }

      } catch (error) {
        console.error('Error processing Excel file:', error);
        message.error('حدث خطأ أثناء قراءة الملف');
      } finally {
        setImporting(false);
        e.target.value = ''; // إعادة تعيين input
      }
    };

    reader.onerror = () => {
      message.error('حدث خطأ أثناء قراءة الملف');
      setImporting(false);
      e.target.value = '';
    };

    reader.readAsBinaryString(file);
  };

  // دالة تنزيل نموذج Excel
  const handleDownloadTemplate = () => {
    try {
      // إنشاء نموذج بصف واحد كمثال (رقم الفرع واسم الفرع فقط)
      const templateData = [
        {
          'رقم الفرع': '1',
          'اسم الفرع': 'الفرع الرئيسي'
        },
        {
          'رقم الفرع': '2',
          'اسم الفرع': 'فرع القاهرة'
        },
        {
          'رقم الفرع': '3',
          'اسم الفرع': 'فرع الإسكندرية'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      
      // تعيين عرض الأعمدة
      const columnWidths = [
        { wch: 15 }, // رقم الفرع
        { wch: 30 }  // اسم الفرع
      ];
      worksheet['!cols'] = columnWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'نموذج الفروع');

      XLSX.writeFile(workbook, 'نموذج_استيراد_الفروع.xlsx');
      message.success('تم تنزيل النموذج بنجاح');
    } catch (error) {
      console.error('Error downloading template:', error);
      message.error('حدث خطأ أثناء تنزيل النموذج');
    }
  };

  return (
    <div className="p-4 space-y-6 font-['Tajawal'] bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="p-4 font-['Tajawal'] bg-white rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">اداره الفروع</h1>
          <span className="animate-[wave_2s_infinite] text-2xl md:text-3xl">👋</span>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-purple-500 animate-[pulse_3s_infinite]"></div>
      </div>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "ادارة الفروع" }
        ]}
      />

      {/* Add Branch Button - Mobile & Desktop */}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        {/* Import/Export Buttons */}
        <div className="flex gap-2">
          {/* استيراد من Excel */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportFromExcel}
              className="hidden"
              disabled={importing}
            />
            <div className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 px-4 py-2 rounded-md shadow-md transition-all duration-300 hover:shadow-lg">
              <Upload className="w-4 h-4" />
              <span className="hidden md:inline">{importing ? 'جاري الاستيراد...' : 'استيراد من Excel'}</span>
              <span className="md:hidden">{importing ? '...' : 'استيراد'}</span>
            </div>
          </label>

          {/* تنزيل نموذج */}
          <Button
            onClick={handleDownloadTemplate}
            className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 px-4 py-2 rounded-md shadow-md transition-all duration-300 hover:shadow-lg"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">تنزيل نموذج</span>
            <span className="md:hidden">نموذج</span>
          </Button>

          {/* تصدير إلى Excel */}
          <Button
            onClick={handleExportToExcel}
            disabled={exporting || branches.length === 0}
            className="bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2 px-4 py-2 rounded-md shadow-md transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">{exporting ? 'جاري التصدير...' : 'تصدير إلى Excel'}</span>
            <span className="md:hidden">{exporting ? '...' : 'تصدير'}</span>
          </Button>
        </div>

        {/* Add Branch Button */}
        <Button
          onClick={() => {
            const maxCode = branches.length > 0 ? Math.max(...branches.map(b => parseInt(b.code, 10) || 0)) : 0;
            setForm({ 
              code: String(maxCode + 1), 
              name: '', 
              address: '', 
              taxFile: '', 
              commercialReg: '', 
              postalCode: '', 
              poBox: '', 
              manager: '' 
            });
            setShowForm(true);
            setEditId(null);
            setExpandedBranch(null);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 px-4 py-2 md:px-8 md:py-2 rounded-md shadow-md transition-all duration-300 hover:shadow-lg"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden md:inline">إضافة فرع</span>
          <span className="md:inline">إضافة</span>
        </Button>
      </div>

      {/* Form Section */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 border border-gray-200 mb-4">
          <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6">
            {editId ? 'تعديل الفرع' : 'إضافة فرع جديد'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            {/* Form Fields */}
            <div>
              <Label className="block text-sm font-medium text-gray-800 mb-1 md:mb-2">رقم الفرع</Label>
              <Input
                name="code"
                value={form.code}
                disabled
                required
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="يتم توليده تلقائيًا"
                className="border-gray-300 focus:ring-2 bg-gray-50 text-gray-800 text-sm md:text-base"
              />
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-800 mb-1 md:mb-2">اسم الفرع</Label>
              <Input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="border-gray-300 focus:ring-2 bg-gray-50 text-gray-800 text-sm md:text-base"
              />
            </div>
            
            <div className="md:col-span-2">
              <Label className="block text-sm font-medium text-gray-800 mb-1 md:mb-2">العنوان</Label>
              <Input
                name="address"
                value={form.address}
                onChange={handleChange}
                required
                className="border-gray-300 focus:ring-2 bg-gray-50 text-gray-800 text-sm md:text-base"
              />
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-800 mb-1 md:mb-2">الملف الضريبي</Label>
              <Input 
                name="taxFile" 
                value={form.taxFile} 
                onChange={handleChange} 
                required 
                inputMode="numeric" 
                pattern="[0-9]*" 
                className="border-gray-300 focus:ring-2 bg-gray-50 text-gray-800 text-sm md:text-base" 
              />
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-800 mb-1 md:mb-2">السجل التجاري</Label>
              <Input 
                name="commercialReg" 
                value={form.commercialReg} 
                onChange={handleChange} 
                required 
                inputMode="numeric" 
                pattern="[0-9]*" 
                className="border-gray-300 focus:ring-2 bg-gray-50 text-gray-800 text-sm md:text-base" 
              />
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-800 mb-1 md:mb-2">الرمز البريدي</Label>
              <Input 
                name="postalCode" 
                value={form.postalCode} 
                onChange={handleChange} 
                required 
                inputMode="numeric" 
                pattern="[0-9]*" 
                className="border-gray-300 focus:ring-2 bg-gray-50 text-gray-800 text-sm md:text-base" 
              />
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-800 mb-1 md:mb-2">الصندوق البريدي</Label>
              <Input 
                name="poBox" 
                value={form.poBox} 
                onChange={handleChange} 
                required 
                inputMode="numeric" 
                pattern="[0-9]*" 
                className="border-gray-300 focus:ring-2 bg-gray-50 text-gray-800 text-sm md:text-base" 
              />
            </div>
            
            <div className="md:col-span-2">
              <Label className="block text-sm font-medium text-gray-800 mb-1 md:mb-2">اسم المدير المسؤول</Label>
              <select 
                name="manager" 
                value={form.manager} 
                onChange={handleChange} 
                required 
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 bg-gray-50 text-gray-800 text-sm md:text-base"
              >
                <option value="">اختر المدير</option>
                {managers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            
            {/* Form Buttons */}
            <div className="md:col-span-2 flex gap-3 justify-end mt-2 md:mt-4">
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-8 transition-all duration-300 hover:scale-105 text-sm md:text-base"
              >
                {editId ? 'تعديل' : 'إضافة'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => { setShowForm(false); setEditId(null); }} 
                className="border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all duration-300 text-sm md:text-base"
              >
                إلغاء
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Branches List - Mobile View */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-700 font-medium">جاري التحميل...</div>
        ) : branches.length === 0 ? (
          <div className="text-center py-8 text-gray-500">لا يوجد فروع</div>
        ) : branches.map((branch) => (
          <div key={branch.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
            <div 
              className="p-4 flex justify-between items-center cursor-pointer"
              onClick={() => toggleExpandBranch(branch.id!)}
            >
              <div>
                <h3 className="font-bold text-gray-800">{branch.name}</h3>
                <p className="text-sm text-gray-600">{branch.manager}</p>
              </div>
              <div className="flex items-center">
                {expandedBranch === branch.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </div>
            </div>
            
            {expandedBranch === branch.id && (
              <div className="p-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">رقم الفرع</p>
                    <p className="text-sm font-medium">{branch.code}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">العنوان</p>
                    <p className="text-sm font-medium">{branch.address}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">الملف الضريبي</p>
                    <p className="text-sm font-medium">{branch.taxFile}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">السجل التجاري</p>
                    <p className="text-sm font-medium">{branch.commercialReg}</p>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <Button
                    variant="ghost"
                    className="text-blue-600 hover:bg-blue-50/80 p-2"
                    onClick={() => handleEdit(branch)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="text-red-600 hover:bg-red-50/80 p-2" 
                    onClick={() => handleDelete(branch.id!)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Branches Table - Desktop View */}
      <div className="hidden md:block bg-white rounded-lg shadow-xl overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-center">
            <thead>
              <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <th className="px-4 py-3 text-sm font-medium border-b border-blue-800">رقم الفرع</th>
                <th className="px-4 py-3 text-sm font-medium border-b border-blue-800">اسم الفرع</th>
                <th className="px-4 py-3 text-sm font-medium border-b border-blue-800">المدير المسؤول</th>
                <th className="px-4 py-3 text-sm font-medium border-b border-blue-800">العنوان</th>
                <th className="px-4 py-3 text-sm font-medium border-b border-blue-800">العمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-700 font-medium">جاري التحميل...</td></tr>
              ) : branches.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">لا يوجد فروع</td></tr>
              ) : branches.map((branch, idx) => (
                <tr key={branch.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                  <td className="px-4 py-3 text-sm border-b border-gray-200">{branch.code}</td>
                  <td className="px-4 py-3 text-sm border-b border-gray-200">{branch.name}</td>
                  <td className="px-4 py-3 text-sm border-b border-gray-200">{branch.manager}</td>
                  <td className="px-4 py-3 text-sm border-b border-gray-200">{branch.address}</td>
                  <td className="px-4 py-3 text-sm border-b border-gray-200">
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="ghost"
                        className="text-blue-600 hover:bg-blue-50/80 p-2"
                        onClick={() => handleEdit(branch)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="text-red-600 hover:bg-red-50/80 p-2" 
                        onClick={() => handleDelete(branch.id!)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Branches;