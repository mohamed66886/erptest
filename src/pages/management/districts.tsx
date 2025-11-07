import React, { useState, useEffect, useMemo } from 'react';
import { Table, Input, Button, Modal, Form, message, Space, Popconfirm, Select, Upload } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, PrinterOutlined, DownloadOutlined, UploadOutlined, FileExcelOutlined } from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Breadcrumb from '@/components/Breadcrumb';
import { Helmet } from 'react-helmet';
import { MapPinned } from 'lucide-react';
import dayjs from 'dayjs';
import { useFinancialYear } from '@/hooks/useFinancialYear';

interface Governorate {
  id: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
}

interface Region {
  id: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
  governorateId: string;
  governorateName?: string;
}

interface District {
  id: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
  regionId: string;
  regionName?: string;
  governorateId: string;
  governorateName?: string;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
}

const Districts: React.FC = () => {
  const [districts, setDistricts] = useState<District[]>([]);
  const [filteredDistricts, setFilteredDistricts] = useState<District[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [filteredRegions, setFilteredRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
  const [form] = Form.useForm();
  const [importLoading, setImportLoading] = useState(false);

  // السنة المالية من السياق العام
  const { currentFinancialYear, setCurrentFinancialYear, activeYears } = useFinancialYear();
  const [fiscalYear, setFiscalYear] = useState<string>("");

  useEffect(() => {
    if (currentFinancialYear) {
      setFiscalYear(currentFinancialYear.year.toString());
    }
  }, [currentFinancialYear]);

  const handleFiscalYearChange = (value: string) => {
    setFiscalYear(value);
    if (activeYears && setCurrentFinancialYear) {
      const selectedYear = activeYears.find(y => y.year.toString() === value);
      if (selectedYear) {
        setCurrentFinancialYear(selectedYear);
      }
    }
  };

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(30);

  // ستايل موحد للإدخال والدروب داون
  const largeControlStyle = {
    height: 48,
    fontSize: 18,
    borderRadius: 8,
    padding: '8px 16px',
    boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
    background: '#fff',
    border: '1.5px solid #d9d9d9',
    transition: 'border-color 0.3s',
  };
  const labelStyle = { fontSize: 18, fontWeight: 500, marginBottom: 2, display: 'block' };

  // جلب المحافظات من Firebase
  const fetchGovernorates = async () => {
    try {
      const q = query(collection(db, 'governorates'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Governorate[];
      setGovernorates(data);
    } catch (error) {
      console.error('Error fetching governorates:', error);
      message.error('حدث خطأ في جلب المحافظات');
    }
  };

  // جلب المناطق من Firebase
  const fetchRegions = async () => {
    try {
      const q = query(collection(db, 'regions'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => {
        const regionData = doc.data();
        const governorate = governorates.find(g => g.id === regionData.governorateId);
        return {
          id: doc.id,
          ...regionData,
          governorateName: governorate ? (governorate.nameAr || governorate.name) : regionData.governorateName || ''
        };
      }) as Region[];
      setRegions(data);
    } catch (error) {
      console.error('Error fetching regions:', error);
      message.error('حدث خطأ في جلب المناطق');
    }
  };

  // جلب الأحياء من Firebase
  const fetchDistricts = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'districts'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => {
        const districtData = doc.data();
        const region = regions.find(r => r.id === districtData.regionId);
        const governorate = governorates.find(g => g.id === districtData.governorateId);
        return {
          id: doc.id,
          ...districtData,
          regionName: region ? (region.nameAr || region.name) : districtData.regionName || '',
          governorateName: governorate ? (governorate.nameAr || governorate.name) : districtData.governorateName || ''
        };
      }) as District[];
      setDistricts(data);
      setFilteredDistricts(data);
    } catch (error) {
      console.error('Error fetching districts:', error);
      message.error('حدث خطأ في جلب البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGovernorates();
  }, []);

  useEffect(() => {
    if (governorates.length > 0) {
      fetchRegions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governorates]);

  useEffect(() => {
    if (regions.length > 0) {
      fetchDistricts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions]);

  // البحث في الأحياء
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredDistricts(districts);
      setCurrentPage(1);
      return;
    }

    const filtered = districts.filter(district => 
      district.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      district.nameAr?.toLowerCase().includes(searchText.toLowerCase()) ||
      district.nameEn?.toLowerCase().includes(searchText.toLowerCase()) ||
      district.regionName?.toLowerCase().includes(searchText.toLowerCase()) ||
      district.governorateName?.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredDistricts(filtered);
    setCurrentPage(1);
  }, [searchText, districts]);

  // البيانات المقسمة على صفحات
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredDistricts.slice(startIndex, endIndex);
  }, [filteredDistricts, currentPage, pageSize]);

  // تصفية المناطق حسب المحافظة المختارة
  const handleGovernorateChange = (governorateId: string) => {
    const filtered = regions.filter(r => r.governorateId === governorateId);
    setFilteredRegions(filtered);
    form.setFieldsValue({ regionId: undefined });
  };

  // فتح المودال للإضافة أو التعديل
  const handleOpenModal = (district?: District) => {
    if (district) {
      setEditingDistrict(district);
      const filtered = regions.filter(r => r.governorateId === district.governorateId);
      setFilteredRegions(filtered);
      form.setFieldsValue({
        name: district.name,
        nameAr: district.nameAr,
        nameEn: district.nameEn,
        governorateId: district.governorateId,
        regionId: district.regionId
      });
    } else {
      setEditingDistrict(null);
      setFilteredRegions([]);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  // إغلاق المودال
  const handleCloseModal = () => {
    setIsModalVisible(false);
    setEditingDistrict(null);
    setFilteredRegions([]);
    form.resetFields();
  };

  // حفظ الحي (إضافة أو تعديل)
  interface FormValues {
    name: string;
    nameAr?: string;
    nameEn?: string;
    governorateId: string;
    regionId: string;
  }

  const handleSave = async (values: FormValues) => {
    try {
      const region = regions.find(r => r.id === values.regionId);
      const governorate = governorates.find(g => g.id === values.governorateId);
      const regionName = region ? (region.nameAr || region.name) : '';
      const governorateName = governorate ? (governorate.nameAr || governorate.name) : '';

      if (editingDistrict) {
        // تعديل حي موجود
        const docRef = doc(db, 'districts', editingDistrict.id);
        await updateDoc(docRef, {
          name: values.name,
          nameAr: values.nameAr || values.name,
          nameEn: values.nameEn || '',
          governorateId: values.governorateId,
          governorateName: governorateName,
          regionId: values.regionId,
          regionName: regionName,
          updatedAt: Timestamp.now()
        });
        message.success('تم تحديث الحي بنجاح');
      } else {
        // إضافة حي جديد
        await addDoc(collection(db, 'districts'), {
          name: values.name,
          nameAr: values.nameAr || values.name,
          nameEn: values.nameEn || '',
          governorateId: values.governorateId,
          governorateName: governorateName,
          regionId: values.regionId,
          regionName: regionName,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        message.success('تم إضافة الحي بنجاح');
      }
      handleCloseModal();
      fetchDistricts();
    } catch (error) {
      console.error('Error saving district:', error);
      message.error('حدث خطأ في حفظ البيانات');
    }
  };

  // حذف حي
  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'districts', id));
      message.success('تم حذف الحي بنجاح');
      fetchDistricts();
    } catch (error) {
      console.error('Error deleting district:', error);
      message.error('حدث خطأ في حذف الحي');
    }
  };

  // تحميل نموذج Excel
  const handleDownloadTemplate = () => {
    const template = [
      ['الحي', 'المنطقة', 'المحافظة'],
      ['مثال: حي النزهة', 'مثال: شرق الرياض', 'مثال: الرياض'],
      ['', '', '']
    ];

    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.aoa_to_sheet(template);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'نموذج الأحياء');
      
      // تنسيق العرض
      ws['!cols'] = [
        { wch: 30 },
        { wch: 30 },
        { wch: 30 }
      ];

      XLSX.writeFile(wb, 'نموذج_الأحياء.xlsx');
      message.success('تم تحميل النموذج بنجاح');
    });
  };

  // استيراد من Excel
  const handleImportExcel = async (file: File) => {
    setImportLoading(true);
    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

          if (jsonData.length < 2) {
            message.error('الملف فارغ أو لا يحتوي على بيانات');
            setImportLoading(false);
            return;
          }

          // تخطي الصف الأول (العناوين)
          const rows = jsonData.slice(1).filter(row => row[0] && row[1] && row[2]);

          if (rows.length === 0) {
            message.error('لا توجد بيانات صالحة للاستيراد');
            setImportLoading(false);
            return;
          }

          const batch = writeBatch(db);
          let successCount = 0;
          let errorCount = 0;

          for (const row of rows) {
            const districtName = String(row[0]).trim();
            const regionName = String(row[1]).trim();
            const governorateName = String(row[2]).trim();

            if (!districtName || !regionName || !governorateName) {
              errorCount++;
              continue;
            }

            // البحث عن المحافظة أو إنشاؤها
            let governorate = governorates.find(g => 
              (g.nameAr || g.name)?.toLowerCase() === governorateName.toLowerCase()
            );

            if (!governorate) {
              // إنشاء المحافظة الجديدة
              const govRef = await addDoc(collection(db, 'governorates'), {
                name: governorateName,
                nameAr: governorateName,
                nameEn: '',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
              });
              governorate = {
                id: govRef.id,
                name: governorateName,
                nameAr: governorateName,
                nameEn: ''
              };
              governorates.push(governorate);
            }

            // البحث عن المنطقة أو إنشاؤها
            let region = regions.find(r => 
              (r.nameAr || r.name)?.toLowerCase() === regionName.toLowerCase() &&
              r.governorateId === governorate!.id
            );

            if (!region) {
              // إنشاء المنطقة الجديدة
              const regRef = await addDoc(collection(db, 'regions'), {
                name: regionName,
                nameAr: regionName,
                nameEn: '',
                governorateId: governorate.id,
                governorateName: governorate.nameAr || governorate.name,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
              });
              region = {
                id: regRef.id,
                name: regionName,
                nameAr: regionName,
                nameEn: '',
                governorateId: governorate.id,
                governorateName: governorate.nameAr || governorate.name
              };
              regions.push(region);
            }

            // التحقق من وجود الحي
            const existingDistrict = districts.find(d =>
              (d.nameAr || d.name)?.toLowerCase() === districtName.toLowerCase() &&
              d.regionId === region!.id
            );

            if (!existingDistrict) {
              // إضافة الحي الجديد
              const distRef = doc(collection(db, 'districts'));
              batch.set(distRef, {
                name: districtName,
                nameAr: districtName,
                nameEn: '',
                governorateId: governorate.id,
                governorateName: governorate.nameAr || governorate.name,
                regionId: region.id,
                regionName: region.nameAr || region.name,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
              });
              successCount++;
            } else {
              errorCount++;
            }
          }

          if (successCount > 0) {
            await batch.commit();
            message.success(`تم استيراد ${successCount} حي بنجاح${errorCount > 0 ? ` (${errorCount} تم تخطيه)` : ''}`);
            await fetchGovernorates();
            await fetchRegions();
            await fetchDistricts();
          } else {
            message.warning('لم يتم استيراد أي بيانات جديدة');
          }

          setIsImportModalVisible(false);
        } catch (error) {
          console.error('Error processing Excel:', error);
          message.error('حدث خطأ في معالجة الملف');
        } finally {
          setImportLoading(false);
        }
      };

      reader.readAsBinaryString(file);
    } catch (error) {
      console.error('Error importing Excel:', error);
      message.error('حدث خطأ في استيراد الملف');
      setImportLoading(false);
    }

    return false; // منع الرفع التلقائي
  };

  // تصدير إلى Excel
  const handleExport = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ExcelJS = (window as any).ExcelJS;
    if (!ExcelJS) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js';
      script.onload = () => handleExport();
      document.head.appendChild(script);
      return;
    }

    const exportData = filteredDistricts.map((district, index) => ({
      number: index + 1,
      name: district.name || district.nameAr || '',
      nameAr: district.nameAr || district.name || '',
      nameEn: district.nameEn || '',
      regionName: district.regionName || '',
      governorateName: district.governorateName || '',
      createdAt: district.createdAt ? dayjs(district.createdAt.toDate()).format('DD/MM/YYYY') : ''
    }));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('الأحياء');

    sheet.columns = [
      { header: '#', key: 'number', width: 10 },
      { header: 'اسم الحي', key: 'name', width: 30 },
      { header: 'الاسم بالعربي', key: 'nameAr', width: 30 },
      { header: 'الاسم بالإنجليزي', key: 'nameEn', width: 30 },
      { header: 'المنطقة', key: 'regionName', width: 25 },
      { header: 'المحافظة', key: 'governorateName', width: 25 },
      { header: 'تاريخ الإنشاء', key: 'createdAt', width: 20 }
    ];

    sheet.addRows(exportData);

    // تنسيق الهيدر
    sheet.getRow(1).eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1890FF' }
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // تنسيق الصفوف
    for (let i = 2; i <= sheet.rowCount; i++) {
      sheet.getRow(i).eachCell(cell => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      if (i % 2 === 0) {
        sheet.getRow(i).eachCell(cell => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' }
          };
        });
      }
    }

    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columnCount }
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `الأحياء_${new Date().toLocaleDateString('ar-SA').replace(/\//g, '-')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  // طباعة الجدول
  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=1400,height=900');
    printWindow?.document.write(`
      <html>
      <head>
        <title>طباعة الأحياء</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap');
          @page { 
            size: A4 landscape; 
            margin: 15mm; 
          }
          body { 
            font-family: 'Tajawal', Arial, sans-serif; 
            direction: rtl; 
            padding: 20px; 
            font-size: 12px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
          }
          .header h1 {
            color: #000;
            margin: 0;
            font-size: 24px;
            font-weight: 700;
          }
          .header p {
            color: #666;
            margin: 5px 0 0 0;
            font-size: 14px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px;
          }
          th, td { 
            border: 1px solid #d1d5db; 
            padding: 12px 8px; 
            text-align: center;
          }
          th { 
            background-color: rgb(192, 219, 254);
            color: #1e3a8a;
            font-weight: 600;
            font-size: 14px;
          }
          tbody tr:nth-child(even) {
            background-color: #f5f5f5;
          }
          .print-date {
            text-align: left;
            margin-top: 20px;
            font-size: 11px;
            color: #666;
          }
          @media print {
            body { margin: 0; padding: 15px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>تقرير الأحياء</h1>
          <p>نظام إدارة الموارد ERP90</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 8%;">#</th>
              <th style="width: 30%;">اسم الحي</th>
              <th style="width: 25%;">اسم المنطقة</th>
              <th style="width: 25%;">اسم المحافظة</th>
              <th style="width: 12%;">تاريخ الإنشاء</th>
            </tr>
          </thead>
          <tbody>
            ${filteredDistricts.map((district, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${district.name || district.nameAr || ''}</td>
                <td>${district.regionName || ''}</td>
                <td>${district.governorateName || ''}</td>
                <td>${district.createdAt ? dayjs(district.createdAt.toDate()).format('DD/MM/YYYY') : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="print-date">
          تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA')}
        </div>
      </body>
      </html>
    `);
    
    printWindow?.document.close();
    printWindow?.focus();
    setTimeout(() => {
      printWindow?.print();
      printWindow?.close();
    }, 500);
  };

  // أعمدة الجدول
  const columns = [
    {
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>#</span>,
      key: 'index',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => (
        <span style={{ fontSize: '15px', fontWeight: 500 }}>
          {(currentPage - 1) * pageSize + index + 1}
        </span>
      )
    },
    {
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>اسم الحي</span>,
      dataIndex: 'name',
      key: 'name',
      align: 'center' as const,
      render: (text: string, record: District) => (
        <span style={{ fontSize: '15px', fontWeight: 500, color: '#1890ff' }}>
          {record.nameAr || record.name || text}
        </span>
      )
    },
    {
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>اسم المنطقة</span>,
      dataIndex: 'regionName',
      key: 'regionName',
      align: 'center' as const,
      width: 180,
      render: (text: string) => (
        <span style={{ fontSize: '15px', fontWeight: 500, color: '#52c41a' }}>
          {text || '-'}
        </span>
      )
    },
    {
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>اسم المحافظة</span>,
      dataIndex: 'governorateName',
      key: 'governorateName',
      align: 'center' as const,
      width: 180,
      render: (text: string) => (
        <span style={{ fontSize: '15px', fontWeight: 500, color: '#722ed1' }}>
          {text || '-'}
        </span>
      )
    },
    {
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>تاريخ الإنشاء</span>,
      dataIndex: 'createdAt',
      key: 'createdAt',
      align: 'center' as const,
      width: 150,
      render: (createdAt: Timestamp | null) => (
        <span style={{ fontSize: '15px' }}>
          {createdAt ? dayjs(createdAt.toDate()).format('DD/MM/YYYY') : '-'}
        </span>
      )
    },
    {
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>الإجراءات</span>,
      key: 'actions',
      align: 'center' as const,
      width: 200,
      render: (_: unknown, record: District) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
            style={{ 
              color: '#1890ff',
              fontSize: '15px',
              fontWeight: 500,
              height: 36
            }}
          >
            تعديل
          </Button>
          <Popconfirm
            title={<span style={{ fontSize: '15px' }}>هل أنت متأكد من حذف هذا الحي؟</span>}
            onConfirm={() => handleDelete(record.id)}
            okText="نعم"
            cancelText="لا"
            okButtonProps={{ danger: true, style: { fontSize: '15px' } }}
            cancelButtonProps={{ style: { fontSize: '15px' } }}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              style={{ 
                fontSize: '15px',
                fontWeight: 500,
                height: 36
              }}
            >
              حذف
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="w-full p-4 sm:p-6 space-y-6 min-h-screen" dir="rtl">
      <Helmet>
        <title>إدارة الأحياء | ERP90 Dashboard</title>
        <meta name="description" content="إدارة الأحياء في نظام ERP90" />
      </Helmet>

      <style>{`
        .custom-table .ant-table-thead > tr > th {
          background: rgb(192, 219, 254) !important;
          color: #1e3a8a !important;
          font-weight: 600;
          font-size: 16px;
          padding: 16px 12px;
          border: none;
        }
        
        .custom-table .ant-table-tbody > tr > td {
          padding: 14px 12px;
          font-size: 15px;
          border-bottom: 1px solid #f0f0f0;
        }
        
        .custom-table .ant-table-tbody > tr:hover > td {
          background-color: #e6f7ff !important;
          transition: all 0.3s ease;
        }
        
        .custom-table .ant-pagination {
          margin-top: 16px;
        }
        
        .custom-table .ant-pagination-item {
          font-size: 15px;
          border-radius: 6px;
        }
        
        .custom-table .ant-pagination-item-active {
          background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
          border-color: #1890ff;
        }
        
        .custom-table .ant-pagination-item-active a {
          color: #fff;
        }
      `}</style>

      {/* Header */}
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <MapPinned className="h-8 w-8 text-blue-600 dark:text-blue-300" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">إدارة الأحياء</h1>
              <p className="text-gray-600 dark:text-gray-400">إدارة وعرض الأحياء في النظام</p>
            </div>
          </div>
          
          {/* السنة المالية Dropdown */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <span className="flex items-center gap-2">
              <label className="text-base font-medium text-gray-700 dark:text-gray-300">السنة المالية:</label>
            </span>
            <div className="min-w-[160px]">
              <Select
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
                  <Select.Option key={y.id} value={y.year.toString()}>{y.year}</Select.Option>
                ))}
              </Select>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-200"></div>
      </div>

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المخرجات", to: "/management/outputs" },
          { label: "الأحياء" }
        ]}
      />

      {/* Search and Actions */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label style={labelStyle}>البحث عن حي</label>
            <Input
              placeholder="ابحث بالاسم أو المنطقة أو المحافظة..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={largeControlStyle}
              allowClear
            />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 mt-6">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
            style={{
              height: 48,
              fontSize: 16,
              fontWeight: 500,
              borderRadius: 8,
              padding: '0 24px',
              boxShadow: '0 2px 8px rgba(24,144,255,0.3)',
            }}
          >
            إضافة حي
          </Button>
          <Button
            icon={<UploadOutlined />}
            onClick={() => setIsImportModalVisible(true)}
            style={{
              height: 48,
              fontSize: 16,
              fontWeight: 500,
              borderRadius: 8,
              padding: '0 24px',
              background: '#ff4d4f',
              color: '#fff',
              border: 'none',
              boxShadow: '0 2px 8px rgba(255,77,79,0.3)',
            }}
          >
            استيراد من Excel
          </Button>
          <Button
            icon={<FileExcelOutlined />}
            onClick={handleDownloadTemplate}
            style={{
              height: 48,
              fontSize: 16,
              fontWeight: 500,
              borderRadius: 8,
              padding: '0 24px',
              background: '#13c2c2',
              color: '#fff',
              border: 'none',
              boxShadow: '0 2px 8px rgba(19,194,194,0.3)',
            }}
          >
            تحميل النموذج
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            style={{
              height: 48,
              fontSize: 16,
              fontWeight: 500,
              borderRadius: 8,
              padding: '0 24px',
              background: '#52c41a',
              color: '#fff',
              border: 'none',
              boxShadow: '0 2px 8px rgba(82,196,26,0.3)',
            }}
          >
            تصدير Excel
          </Button>
          <Button
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            style={{
              height: 48,
              fontSize: 16,
              fontWeight: 500,
              borderRadius: 8,
              padding: '0 24px',
              background: '#722ed1',
              color: '#fff',
              border: 'none',
              boxShadow: '0 2px 8px rgba(114,46,209,0.3)',
            }}
          >
            طباعة
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <Table
          columns={columns}
          dataSource={paginatedData}
          loading={isLoading}
          rowKey="id"
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: filteredDistricts.length,
            onChange: (page) => setCurrentPage(page),
            showSizeChanger: false,
            showTotal: (total) => `إجمالي ${total} حي`,
            position: ['bottomCenter'],
            style: { padding: '16px' }
          }}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: 'لا توجد بيانات',
            triggerDesc: 'ترتيب تنازلي',
            triggerAsc: 'ترتيب تصاعدي',
            cancelSort: 'إلغاء الترتيب'
          }}
          className="custom-table"
          style={{
            fontSize: '16px'
          }}
          rowClassName={(_, index) => index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
        />
      </div>

      {/* Modal for Add/Edit */}
      <Modal
        title={
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#1890ff' }}>
            {editingDistrict ? 'تعديل حي' : 'إضافة حي جديد'}
          </div>
        }
        open={isModalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={600}
        destroyOnClose
        centered
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          style={{ marginTop: 24 }}
        >
          <Form.Item
            label={<span style={labelStyle}>المحافظة</span>}
            name="governorateId"
            rules={[{ required: true, message: 'يرجى اختيار المحافظة' }]}
          >
            <Select
              placeholder="اختر المحافظة"
              style={largeControlStyle}
              showSearch
              onChange={handleGovernorateChange}
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {governorates.map(gov => (
                <Select.Option key={gov.id} value={gov.id}>
                  {gov.nameAr || gov.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label={<span style={labelStyle}>المنطقة</span>}
            name="regionId"
            rules={[{ required: true, message: 'يرجى اختيار المنطقة' }]}
          >
            <Select
              placeholder="اختر المنطقة"
              style={largeControlStyle}
              showSearch
              disabled={filteredRegions.length === 0}
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {filteredRegions.map(region => (
                <Select.Option key={region.id} value={region.id}>
                  {region.nameAr || region.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label={<span style={labelStyle}>اسم الحي</span>}
            name="name"
            rules={[{ required: true, message: 'يرجى إدخال اسم الحي' }]}
          >
            <Input placeholder="أدخل اسم الحي" style={largeControlStyle} />
          </Form.Item>

          <Form.Item
            label={<span style={labelStyle}>الاسم بالعربي</span>}
            name="nameAr"
          >
            <Input placeholder="أدخل الاسم بالعربي" style={largeControlStyle} />
          </Form.Item>

          <Form.Item
            label={<span style={labelStyle}>الاسم بالإنجليزي</span>}
            name="nameEn"
          >
            <Input placeholder="Enter name in English" style={largeControlStyle} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <div className="flex justify-end gap-3">
              <Button 
                onClick={handleCloseModal}
                style={{
                  height: 44,
                  fontSize: 16,
                  borderRadius: 8,
                  padding: '0 24px'
                }}
              >
                إلغاء
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                style={{
                  height: 44,
                  fontSize: 16,
                  fontWeight: 500,
                  borderRadius: 8,
                  padding: '0 24px',
                  boxShadow: '0 2px 8px rgba(24,144,255,0.3)',
                }}
              >
                {editingDistrict ? 'تحديث' : 'إضافة'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal for Import */}
      <Modal
        title={
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#ff4d4f' }}>
            استيراد الأحياء من Excel
          </div>
        }
        open={isImportModalVisible}
        onCancel={() => setIsImportModalVisible(false)}
        footer={null}
        width={500}
        destroyOnClose
        centered
      >
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: '16px', marginBottom: 16, color: '#666' }}>
            قم برفع ملف Excel يحتوي على الأعمدة التالية:
          </p>
          <ul style={{ fontSize: '15px', color: '#666', marginBottom: 24, paddingRight: 20 }}>
            <li>الحي</li>
            <li>المنطقة</li>
            <li>المحافظة</li>
          </ul>
          
          <Upload
            accept=".xlsx,.xls"
            beforeUpload={handleImportExcel}
            showUploadList={false}
            disabled={importLoading}
          >
            <Button
              icon={<UploadOutlined />}
              loading={importLoading}
              style={{
                width: '100%',
                height: 48,
                fontSize: 16,
                fontWeight: 500,
                borderRadius: 8,
              }}
              type="primary"
            >
              {importLoading ? 'جاري الاستيراد...' : 'اختر ملف Excel'}
            </Button>
          </Upload>

          <div style={{ marginTop: 16, padding: 12, background: '#f0f5ff', borderRadius: 8, border: '1px solid #d6e4ff' }}>
            <p style={{ fontSize: '14px', color: '#1890ff', margin: 0 }}>
              💡 ملاحظة: سيتم إنشاء المحافظات والمناطق تلقائياً إذا لم تكن موجودة
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Districts;
