import React, { useState, useEffect, useMemo } from 'react';
import { Table, Input, Button, Modal, Form, message, Space, Popconfirm, Select, Tag } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, PrinterOutlined, DownloadOutlined } from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Breadcrumb from '@/components/Breadcrumb';
import { Helmet } from 'react-helmet';
import { Wrench } from 'lucide-react';
import dayjs from 'dayjs';
import { useFinancialYear } from '@/hooks/useFinancialYear';

interface Technician {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: 'نشط' | 'معطل' | 'في إجازة';
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
}

const Technicians: React.FC = () => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [filteredTechnicians, setFilteredTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);
  const [form] = Form.useForm();

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

  // جلب الفنيين من Firebase
  const fetchTechnicians = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'technicians'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Technician[];
      setTechnicians(data);
      setFilteredTechnicians(data);
    } catch (error) {
      console.error('Error fetching technicians:', error);
      message.error('حدث خطأ في جلب البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTechnicians();
  }, []);

  // البحث في الفنيين
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredTechnicians(technicians);
      setCurrentPage(1);
      return;
    }

    const filtered = technicians.filter(technician => 
      technician.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      technician.phone?.toLowerCase().includes(searchText.toLowerCase()) ||
      technician.email?.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredTechnicians(filtered);
    setCurrentPage(1);
  }, [searchText, technicians]);

  // البيانات المقسمة على صفحات
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredTechnicians.slice(startIndex, endIndex);
  }, [filteredTechnicians, currentPage, pageSize]);

  // فتح المودال للإضافة أو التعديل
  const handleOpenModal = (technician?: Technician) => {
    if (technician) {
      setEditingTechnician(technician);
      form.setFieldsValue({
        name: technician.name,
        phone: technician.phone,
        email: technician.email,
        status: technician.status
      });
    } else {
      setEditingTechnician(null);
      form.resetFields();
      form.setFieldsValue({ status: 'نشط' }); // القيمة الافتراضية
    }
    setIsModalVisible(true);
  };

  // إغلاق المودال
  const handleCloseModal = () => {
    setIsModalVisible(false);
    setEditingTechnician(null);
    form.resetFields();
  };

  // حفظ الفني (إضافة أو تعديل)
  interface FormValues {
    name: string;
    phone: string;
    email?: string;
    status: 'نشط' | 'معطل' | 'في إجازة';
  }

  const handleSave = async (values: FormValues) => {
    try {
      if (editingTechnician) {
        // تعديل فني موجود
        const docRef = doc(db, 'technicians', editingTechnician.id);
        await updateDoc(docRef, {
          name: values.name,
          phone: values.phone,
          email: values.email || '',
          status: values.status,
          updatedAt: Timestamp.now()
        });
        message.success('تم تحديث الفني بنجاح');
      } else {
        // إضافة فني جديد
        await addDoc(collection(db, 'technicians'), {
          name: values.name,
          phone: values.phone,
          email: values.email || '',
          status: values.status,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        message.success('تم إضافة الفني بنجاح');
      }
      handleCloseModal();
      fetchTechnicians();
    } catch (error) {
      console.error('Error saving technician:', error);
      message.error('حدث خطأ في حفظ البيانات');
    }
  };

  // حذف فني
  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'technicians', id));
      message.success('تم حذف الفني بنجاح');
      fetchTechnicians();
    } catch (error) {
      console.error('Error deleting technician:', error);
      message.error('حدث خطأ في حذف الفني');
    }
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

    const exportData = filteredTechnicians.map((technician, index) => ({
      number: index + 1,
      name: technician.name || '',
      phone: technician.phone || '',
      email: technician.email || '',
      status: technician.status || '',
      createdAt: technician.createdAt ? dayjs(technician.createdAt.toDate()).format('DD/MM/YYYY') : ''
    }));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('الفنيين');

    sheet.columns = [
      { header: '#', key: 'number', width: 10 },
      { header: 'اسم الفني', key: 'name', width: 30 },
      { header: 'رقم الهاتف', key: 'phone', width: 20 },
      { header: 'البريد الإلكتروني', key: 'email', width: 30 },
      { header: 'الحالة', key: 'status', width: 15 },
      { header: 'تاريخ الإنشاء', key: 'createdAt', width: 20 }
    ];

    sheet.addRows(exportData);

    // تنسيق الهيدر
    sheet.getRow(1).eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6366F1' }
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
    a.download = `الفنيين_${new Date().toLocaleDateString('ar-SA').replace(/\//g, '-')}.xlsx`;
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
        <title>طباعة الفنيين</title>
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
            background-color: rgb(199, 210, 254);
            color: #4338ca;
            font-weight: 600;
            font-size: 14px;
          }
          tbody tr:nth-child(even) {
            background-color: #f5f5f5;
          }
          .status-active {
            background-color: #d4edda;
            color: #155724;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 500;
          }
          .status-inactive {
            background-color: #f8d7da;
            color: #721c24;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 500;
          }
          .status-vacation {
            background-color: #fff3cd;
            color: #856404;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 500;
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
          <h1>تقرير الفنيين</h1>
          <p>نظام إدارة الموارد ERP90</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 8%;">#</th>
              <th style="width: 30%;">اسم الفني</th>
              <th style="width: 22%;">رقم الهاتف</th>
              <th style="width: 30%;">البريد الإلكتروني</th>
              <th style="width: 10%;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTechnicians.map((technician, index) => {
              let statusClass = 'status-active';
              if (technician.status === 'معطل') statusClass = 'status-inactive';
              if (technician.status === 'في إجازة') statusClass = 'status-vacation';
              
              return `
              <tr>
                <td>${index + 1}</td>
                <td>${technician.name || ''}</td>
                <td>${technician.phone || ''}</td>
                <td>${technician.email || '-'}</td>
                <td><span class="${statusClass}">${technician.status || ''}</span></td>
              </tr>
            `}).join('')}
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

  // دالة لتحديد لون الحالة
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'نشط':
        return 'green';
      case 'معطل':
        return 'red';
      case 'في إجازة':
        return 'orange';
      default:
        return 'default';
    }
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
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>اسم الفني</span>,
      dataIndex: 'name',
      key: 'name',
      align: 'center' as const,
      render: (text: string) => (
        <span style={{ fontSize: '15px', fontWeight: 500, color: '#6366f1' }}>
          {text}
        </span>
      )
    },
    {
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>رقم الهاتف</span>,
      dataIndex: 'phone',
      key: 'phone',
      align: 'center' as const,
      width: 150,
      render: (text: string) => (
        <span style={{ fontSize: '15px', fontWeight: 500 }}>
          {text}
        </span>
      )
    },
    {
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>البريد الإلكتروني</span>,
      dataIndex: 'email',
      key: 'email',
      align: 'center' as const,
      width: 200,
      render: (text: string) => (
        <span style={{ fontSize: '15px' }}>
          {text || '-'}
        </span>
      )
    },
    {
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>الحالة</span>,
      dataIndex: 'status',
      key: 'status',
      align: 'center' as const,
      width: 120,
      render: (status: string) => (
        <Tag color={getStatusColor(status)} style={{ fontSize: '14px', padding: '4px 12px', fontWeight: 500 }}>
          {status}
        </Tag>
      )
    },
    {
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>الإجراءات</span>,
      key: 'actions',
      align: 'center' as const,
      width: 200,
      render: (_: unknown, record: Technician) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
            style={{ 
              color: '#6366f1',
              fontSize: '15px',
              fontWeight: 500,
              height: 36
            }}
          >
            تعديل
          </Button>
          <Popconfirm
            title={<span style={{ fontSize: '15px' }}>هل أنت متأكد من حذف هذا الفني؟</span>}
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
        <title>إدارة الفنيين | ERP90 Dashboard</title>
        <meta name="description" content="إدارة الفنيين في نظام ERP90" />
      </Helmet>

      <style>{`
        .custom-table .ant-table-thead > tr > th {
          background: rgb(199, 210, 254) !important;
          color: #4338ca !important;
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
          background-color: #ede9fe !important;
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
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          border-color: #6366f1;
        }
        
        .custom-table .ant-pagination-item-active a {
          color: #fff;
        }
      `}</style>

      {/* Header */}
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
              <Wrench className="h-8 w-8 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">إدارة الفنيين</h1>
              <p className="text-gray-600 dark:text-gray-400">إدارة وعرض الفنيين في النظام</p>
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
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
      </div>

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة التركيب", to: "/management/installation" },
          { label: "الفنيين" }
        ]}
      />

      {/* Search and Actions */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label style={labelStyle}>البحث عن فني</label>
            <Input
              placeholder="ابحث بالاسم أو الهاتف..."
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
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              border: 'none',
              boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
            }}
          >
            إضافة فني
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
              background: '#8b5cf6',
              color: '#fff',
              border: 'none',
              boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
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
            total: filteredTechnicians.length,
            onChange: (page) => setCurrentPage(page),
            showSizeChanger: false,
            showTotal: (total) => `إجمالي ${total} فني`,
            position: ['bottomCenter'],
            style: { padding: '16px' }
          }}
          scroll={{ x: 1000 }}
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
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#6366f1' }}>
            {editingTechnician ? 'تعديل فني' : 'إضافة فني جديد'}
          </div>
        }
        open={isModalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={700}
        destroyOnClose
        centered
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          style={{ marginTop: 24 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              label={<span style={labelStyle}>اسم الفني</span>}
              name="name"
              rules={[{ required: true, message: 'يرجى إدخال اسم الفني' }]}
            >
              <Input placeholder="أدخل اسم الفني" style={largeControlStyle} />
            </Form.Item>

            <Form.Item
              label={<span style={labelStyle}>رقم الهاتف</span>}
              name="phone"
              rules={[
                { required: true, message: 'يرجى إدخال رقم الهاتف' },
                { pattern: /^[0-9+\-\s()]+$/, message: 'رقم الهاتف غير صحيح' }
              ]}
            >
              <Input placeholder="مثال: 0500000000" style={largeControlStyle} />
            </Form.Item>
          </div>

          <Form.Item
            label={<span style={labelStyle}>البريد الإلكتروني</span>}
            name="email"
            rules={[
              { type: 'email', message: 'البريد الإلكتروني غير صحيح' }
            ]}
          >
            <Input placeholder="example@email.com" style={largeControlStyle} />
          </Form.Item>

          <Form.Item
            label={<span style={labelStyle}>الحالة</span>}
            name="status"
            rules={[{ required: true, message: 'يرجى اختيار الحالة' }]}
          >
            <Select
              placeholder="اختر الحالة"
              style={largeControlStyle}
            >
              <Select.Option value="نشط">نشط</Select.Option>
              <Select.Option value="معطل">معطل</Select.Option>
              <Select.Option value="في إجازة">في إجازة</Select.Option>
            </Select>
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
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                }}
              >
                {editingTechnician ? 'تحديث' : 'إضافة'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Technicians;
