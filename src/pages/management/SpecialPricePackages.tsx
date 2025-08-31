import React, { useState, useEffect, useRef, useMemo } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate } from 'react-router-dom';
import { getDocs, query, collection } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { DatePicker, Input, Select, Button, Table, Pagination, Switch } from "antd";
import { SearchOutlined, DownloadOutlined, FileTextOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import arEG from 'antd/es/date-picker/locale/ar_EG';
import { fetchBranches, Branch } from "@/lib/branches";
import Breadcrumb from "@/components/Breadcrumb";
import styles from './ReceiptVoucher.module.css';

import { useFinancialYear } from "@/hooks/useFinancialYear";
import dayjs from 'dayjs';





const labelStyle: React.CSSProperties = {
  fontWeight: 'bold',
  marginBottom: '6px',
  color: '#444',
  fontSize: '1rem',
  textAlign: 'right'
};

const SpecialPricePackages: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState({ company: '', branch: '', name: '', packageNumber: '' });
  const [searchLoading, setSearchLoading] = useState(false);
  // Date state
  const [dateFrom, setDateFrom] = useState<dayjs.Dayjs | null>(null);
  // Company state
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  // جلب الشركة الحقيقية عند تحميل الصفحة
  useEffect(() => {
    setCompaniesLoading(true);
    import("@/lib/firebase").then(({ db }) => {
      import("firebase/firestore").then(({ getDocs, query, collection }) => {
        const q = query(collection(db, "companies"));
        getDocs(q)
          .then((snapshot) => {
            if (!snapshot.empty) {
              const docData = snapshot.docs[0];
              setCompanies([{ id: docData.id, name: docData.data().arabicName || docData.data().englishName || "" }]);
            } else {
              setCompanies([]);
            }
          })
          .catch(() => {
            setCompanies([]);
          })
          .finally(() => {
            setCompaniesLoading(false);
          });
      });
    });
  }, []);
  // Branch state
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  // دالة لطباعة جدول باقات الأسعار فقط
  const handlePrintTable = () => {
    const printWindow = window.open('', '', 'width=1400,height=900');
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head>
          <title>طباعة باقات الأسعار الخاصة</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap');
            @page { size: A4 landscape; margin: 15mm; }
            body { font-family: 'Tajawal', Arial, sans-serif; direction: rtl; padding: 10px; font-size: 12px; line-height: 1.3; margin: 0; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .header h1 { color: #000; margin: 0; font-size: 20px; font-weight: 700; }
            .header p { color: #000; margin: 3px 0 0 0; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 6px 2px; text-align: center; vertical-align: middle; font-size: 12px; }
            th { background-color: #bbbbbc !important; color: #fff; font-weight: 600; font-size: 13px; padding: 8px 4px; }
            tbody tr:nth-child(even) { background-color: #f5f5f5; }
            tbody tr:hover { background-color: #e5e5e5; }
            .print-date { text-align: left; margin-top: 15px; font-size: 11px; color: #000; }
            @media print { body { margin: 0; padding: 10px; } table { page-break-inside: auto; } tbody { page-break-inside: auto; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>تقرير باقات الأسعار الخاصة</h1>
            <p class="font-weight-bold">نظام إدارة الموارد ERP90</p>
            <div style="margin-top: 5px; font-size: 13px; color: #555;">تاريخ الطباعة: ${new Date().toLocaleDateString('en-GB')} - ${new Date().toLocaleTimeString('en-GB')}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>رقم الباقة</th>
                <th>اسم الباقة (عربي)</th>
                <th>اسم الباقة (إنجليزي)</th>
                <th>تاريخ الانتهاء</th>
                <th>الفرع</th>
                <th>الشركة</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${results.map(pkg => `
                <tr>
                  <td>${pkg.id}</td>
                  <td>${pkg.name}</td>
                  <td>${pkg.nameEn}</td>
                  <td>${pkg.endDate || '—'}</td>
                  <td>${pkg.branch}</td>
                  <td>${pkg.company}</td>
                  <td>${pkg.active ? 'مفعل' : 'غير مفعل'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 300);
    }
  };
  // جلب الفروع الحقيقية عند تحميل الصفحة
  useEffect(() => {
    setBranchesLoading(true);
    fetchBranches()
      .then((data) => {
        setBranches(data.map(branch => ({ id: branch.id || '', name: branch.name })));
      })
      .catch(() => {
        setBranches([]);
      })
      .finally(() => {
        setBranchesLoading(false);
      });
  }, []);
  // Style for large controls (مطابق لصفحة الإضافة)
  const largeControlStyle: React.CSSProperties = {
    height: 48,
    fontSize: 18,
    borderRadius: 8,
    padding: "8px 16px",
    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
    background: "#fff",
    border: "1.5px solid #d9d9d9",
    transition: "border-color 0.3s",
  };
  const labelStyle: React.CSSProperties = { fontSize: 18, fontWeight: 500 };
  // Disabled date function for DatePicker
  const disabledDate = (current: dayjs.Dayjs) => {
    // Example: disable future dates
    return current && current > dayjs();
  };
  type SpecialPricePackage = {
    id: string; // packageCode
    docId: string; // document id in Firestore
    name: string;
    nameEn: string;
    endDate: string;
    branch: string;
    company: string;
    active?: boolean;
  };
  const [results, setResults] = useState<SpecialPricePackage[]>([]);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  // تفعيل/إلغاء تفعيل الباقة
  const handleToggleActive = async (docId: string, currentActive?: boolean) => {
    setToggleLoadingId(docId);
    try {
      const { db } = await import("@/lib/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "specialPricePackages", docId), { active: !currentActive });
      setResults(prev => prev.map(pkg => pkg.docId === docId ? { ...pkg, active: !currentActive } : pkg));
    } catch (e) {
      // يمكن إضافة رسالة خطأ هنا
    } finally {
      setToggleLoadingId(null);
    }
  };
  // حذف باقة من قاعدة البيانات باستخدام docId
  const handleDelete = async (docId: string) => {
    setDeleteLoadingId(docId);
    try {
      const { db } = await import("@/lib/firebase");
      const { doc, deleteDoc } = await import("firebase/firestore");
      // حذف المستند من فايربيز
      await deleteDoc(doc(db, "specialPricePackages", docId));
      // تحديث النتائج في الواجهة
      setResults(prev => prev.filter(pkg => pkg.docId !== docId));
    } catch (e) {
      // يمكن إضافة رسالة خطأ هنا
    } finally {
      setDeleteLoadingId(null);
    }
  };
  const [currentPage, setCurrentPage] = useState(1);

  // جلب باقات الأسعار من فايربيز مع تحويل الأكواد إلى أسماء
  useEffect(() => {
    (async () => {
      try {
        const { db } = await import("@/lib/firebase");
        const { getDocs, collection } = await import("firebase/firestore");
        // جلب الشركات والفروع أولاً
        const [companiesSnap, branchesSnap, packagesSnap] = await Promise.all([
          getDocs(collection(db, "companies")),
          getDocs(collection(db, "branches")),
          getDocs(collection(db, "specialPricePackages"))
        ]);
        const companiesMap = {};
        companiesSnap.docs.forEach(doc => {
          const data = doc.data();
          companiesMap[doc.id] = data.arabicName || data.englishName || doc.id;
        });
        const branchesMap = {};
        branchesSnap.docs.forEach(doc => {
          const data = doc.data();
          branchesMap[doc.id] = data.name || doc.id;
        });
        const packages = packagesSnap.docs.map(doc => {
          const data = doc.data();
          // تحويل أكواد الفروع إلى أسماء
          let branchNames = "";
          if (Array.isArray(data.branches)) {
            branchNames = data.branches.map((bid: string) => branchesMap[bid] || bid).join(", ");
          }
          // تحويل كود الشركة إلى اسم
          const companyName = companiesMap[data.company] || data.company || "";
          // إذا لم يوجد حقل active في المستند، احفظه في قاعدة البيانات كـ true
          if (typeof data.active !== 'boolean') {
            (async () => {
              const { db } = await import("@/lib/firebase");
              const { doc, updateDoc } = await import("firebase/firestore");
              await updateDoc(doc(db, "specialPricePackages", doc.id), { active: true });
            })();
          }
          return {
            id: data.packageCode || doc.id,
            docId: doc.id,
            name: data.packageNameAr || "",
            nameEn: data.packageNameEn || "",
            endDate: data.endDate || "",
            branch: branchNames,
            company: companyName,
            active: typeof data.active === 'boolean' ? data.active : true
          };
        });
        setResults(packages);
      } catch (e) {
        setResults([]);
      }
    })();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch({ ...search, [e.target.name]: e.target.value });
  };

  function getTotalPages() {
    // Replace with real logic if needed
    return 1;
  }

  const handleSearch = () => {
    setSearchLoading(true);
    setTimeout(() => {
      setResults(prev => prev.filter(pkg => {
        // فلترة الشركة
        const companyMatch = !search.company || (pkg.company && pkg.company.includes(search.company));
        // فلترة الفرع
        const branchMatch = !search.branch || (pkg.branch && pkg.branch.includes(search.branch));
        // فلترة اسم الباقة بالعربي
        const nameMatch = !search.name || (pkg.name && pkg.name.includes(search.name));
        // فلترة اسم الباقة بالإنجليزي
        const nameEnMatch = !search.name || (pkg.nameEn && pkg.nameEn.includes(search.name));
        // فلترة رقم الباقة
        const codeMatch = !search.packageNumber || (pkg.id && pkg.id.includes(search.packageNumber));
        // فلترة تاريخ الانتهاء
        const dateMatch = !dateFrom || (pkg.endDate && pkg.endDate.includes(dateFrom.format('YYYY-MM-DD')));
        return companyMatch && branchMatch && nameMatch && nameEnMatch && codeMatch && dateMatch;
      }));
      setSearchLoading(false);
    }, 700); // simulate loading
  };

    function getFilteredRows() {
        // TODO: Replace with real filtering logic based on your data
        // For now, return an empty array or mock data structure similar to your table rows
        return [];
    }

  return (
    <div>
      <div className="w-full min-h-screen p-4 md:p-6 flex flex-col gap-6 bg-gray-50" dir="rtl">
 
        {/* العنوان الرئيسي */}
        <div className="p-3 sm:p-4 font-['Tajawal'] bg-white mb-4 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden">
          <div className="flex items-center">
            <FileTextOutlined className="h-5 w-5 sm:h-8 sm:w-8 text-emerald-600 ml-1 sm:ml-3" />
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800">باقات الأسعار</h1>
          </div>
          <p className="text-xs sm:text-base text-gray-600 mt-2">إدارة وعرض باقات الأسعار الخاصة</p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-500"></div>
        </div>
          <Breadcrumb
                items={[
                  { label: "الرئيسية", to: "/" },
                  { label: "إدارة المبيعات", to: "/management/sales" },
                  { label: "باقات أسعار خاصة" }
                ]}
              />
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
        {/* عنوان خيارات البحث وزر الإضافة بجانب بعض */}
        <div className="flex items-center gap-2 mb-2 justify-between">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2 mb-0">
            <SearchOutlined className="text-emerald-600" /> خيارات البحث
          </h3>
          <Button
            type="primary"
            className="bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => {
              navigate('/management/sales/add-special-price-package');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            إضافة باقة جديدة
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>التاريخ</label>
            <DatePicker 
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="اختر التاريخ"
              style={largeControlStyle}
              size="large"
              format="YYYY-MM-DD"
              locale={arEG}
              disabledDate={disabledDate}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>الشركة</label>
            <Select
              value={companyId}
              onChange={setCompanyId}
              placeholder="اختر الشركة"
              style={largeControlStyle}
              size="large"
               className={styles.dropdown}
              optionFilterProp="label"
              allowClear
              showSearch
            >
              {companies.map(company => (
                <Select.Option key={company.id} value={company.id} label={company.name}>
                  {company.name}
                </Select.Option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>الفرع</label>
            <Select
              value={branchId}
              onChange={setBranchId}
              placeholder="اختر الفرع"
              style={largeControlStyle}
              size="large"
              optionFilterProp="label"
              allowClear
               className={styles.dropdown}
              showSearch
              loading={branchesLoading}
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase())
              }
            >
              {branches.map(branch => (
                <Select.Option key={branch.id} value={branch.id} label={branch.name}>
                  {branch.name}
                </Select.Option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>رقم الباقة</label>
            <Input
              name="packageNumber"
              placeholder="رقم الباقة"
              value={search.packageNumber}
              onChange={handleChange}
              style={largeControlStyle}
              size="large"
              className="text-right"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4">
          <Button
            type="primary"
            icon={searchLoading ? <span className="ant-spin ant-spin-sm" style={{ marginRight: 6 }}><svg className="ant-spin-dot-spin" viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor"><path d="M512 64a448 448 0 1 0 0 896 448 448 0 0 0 0-896zm0 64a384 384 0 1 1 0 768 384 384 0 0 1 0-768z" opacity=".1"/><path d="M512 64a448 448 0 1 0 0 896V64z"/></svg></span> : <SearchOutlined />}
            onClick={handleSearch}
            className="bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
            size="large"
            loading={searchLoading}
            disabled={searchLoading}
          >
            {searchLoading ? "جاري البحث..." : "بحث"}
          </Button>
          <span className="text-gray-500 text-sm">
            نتائج البحث: {
              Object.keys(
                getFilteredRows().reduce((acc, inv) => {
                  const key = inv.invoiceNumber + '-' + inv.invoiceType;
                  acc[key] = true;
                  return acc;
                }, {})
              ).length
            } - عرض الصفحة {currentPage} من {getTotalPages()}
          </span>
        </div>
      </motion.div>
      {/* نتائج البحث */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm overflow-x-auto relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            نتائج البحث ({results.length} باقة)
          </h3>
          <div className="flex items-center gap-2">
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {}}
              disabled={results.length === 0}
              className="bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700"
              size="large"
            >
              تصدير إكسل
            </Button>
            <Button
              type="primary"
              className="bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
              size="large"
              onClick={handlePrintTable}
            >
              طباعة
            </Button>
          </div>
        </div>
        <Table
          style={{ direction: 'rtl' }}
          columns={[ 
            {
              title: 'رقم الباقة',
              dataIndex: 'id',
              key: 'id',
              minWidth: 130,
            },
            {
              title: 'اسم الباقة (عربي)',
              dataIndex: 'name',
              key: 'name',
              minWidth: 150,
            },
            {
              title: 'اسم الباقة (إنجليزي)',
              dataIndex: 'nameEn',
              key: 'nameEn',
              minWidth: 150,
            },
            {
              title: 'تاريخ الانتهاء',
              dataIndex: 'endDate',
              key: 'endDate',
              minWidth: 120,
              render: (date: string) => date ? <span>{date}</span> : <span style={{color:'#aaa'}}>—</span>
            },
            {
              title: 'الفرع',
              dataIndex: 'branch',
              key: 'branch',
              minWidth: 120,
            },
            {
              title: 'الشركة',
              dataIndex: 'company',
              key: 'company',
              minWidth: 120,
            },
            {
              title: 'الإجراءات',
              key: 'actions',
              minWidth: 120,
              render: (_: unknown, record: SpecialPricePackage) => (
                <div className="flex gap-2 items-center">
                  <Button
                    size="small"
                    type="text"
                    icon={<EditOutlined />}
                    title="تعديل"
                    style={{ background: '#1677ff', color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(22,119,255,0.15)' }}
                    onClick={() => {
                      navigate(`/management/sales/edit-special-price-package/${record.docId}`);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={!record.active}
                  />
                  <Button
                    size="small"
                    type="text"
                    icon={<DeleteOutlined />}
                    title="حذف"
                    style={{ background: '#d90429', color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(217,4,41,0.15)' }}
                    loading={deleteLoadingId === record.docId}
                    onClick={() => handleDelete(record.docId)}
                    disabled={!record.active}
                  />
                  <Switch
                    checked={!!record.active}
                    loading={toggleLoadingId === record.docId}
                    onChange={() => handleToggleActive(record.docId, record.active)}
                    checkedChildren="مفعل"
                    unCheckedChildren="غير مفعل"
                    style={{ minWidth: 70 }}
                  />
                </div>
              ),
            },
          ]}
          dataSource={results}
          rowKey="id"
          pagination={false}
          scroll={{ x: 800 }}
          size="small"
          bordered
          className="[&_.ant-table-thead_>_tr_>_th]:bg-blue-200 [&_.ant-table-thead_>_tr_>_th]:text-gray-800 [&_.ant-table-thead_>_tr_>_th]:border-blue-200 [&_.ant-table-tbody_>_tr:hover_>_td]:bg-emerald-50"
          rowClassName={(record) => record.active === false ? 'opacity-60 bg-gray-200' : ''}
          locale={{
            emptyText: (
              <div className="text-gray-400 py-8">لا توجد بيانات</div>
            )
          }}
        />
        {/* Pagination */}
        {results.length > 0 && (
          <div className="flex justify-center mt-4">
            <Pagination
              current={currentPage}
              total={results.length}
              pageSize={10}
              onChange={setCurrentPage}
              showSizeChanger={false}
              showQuickJumper
              showTotal={(total, range) => `${range[0]}-${range[1]} من ${total} نتيجة`}
              className="bg-white [&_.ant-pagination-item-active]:border-emerald-600"
            />
          </div>
        )}
      </motion.div>
      </div>
    </div>
  );
};

export default SpecialPricePackages;
