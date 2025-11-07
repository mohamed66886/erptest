import React, { useState, useEffect, useMemo } from 'react';
import { Table, Input, Button, Modal, Form, message, Space, Popconfirm } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, PrinterOutlined, DownloadOutlined } from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Breadcrumb from '@/components/Breadcrumb';
import { Helmet } from 'react-helmet';
import { Warehouse } from 'lucide-react';
import dayjs from 'dayjs';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import { Select } from 'antd';

interface DeliveryWarehouse {
  id: string;
  name: string;
  keeper: string;
  phone: string;
  address?: string;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
}

const DeliveryWarehouses: React.FC = () => {
  const [warehouses, setWarehouses] = useState<DeliveryWarehouse[]>([]);
  const [filteredWarehouses, setFilteredWarehouses] = useState<DeliveryWarehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<DeliveryWarehouse | null>(null);
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

  // ستايل موحد للإدخال والدروب داون مثل صفحة أمر البيع
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

  // جلب مستودعات التوصيل من Firebase
  const fetchWarehouses = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'delivery_warehouses'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DeliveryWarehouse[];
      setWarehouses(data);
      setFilteredWarehouses(data);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      message.error('حدث خطأ في جلب البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  // البحث في المستودعات
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredWarehouses(warehouses);
      setCurrentPage(1);
      return;
    }

    const filtered = warehouses.filter(warehouse => 
      warehouse.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      warehouse.keeper?.toLowerCase().includes(searchText.toLowerCase()) ||
      warehouse.phone?.includes(searchText) ||
      warehouse.address?.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredWarehouses(filtered);
    setCurrentPage(1);
  }, [searchText, warehouses]);

  // البيانات المقسمة على صفحات
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredWarehouses.slice(startIndex, endIndex);
  }, [filteredWarehouses, currentPage, pageSize]);

  // فتح المودال للإضافة أو التعديل
  const handleOpenModal = (warehouse?: DeliveryWarehouse) => {
    if (warehouse) {
      setEditingWarehouse(warehouse);
      form.setFieldsValue({
        name: warehouse.name,
        keeper: warehouse.keeper,
        phone: warehouse.phone,
        address: warehouse.address
      });
    } else {
      setEditingWarehouse(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  // إغلاق المودال
  const handleCloseModal = () => {
    setIsModalVisible(false);
    setEditingWarehouse(null);
    form.resetFields();
  };

  // حفظ المستودع (إضافة أو تعديل)
  interface FormValues {
    name: string;
    keeper: string;
    phone: string;
    address?: string;
  }

  const handleSave = async (values: FormValues) => {
    try {
      // التحقق من رقم الهاتف
      if (values.phone && !/^\d{10}$/.test(values.phone)) {
        message.error('رقم الهاتف يجب أن يكون 10 أرقام بالضبط');
        return;
      }

      if (editingWarehouse) {
        // تعديل مستودع موجود
        const docRef = doc(db, 'delivery_warehouses', editingWarehouse.id);
        await updateDoc(docRef, {
          name: values.name,
          keeper: values.keeper,
          phone: values.phone,
          address: values.address || '',
          updatedAt: Timestamp.now()
        });
        message.success('تم تحديث المستودع بنجاح');
      } else {
        // إضافة مستودع جديد
        await addDoc(collection(db, 'delivery_warehouses'), {
          name: values.name,
          keeper: values.keeper,
          phone: values.phone,
          address: values.address || '',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        message.success('تم إضافة المستودع بنجاح');
      }
      handleCloseModal();
      fetchWarehouses();
    } catch (error) {
      console.error('Error saving warehouse:', error);
      message.error('حدث خطأ في حفظ البيانات');
    }
  };

  // حذف مستودع
  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'delivery_warehouses', id));
      message.success('تم حذف المستودع بنجاح');
      fetchWarehouses();
    } catch (error) {
      console.error('Error deleting warehouse:', error);
      message.error('حدث خطأ في حذف المستودع');
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

    const exportData = filteredWarehouses.map((warehouse, index) => ({
      number: index + 1,
      name: warehouse.name || '',
      keeper: warehouse.keeper || '',
      phone: warehouse.phone || '',
      address: warehouse.address || '',
      createdAt: warehouse.createdAt ? dayjs(warehouse.createdAt.toDate()).format('DD/MM/YYYY') : ''
    }));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('مستودعات التوصيل');

    sheet.columns = [
      { header: '#', key: 'number', width: 10 },
      { header: 'اسم المستودع', key: 'name', width: 30 },
      { header: 'أمين المستودع', key: 'keeper', width: 25 },
      { header: 'رقم الهاتف', key: 'phone', width: 20 },
      { header: 'العنوان', key: 'address', width: 40 },
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
    a.download = `مستودعات_التوصيل_${new Date().toLocaleDateString('ar-SA').replace(/\//g, '-')}.xlsx`;
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
        <title>طباعة مستودعات التوصيل</title>
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
            background-color: #1890ff;
            color: #fff;
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
          <h1>تقرير مستودعات التوصيل</h1>
          <p>نظام إدارة الموارد ERP90</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 8%;">#</th>
              <th style="width: 22%;">اسم المستودع</th>
              <th style="width: 20%;">أمين المستودع</th>
              <th style="width: 15%;">رقم الهاتف</th>
              <th style="width: 25%;">العنوان</th>
              <th style="width: 10%;">تاريخ الإنشاء</th>
            </tr>
          </thead>
          <tbody>
            ${filteredWarehouses.map((warehouse, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${warehouse.name || ''}</td>
                <td>${warehouse.keeper || ''}</td>
                <td>${warehouse.phone || ''}</td>
                <td>${warehouse.address || '-'}</td>
                <td>${warehouse.createdAt ? dayjs(warehouse.createdAt.toDate()).format('DD/MM/YYYY') : ''}</td>
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
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>اسم المستودع</span>,
      dataIndex: 'name',
      key: 'name',
      align: 'center' as const,
      render: (text: string) => (
        <span style={{ fontSize: '15px', fontWeight: 500, color: '#1890ff' }}>
          {text}
        </span>
      )
    },
    {
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>أمين المستودع</span>,
      dataIndex: 'keeper',
      key: 'keeper',
      align: 'center' as const,
      render: (text: string) => (
        <span style={{ fontSize: '15px' }}>
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
        <span style={{ fontSize: '15px', fontFamily: 'monospace', direction: 'ltr', display: 'inline-block' }}>
          {text}
        </span>
      )
    },
    {
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>العنوان</span>,
      dataIndex: 'address',
      key: 'address',
      align: 'center' as const,
      render: (text: string) => (
        <span style={{ fontSize: '15px' }}>
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
      render: (_: unknown, record: DeliveryWarehouse) => (
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
            title={<span style={{ fontSize: '15px' }}>هل أنت متأكد من حذف هذا المستودع؟</span>}
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
        <title>مستودعات التوصيل | ERP90 Dashboard</title>
        <meta name="description" content="إدارة مستودعات التوصيل في نظام ERP90" />
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
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
              <Warehouse className="h-8 w-8 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">مستودعات التوصيل</h1>
              <p className="text-gray-600 dark:text-gray-400">إدارة وعرض مستودعات التوصيل في النظام</p>
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
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-indigo-200"></div>
      </div>

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المخرجات", to: "/management/outputs" },
          { label: "مستودعات التوصيل" }
        ]}
      />

      {/* Search and Actions */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label style={labelStyle}>البحث عن مستودع</label>
            <Input
              placeholder="ابحث بالاسم أو الأمين أو الهاتف..."
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
            إضافة مستودع
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
            total: filteredWarehouses.length,
            onChange: (page) => setCurrentPage(page),
            showSizeChanger: false,
            showTotal: (total) => `إجمالي ${total} مستودع`,
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
        title={editingWarehouse ? 'تعديل مستودع' : 'إضافة مستودع جديد'}
        open={isModalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          style={{ marginTop: 20 }}
        >
          <Form.Item
            label="اسم المستودع"
            name="name"
            rules={[{ required: true, message: 'يرجى إدخال اسم المستودع' }]}
          >
            <Input placeholder="أدخل اسم المستودع" size="large" />
          </Form.Item>

          <Form.Item
            label="أمين المستودع"
            name="keeper"
            rules={[{ required: true, message: 'يرجى إدخال اسم أمين المستودع' }]}
          >
            <Input placeholder="أدخل اسم أمين المستودع" size="large" />
          </Form.Item>

          <Form.Item
            label="رقم الهاتف"
            name="phone"
            rules={[
              { required: true, message: 'يرجى إدخال رقم الهاتف' },
              { pattern: /^\d{10}$/, message: 'رقم الهاتف يجب أن يكون 10 أرقام بالضبط' }
            ]}
          >
            <Input 
              placeholder="05xxxxxxxx" 
              size="large" 
              maxLength={10}
              style={{ direction: 'ltr', textAlign: 'right' }}
            />
          </Form.Item>

          <Form.Item
            label="العنوان (اختياري)"
            name="address"
          >
            <Input.TextArea 
              placeholder="أدخل عنوان المستودع" 
              size="large"
              rows={3}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'left' }}>
            <Space>
              <Button onClick={handleCloseModal}>
                إلغاء
              </Button>
              <Button type="primary" htmlType="submit">
                {editingWarehouse ? 'تحديث' : 'إضافة'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DeliveryWarehouses;
