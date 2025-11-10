import React, { useState, useEffect, useMemo } from 'react';
import { Table, Input, Button, Modal, Form, message, Space, Popconfirm, Select as AntdSelect } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, PrinterOutlined, DownloadOutlined } from '@ant-design/icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Breadcrumb from '@/components/Breadcrumb';
import { Helmet } from 'react-helmet';
import { Building2 } from 'lucide-react';
import dayjs from 'dayjs';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import { Select } from 'antd';

interface BranchLink {
  id: string;
  branchId: string;
  branchName: string;
  warehouseId: string;
  warehouseName: string;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface Warehouse {
  id: string;
  name: string;
}

const LinkBranches: React.FC = () => {
  const [branchLinks, setBranchLinks] = useState<BranchLink[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [filteredBranchLinks, setFilteredBranchLinks] = useState<BranchLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBranchLink, setEditingBranchLink] = useState<BranchLink | null>(null);
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

  // جلب الفروع
  const fetchBranches = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'branches'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Branch[];
      setBranches(data);
    } catch (error) {
      console.error('Error fetching branches:', error);
      message.error('حدث خطأ في جلب الفروع');
    }
  };

  // جلب المستودعات
  const fetchWarehouses = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'delivery_warehouses'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as Warehouse[];
      setWarehouses(data);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      message.error('حدث خطأ في جلب المستودعات');
    }
  };

  // جلب ربط الفروع من Firebase
  const fetchBranchLinks = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'branch_warehouse_links'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BranchLink[];
      setBranchLinks(data);
      setFilteredBranchLinks(data);
    } catch (error) {
      console.error('Error fetching branch links:', error);
      message.error('حدث خطأ في جلب البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchWarehouses();
    fetchBranchLinks();
  }, []);

  // البحث في ربط الفروع
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredBranchLinks(branchLinks);
      setCurrentPage(1);
      return;
    }

    const filtered = branchLinks.filter(link => 
      link.branchName?.toLowerCase().includes(searchText.toLowerCase()) ||
      link.warehouseName?.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredBranchLinks(filtered);
    setCurrentPage(1);
  }, [searchText, branchLinks]);

  // البيانات المقسمة على صفحات
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredBranchLinks.slice(startIndex, endIndex);
  }, [filteredBranchLinks, currentPage, pageSize]);

  // فتح المودال للإضافة أو التعديل
  const handleOpenModal = (branchLink?: BranchLink) => {
    if (branchLink) {
      setEditingBranchLink(branchLink);
      form.setFieldsValue({
        branchId: branchLink.branchId,
        warehouseId: branchLink.warehouseId
      });
    } else {
      setEditingBranchLink(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  // إغلاق المودال
  const handleCloseModal = () => {
    setIsModalVisible(false);
    setEditingBranchLink(null);
    form.resetFields();
  };

  // حفظ ربط الفرع (إضافة أو تعديل)
  interface FormValues {
    branchId: string;
    warehouseId: string;
  }

  const handleSave = async (values: FormValues) => {
    try {
      const selectedBranch = branches.find(b => b.id === values.branchId);
      const selectedWarehouse = warehouses.find(w => w.id === values.warehouseId);

      if (!selectedBranch || !selectedWarehouse) {
        message.error('الفرع أو المستودع غير موجود');
        return;
      }

      // التحقق من عدم تكرار الربط
      if (!editingBranchLink) {
        const existingLink = branchLinks.find(link => 
          link.branchId === values.branchId
        );

        if (existingLink) {
          message.error('هذا الفرع مربوط بالفعل بمستودع آخر');
          return;
        }
      }

      if (editingBranchLink) {
        // تعديل ربط موجود
        const docRef = doc(db, 'branch_warehouse_links', editingBranchLink.id);
        await updateDoc(docRef, {
          branchId: values.branchId,
          branchName: selectedBranch.name,
          warehouseId: values.warehouseId,
          warehouseName: selectedWarehouse.name,
          updatedAt: Timestamp.now()
        });
        message.success('تم تحديث الربط بنجاح');
      } else {
        // إضافة ربط جديد
        await addDoc(collection(db, 'branch_warehouse_links'), {
          branchId: values.branchId,
          branchName: selectedBranch.name,
          warehouseId: values.warehouseId,
          warehouseName: selectedWarehouse.name,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        message.success('تم إضافة الربط بنجاح');
      }
      handleCloseModal();
      fetchBranchLinks();
    } catch (error) {
      console.error('Error saving branch link:', error);
      message.error('حدث خطأ في حفظ البيانات');
    }
  };

  // حذف ربط
  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'branch_warehouse_links', id));
      message.success('تم حذف الربط بنجاح');
      fetchBranchLinks();
    } catch (error) {
      console.error('Error deleting branch link:', error);
      message.error('حدث خطأ في حذف الربط');
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

    const exportData = filteredBranchLinks.map((link, index) => ({
      number: index + 1,
      branchName: link.branchName || '',
      warehouseName: link.warehouseName || '',
      createdAt: link.createdAt ? dayjs(link.createdAt.toDate()).format('DD/MM/YYYY') : ''
    }));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('ربط الفروع');

    sheet.columns = [
      { header: '#', key: 'number', width: 10 },
      { header: 'الفرع', key: 'branchName', width: 30 },
      { header: 'المستودع', key: 'warehouseName', width: 30 },
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
    a.download = `ربط_الفروع_${new Date().toLocaleDateString('ar-SA').replace(/\//g, '-')}.xlsx`;
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
        <title>طباعة ربط الفروع</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap');
          @page { 
            size: A4 portrait; 
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
          <h1>تقرير ربط الفروع بالمستودعات</h1>
          <p>نظام إدارة الموارد ERP90</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 10%;">#</th>
              <th style="width: 40%;">الفرع</th>
              <th style="width: 40%;">المستودع</th>
              <th style="width: 10%;">تاريخ الإنشاء</th>
            </tr>
          </thead>
          <tbody>
            ${filteredBranchLinks.map((link, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${link.branchName || ''}</td>
                <td>${link.warehouseName || ''}</td>
                <td>${link.createdAt ? dayjs(link.createdAt.toDate()).format('DD/MM/YYYY') : ''}</td>
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
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>الفرع</span>,
      dataIndex: 'branchName',
      key: 'branchName',
      align: 'center' as const,
      render: (text: string) => (
        <span style={{ fontSize: '15px', fontWeight: 500, color: '#1890ff' }}>
          {text}
        </span>
      )
    },
    {
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>المستودع المربوط</span>,
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      align: 'center' as const,
      render: (text: string) => (
        <span style={{ fontSize: '15px', fontWeight: 500, color: '#52c41a' }}>
          {text}
        </span>
      )
    },
    {
      title: <span style={{ fontSize: '16px', fontWeight: 600 }}>تاريخ الإنشاء</span>,
      dataIndex: 'createdAt',
      key: 'createdAt',
      align: 'center' as const,
      width: 200,
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
      render: (_: unknown, record: BranchLink) => (
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
            title={<span style={{ fontSize: '15px' }}>هل أنت متأكد من حذف هذا الربط؟</span>}
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
        <title>ربط الفروع | ERP90 Dashboard</title>
        <meta name="description" content="ربط الفروع بالمستودعات في نظام ERP90" />
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
            <div className="p-2 bg-pink-100 dark:bg-pink-900 rounded-lg">
              <Building2 className="h-8 w-8 text-pink-600 dark:text-pink-300" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">ربط الفروع</h1>
              <p className="text-gray-600 dark:text-gray-400">ربط الفروع بمستودعات التوصيل</p>
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
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-pink-200"></div>
      </div>

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة التوصيلات", to: "/management/outputs" },
          { label: "ربط الفروع" }
        ]}
      />

      {/* Search and Actions */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label style={labelStyle}>البحث</label>
            <Input
              placeholder="ابحث بالفرع أو المستودع..."
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
            إضافة ربط
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
            total: filteredBranchLinks.length,
            onChange: (page) => setCurrentPage(page),
            showSizeChanger: false,
            showTotal: (total) => `إجمالي ${total} ربط`,
            position: ['bottomCenter'],
            style: { padding: '16px' }
          }}
          scroll={{ x: 800 }}
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
        title={editingBranchLink ? 'تعديل الربط' : 'إضافة ربط جديد'}
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
            label="الفرع"
            name="branchId"
            rules={[{ required: true, message: 'يرجى اختيار الفرع' }]}
          >
            <AntdSelect
              placeholder="اختر الفرع"
              size="large"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
              disabled={!!editingBranchLink}
            >
              {branches.map(branch => (
                <AntdSelect.Option key={branch.id} value={branch.id}>
                  {branch.name}
                </AntdSelect.Option>
              ))}
            </AntdSelect>
          </Form.Item>

          <Form.Item
            label="المستودع"
            name="warehouseId"
            rules={[{ required: true, message: 'يرجى اختيار المستودع' }]}
          >
            <AntdSelect
              placeholder="اختر المستودع"
              size="large"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {warehouses.map(warehouse => (
                <AntdSelect.Option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </AntdSelect.Option>
              ))}
            </AntdSelect>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'left' }}>
            <Space>
              <Button onClick={handleCloseModal}>
                إلغاء
              </Button>
              <Button type="primary" htmlType="submit">
                {editingBranchLink ? 'تحديث' : 'إضافة'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LinkBranches;
