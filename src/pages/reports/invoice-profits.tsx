  // دالة طباعة مخصصة لتقرير الفواتير

import React, { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet";
import { motion, AnimatePresence } from "framer-motion";
import { DatePicker, Input, Select, Button, Table } from "antd";
import { SearchOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import arEG from 'antd/es/date-picker/locale/ar_EG';
import { fetchBranches, Branch } from "@/lib/branches";
import Breadcrumb from "@/components/Breadcrumb";
import dayjs from 'dayjs';
import { collection, query, where, orderBy, getDocs, getDoc, doc, limit, startAfter } from 'firebase/firestore';
import type { Query, DocumentData } from 'firebase/firestore';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import styles from './ReceiptVoucher.module.css';


const { Option } = Select;

interface WarehouseOption {
  id: string;
  name?: string;
  nameAr?: string;
  nameEn?: string;
}

interface PaymentMethodOption {
  id: string;
  name: string;
}

interface CompanyData {
  arabicName?: string;
  englishName?: string;
  companyType?: string;
  commercialRegistration?: string;
  taxFile?: string;
  city?: string;
  region?: string;
  street?: string;
  district?: string;
  buildingNumber?: string;
  postalCode?: string;
  phone?: string;
  mobile?: string;
  logoUrl?: string;
}

// أنواع بيانات الفاتورة (مأخوذة من صفحة المبيعات)
interface InvoiceRecord {
  key: string;
  invoiceNumber: string;
  date: string;
  branch: string;
  itemNumber: string;
  itemName: string;
  mainCategory: string;
  quantity: number;
  price: number;
  total: number;
  discountValue: number;
  discountPercent: number;
  taxValue: number;
  taxPercent: number;
  net: number;
  cost: number;
  profit: number;
  warehouse: string;
  customer: string;
  customerPhone: string;
  seller: string;
  paymentMethod: string;
  invoiceType: string;
  isReturn: boolean;
  extraDiscount?: number;
  itemData?: Record<string, unknown>;
}

// تعريف نوع للـ ExcelJS
interface ExcelJSCell {
  font: Record<string, unknown>;
  alignment: Record<string, unknown>;
  fill?: Record<string, unknown>;
  border?: Record<string, unknown>;
}

interface ExcelJSRow {
  eachCell: (callback: (cell: ExcelJSCell) => void) => void;
  font: Record<string, unknown>;
  alignment: Record<string, unknown>;
}

interface ExcelJSWorksheet {
  columns: Array<{ header: string; key: string; width: number }>;
  addRows: (data: unknown[][]) => void;
  getRow: (index: number) => ExcelJSRow;
  rowCount: number;
  columnCount: number;
  views?: Array<{ state: string; ySplit: number }>;
  autoFilter?: { from: { row: number; column: number }; to: { row: number; column: number } };
}

interface ExcelJSWorkbook {
  addWorksheet: (name: string) => ExcelJSWorksheet;
  xlsx: {
    writeBuffer: () => Promise<ArrayBuffer>;
  };
}

interface ExcelJSType {
  Workbook: new () => ExcelJSWorkbook;
}

interface WindowWithExcelJS extends Window {
  ExcelJS?: ExcelJSType;
}

function InvoiceProfits() {
  const [showMore, setShowMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchId, setBranchId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [seller, setSeller] = useState<string>("");
  const [salesRepAccounts, setSalesRepAccounts] = useState<{ id: string; name: string; number: string; mobile?: string }[]>([]);

  // بيانات الشركة
  const [companyData, setCompanyData] = useState<CompanyData>({});

  // ستايل موحد لعناصر الإدخال والدروب داون مثل صفحة أمر البيع
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
  const handlePrint = () => {
    // حساب الإجماليات
    let totalAmount = 0;
    let totalDiscount = 0;
    let totalAfterDiscount = 0;
    let totalCost = 0;
    let totalProfit = 0;
    const groupedData = filteredInvoices;
    groupedData.forEach(inv => {
      const sign = inv.invoiceType === 'مرتجع' ? -1 : 1;
      totalAmount += sign * inv.total;
      totalDiscount += sign * inv.discountValue;
      totalAfterDiscount += sign * (inv.total - inv.discountValue);
      totalCost += sign * inv.cost;
      totalProfit += sign * ((inv.total - inv.discountValue) - inv.cost);
    });

    // إنشاء نافذة الطباعة
    const printWindow = window.open('', '', 'width=1400,height=900');
    printWindow?.document.write(`
      <html>
      <head>
        <title>طباعة تقرير الارباح</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap');
          @page { size: A4 landscape; margin: 15mm; }
          body { font-family: 'Tajawal', Arial, sans-serif; direction: rtl; padding: 10px; font-size: 11px; line-height: 1.3; margin: 0; }
          .company-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #000; padding-bottom: 10px; }
          .header-section { flex: 1; min-width: 0; padding: 0 8px; box-sizing: border-box; }
          .header-section.center { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 0 0 120px; max-width: 120px; min-width: 100px; }
          .logo { width: 100px; height: auto; margin-bottom: 8px; }
          .company-info-ar { text-align: right; font-size: 11px; font-weight: 500; line-height: 1.4; }
          .company-info-en { text-align: left; font-family: Arial, sans-serif; direction: ltr; font-size: 10px; font-weight: 500; line-height: 1.4; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .header h1 { color: #000; margin: 0; font-size: 20px; font-weight: 700; }
          .header p { color: #000; margin: 3px 0 0 0; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
          th, td { border: 1px solid #d1d5db; padding: 4px 2px; text-align: center; vertical-align: middle; font-size: 9px; }
          th { background-color: #bbbbbc !important; color: #fff; font-weight: 600; font-size: 9px; padding: 6px 4px; }
          tbody tr:nth-child(even) { background-color: #f5f5f5; }
          tbody tr:hover { background-color: #e5e5e5; }
          .return-invoice { color: #000; font-weight: 600; }
          .normal-invoice { color: #000; font-weight: 600; }
          .print-date { text-align: left; margin-top: 15px; font-size: 9px; color: #000; }
          .print-last-page-only { display: none; }
          .totals-container { margin-top: 20px; display: flex; justify-content: flex-start; direction: rtl; }
          .totals-table { width: 300px; font-size: 12px; border-radius: 8px; overflow: hidden; }
          .totals-table th { background-color: #000; color: #fff; padding: 10px; text-align: center; font-weight: bold; font-size: 14px; }
          .totals-table .total-label { background-color: #f8f9fa; padding: 8px 12px; text-align: right; font-weight: 600; width: 60%; }
          .totals-table .total-value { background-color: #fff; padding: 8px 12px; text-align: left; font-weight: 500; width: 40%; }
          .totals-table .final-total .total-label {}
          .totals-table .final-total .total-value { font-size: 13px; }
          @media print { body { margin: 0; padding: 10px; } .no-print { display: none; } .print-last-page-only { display: block; break-inside: avoid; page-break-inside: avoid; } table { page-break-inside: auto; } tbody { page-break-inside: auto; } .print-last-page-only { page-break-before: avoid; break-before: avoid; } }
        </style>
      </head>
      <body>
       <!-- Company Header Section -->
      <div class="company-header">
        <div class="header-section company-info-ar">
          <div>${companyData.arabicName || ''}</div>
          <div>${companyData.companyType || ''}</div>
          <div>السجل التجاري: ${companyData.commercialRegistration || ''}</div>
          <div>الملف الضريبي: ${companyData.taxFile || ''}</div>
          <div>العنوان: ${companyData.city || ''} ${companyData.region || ''} ${companyData.street || ''} ${companyData.district || ''} ${companyData.buildingNumber || ''}</div>
          <div>الرمز البريدي: ${companyData.postalCode || ''}</div>
          <div>الهاتف: ${companyData.phone || ''}</div>
          <div>الجوال: ${companyData.mobile || ''}</div>
        </div>
        <div class="header-section center">
          <img src="${companyData.logoUrl || 'https://via.placeholder.com/100x50?text=Company+Logo'}" class="logo" alt="Company Logo">
        </div>
        <div class="header-section company-info-en">
          <div>${companyData.englishName || ''}</div>
          <div>${companyData.companyType || ''}</div>
          <div>Commercial Reg.: ${companyData.commercialRegistration || ''}</div>
          <div>Tax File: ${companyData.taxFile || ''}</div>
          <div>Address: ${companyData.city || ''} ${companyData.region || ''} ${companyData.street || ''} ${companyData.district || ''} ${companyData.buildingNumber || ''}</div>
          <div>Postal Code: ${companyData.postalCode || ''}</div>
          <div>Phone: ${companyData.phone || ''}</div>
          <div>Mobile: ${companyData.mobile || ''}</div>
        </div>
      </div>
      
        <div class="header">
          <h1>تقرير أرباح الفواتير</h1>
          <p class="font-weight-bold">نظام إدارة الموارد ERP90</p>
          ${currentFinancialYear ? `<div style="margin-top: 5px; font-size: 13px; color: #555;">السنة المالية: ${currentFinancialYear.year}</div>` : ''}
          ${dateFrom && dateTo ? `<div style="margin-top: 10px; font-size: 14px;  color: #333;">الفترة: من ${dateFrom.format('DD/MM/YYYY')} إلى ${dateTo.format('DD/MM/YYYY')}</div>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 80px;">رقم الفاتورة/المرتجع</th>
              <th style="width: 70px;">التاريخ</th>
              <th style="width: 100px;">السعر قبل الضريبة والخصم</th>
              <th style="width: 60px;">الخصم</th>
              <th style="width: 85px;">المبلغ بعد الخصم</th>
              <th style="width: 65px;">التكلفة</th>
              <th style="width: 65px;">الربح</th>
              <th style="width: 65px;">الفرع</th>
              <th style="width: 70px;">المخزن</th>
            </tr>
          </thead>
          <tbody>
            ${groupedData.map(inv => {
              const sign = inv.invoiceType === 'مرتجع' ? -1 : 1;
              const afterDiscount = inv.total - inv.discountValue;
              const profit = sign * (afterDiscount - inv.cost);
              return `<tr>
                <td><span class="${inv.invoiceType === 'مرتجع' ? 'return-invoice' : 'normal-invoice'}">${inv.invoiceNumber || '-'}</span></td>
                <td>${inv.date ? dayjs(inv.date).format('YYYY-MM-DD') : ''}</td>
                <td><span class="${inv.invoiceType === 'مرتجع' ? 'return-invoice' : 'normal-invoice'}">${(sign * inv.total).toLocaleString()} ر.س</span></td>
                <td>${(sign * (inv.discountValue || 0)).toLocaleString()} ر.س</td>
                <td>${(sign * afterDiscount).toLocaleString()} ر.س</td>
                <td>${(sign * inv.cost).toLocaleString()} ر.س</td>
                <td><span style="color: ${profit >= 0 ? '#16a34a' : '#dc2626'}; font-weight: 500;">${profit.toLocaleString()} ر.س</span></td>
                <td>${getBranchName(inv.branch)}</td>
                <td>${getWarehouseName(inv.warehouse)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div class="print-last-page-only totals-container">
          <table class="totals-table">
            <thead>
              <tr><th colspan="2">الإجماليات النهائية</th></tr>
            </thead>
            <tbody>
              <tr><td class="total-label">إجمالي السعر قبل الضريبة والخصم:</td><td class="total-value">${totalAmount.toLocaleString()} ر.س</td></tr>
              <tr><td class="total-label">إجمالي الخصم:</td><td class="total-value">${totalDiscount.toLocaleString()} ر.س</td></tr>
              <tr><td class="total-label">المبلغ بعد الخصم:</td><td class="total-value">${totalAfterDiscount.toLocaleString()} ر.س</td></tr>
              <tr><td class="total-label">إجمالي التكلفة:</td><td class="total-value">${totalCost.toLocaleString()} ر.س</td></tr>
              <tr class="final-total"><td class="total-label">إجمالي الربح:</td><td class="total-value" style="color: ${totalProfit >= 0 ? '#16a34a' : '#dc2626'}; font-weight: bold;">${totalProfit.toLocaleString()} ر.س</td></tr>
            </tbody>
          </table>
        </div>
        <div class="print-date">تاريخ الطباعة: ${new Date().toLocaleDateString('en-GB')} - ${new Date().toLocaleTimeString('en-GB')}</div>
        <div style="margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-start; padding: 0 20px; page-break-inside: avoid;">
          <div style="flex: 1; text-align: right; font-size: 14px; font-weight: 500;"><div style="margin-bottom: 8px;">المسؤول المالي: ___________________</div><div>التوقيع: ___________________</div></div>
          <div style="flex: 1; text-align: center; position: relative;">
            <div style="margin-top: 10px; display: flex; justify-content: center; align-items: center; width: 180px; height: 70px; border: 3px dashed #000; border-radius: 50%; box-shadow: 0 3px 10px 0 rgba(0,0,0,0.12); opacity: 0.9; background: repeating-linear-gradient(135deg, #f8f8f8 0 10px, #fff 10px 20px); font-family: 'Tajawal', Arial, sans-serif; font-size: 16px; font-weight: bold; color: #000; letter-spacing: 1px; text-align: center; margin-left: auto; margin-right: auto; z-index: 2;">
              <div style="width: 100%;"><div style="font-size: 18px; font-weight: 700; line-height: 1.2;">${companyData.arabicName || 'الشركة'}</div><div style="font-size: 14px; font-weight: 500; margin-top: 4px; line-height: 1.1;">${companyData.phone ? 'هاتف: ' + companyData.phone : ''}</div></div>
            </div>
          </div>
          <div style="flex: 1; text-align: left; font-size: 14px; font-weight: 500;"><div style="margin-bottom: 8px;">مدير المبيعات: ___________________</div><div>التاريخ: ${new Date().toLocaleDateString('ar-SA')}</div></div>
        </div>
      </body>
      </html>
    `);
    setTimeout(() => { printWindow?.print(); }, 500);
  };

  // جلب بيانات الشركة من قاعدة البيانات
  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const { db } = await import('@/lib/firebase');
        const { query, collection, getDocs } = await import('firebase/firestore');
        const q = query(collection(db, "companies"));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docData = snapshot.docs[0];
          setCompanyData({ ...docData.data() });
        }
      } catch (e) {
        console.error("Error fetching company for print: ", e);
      }
    };
    fetchCompany();
  }, []);

  // جلب طرق الدفع من قاعدة البيانات
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const snap = await getDocs(collection(db, 'paymentMethods'));
        const options = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name || doc.id }));
        setPaymentMethods(options);
      } catch {
        setPaymentMethods([]);
      }
    };
    fetchPaymentMethods();
  }, []);

  // جلب المخازن من قاعدة البيانات
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const snap = await getDocs(collection(db, 'warehouses'));
        const options = snap.docs.map(doc => ({ 
          id: doc.id, 
          name: doc.data().name || doc.id,
          nameAr: doc.data().nameAr,
          nameEn: doc.data().nameEn
        }));
        setWarehouses(options);
      } catch {
        setWarehouses([]);
      }
    };
    fetchWarehouses();
  }, []);

  // جلب بيانات مندوبي المبيعات
  useEffect(() => {
    const fetchSalesReps = async () => {
      try {
        const { getDocs, collection, query, where, getDoc, doc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        // جلب من مجموعة accounts مع فلتر classification
        const accountsQuery = query(
          collection(db, 'accounts'),
          where('classification', '==', 'مندوب مبيعات')
        );
        const accountsSnap = await getDocs(accountsQuery);
        const accountsReps = accountsSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || doc.id,
          number: doc.data().number || '',
          mobile: doc.data().mobile || doc.data().phone || ''
        }));
        
        // جلب البائعين من الفواتير الموجودة وتحويل الـ IDs إلى أسماء
        const salesSnap = await getDocs(collection(db, 'sales_invoices'));
        const sellerIds = new Set<string>();
        
        salesSnap.docs.forEach(docSnap => {
          const data = docSnap.data();
          const seller = data.delegate || data.seller;
          if (seller && seller.trim() !== '') {
            sellerIds.add(seller);
          }
        });
        
        // تحويل الـ IDs إلى أسماء عن طريق البحث في accounts
        const salesReps: Array<{ id: string; name: string; number: string; mobile: string }> = [];
        
        for (const sellerId of Array.from(sellerIds)) {
          // أولاً، تحقق إذا كان موجود في accountsReps
          const existingRep = accountsReps.find(rep => 
            rep.id === sellerId || 
            rep.name === sellerId ||
            rep.number === sellerId
          );
          
          if (existingRep) {
            // إذا كان موجود، لا تضيفه مرة أخرى
            continue;
          }
          
          // إذا بدا sellerId كأنه ID، حاول جلب الاسم من accounts
          if (sellerId.length > 10 && /^[a-zA-Z0-9_-]+$/.test(sellerId)) {
            try {
              const accountDoc = await getDoc(doc(db, 'accounts', sellerId));
              if (accountDoc.exists()) {
                const accountData = accountDoc.data();
                salesReps.push({
                  id: sellerId,
                  name: accountData.name || sellerId,
                  number: accountData.number || '',
                  mobile: accountData.mobile || accountData.phone || ''
                });
              } else {
                // إذا لم يوجد في accounts، أضف sellerId كما هو
                salesReps.push({
                  id: sellerId,
                  name: sellerId,
                  number: '',
                  mobile: ''
                });
              }
            } catch {
              // في حالة حدوث خطأ، أضف sellerId كما هو
              salesReps.push({
                id: sellerId,
                name: sellerId,
                number: '',
                mobile: ''
              });
            }
          } else {
            // إذا لم يبدو كأنه ID، أضفه كاسم
            salesReps.push({
              id: sellerId,
              name: sellerId,
              number: '',
              mobile: ''
            });
          }
        }
        
        // دمج القوائم وإزالة المكرر
        const allReps = [...accountsReps, ...salesReps];
        const uniqueReps = allReps.filter((rep, index, self) => 
          index === self.findIndex(r => 
            r.name.toLowerCase() === rep.name.toLowerCase() || 
            r.id === rep.id
          )
        );
        
        setSalesRepAccounts(uniqueReps);
      } catch {
        setSalesRepAccounts([]);
      }
    };
    fetchSalesReps();
  }, []);

  // فلاتر البحث
  const [dateFrom, setDateFrom] = useState<dayjs.Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<dayjs.Dayjs | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<string>(""); // ""=الكل, "فاتورة", "مرتجع"

  // السنة المالية من السياق
  const { currentFinancialYear } = useFinancialYear();

  // دالة لفلترة التواريخ المسموحة في DatePicker حسب السنة المالية
  const disabledDate = (current: dayjs.Dayjs) => {
    if (!currentFinancialYear) return false;
    
    const startDate = dayjs(currentFinancialYear.startDate);
    const endDate = dayjs(currentFinancialYear.endDate);
    
    return current.isBefore(startDate, 'day') || current.isAfter(endDate, 'day');
  };

  // تعيين التواريخ الافتراضية حسب السنة المالية
  useEffect(() => {
    if (currentFinancialYear) {
      const startDate = dayjs(currentFinancialYear.startDate);
      const endDate = dayjs(currentFinancialYear.endDate);
      setDateFrom(startDate);
      setDateTo(endDate);
    }
  }, [currentFinancialYear]);

  // بيانات الفواتير
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<InvoiceRecord[]>([]);

  useEffect(() => {
    fetchBranches().then(data => {
      setBranches(data);
      setBranchesLoading(false);
    });
  }, []);

  // جلب الفواتير ومرتجعات المبيعات من Firebase
  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const { getDocs, collection, query, where, Query, CollectionReference } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      // --- فواتير المبيعات ---
      let q: Query<DocumentData> = collection(db, 'sales_invoices');
      const filters: ReturnType<typeof where>[] = [];
      if (branchId) filters.push(where('branch', '==', branchId));
      if (invoiceNumber) filters.push(where('invoiceNumber', '==', invoiceNumber));
      if (dateFrom) filters.push(where('date', '>=', dayjs(dateFrom).format('YYYY-MM-DD')));
      if (dateTo) filters.push(where('date', '<=', dayjs(dateTo).format('YYYY-MM-DD')));
      if (warehouseId) filters.push(where('warehouse', '==', warehouseId));
      if (filters.length > 0) {
        const { query: qFn } = await import('firebase/firestore');
        q = qFn(q, ...filters);
      }
      const snapshot = await getDocs(q);
      const salesRecords: InvoiceRecord[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as Record<string, unknown>;
        const invoiceNumber = (data.invoiceNumber as string) || '';
        const date = (data.date as string) || '';
        const branch = (data.branch as string) || '';
        const customer = (data.customerName as string) || (data.customer as string) || '';
        const customerPhone = (data.customerPhone as string) || '';
        const seller = (data.delegate as string) || (data.seller as string) || '';
        const paymentMethod = (data.paymentMethod as string) || '';
        const invoiceType = (data.type as string) || '';
        const items = Array.isArray(data.items) ? data.items : [];
        items.forEach((item: Record<string, unknown>, idx: number) => {
          const price = Number(item.price) || 0;
          const cost = Number(item.cost) || 0;
          const quantity = Number(item.quantity) || 0;
          const total = price * quantity; // السعر قبل الضريبة والخصم
          const discountValue = Number(item.discountValue) || 0;
          const discountPercent = Number(item.discountPercent) || 0;
          const taxValue = Number(item.taxValue) || 0;
          const taxPercent = Number(item.taxPercent) || 0;
          const net = Number(item.net) || (total - discountValue + taxValue);
          const profit = (price - cost) * quantity;
          salesRecords.push({
            key: doc.id + '-' + idx,
            invoiceNumber,
            date,
            branch,
            itemNumber: (item.itemNumber as string) || '',
            itemName: (item.itemName as string) || '',
            mainCategory: (item.mainCategory as string) || '',
            quantity,
            price,
            total,
            discountValue,
            discountPercent,
            taxValue,
            taxPercent,
            net,
            cost,
            profit,
            warehouse: (item.warehouseId as string) || (data.warehouse as string) || '',
            customer,
            customerPhone,
            seller,
            paymentMethod,
            invoiceType: invoiceType || 'فاتورة',
            isReturn: false,
            extraDiscount: Number(item.extraDiscount) || undefined,
            itemData: item
          });
        });
      });

      // --- مرتجعات المبيعات ---
      let qReturn: Query<DocumentData> = collection(db, 'sales_returns');
      const filtersReturn: ReturnType<typeof where>[] = [];
      if (branchId) filtersReturn.push(where('branch', '==', branchId));
      if (dateFrom) filtersReturn.push(where('date', '>=', dayjs(dateFrom).format('YYYY-MM-DD')));
      if (dateTo) filtersReturn.push(where('date', '<=', dayjs(dateTo).format('YYYY-MM-DD')));
      if (warehouseId) filtersReturn.push(where('warehouse', '==', warehouseId));
      if (filtersReturn.length > 0) {
        const { query: qFn } = await import('firebase/firestore');
        qReturn = qFn(qReturn, ...filtersReturn);
      }
      const snapshotReturn = await getDocs(qReturn);
      
      // إنشاء خريطة للفواتير الأصلية لجلب التكلفة منها
      const originalInvoicesMap = new Map();
      salesRecords.forEach(record => {
        if (!originalInvoicesMap.has(record.invoiceNumber)) {
          originalInvoicesMap.set(record.invoiceNumber, []);
        }
        originalInvoicesMap.get(record.invoiceNumber).push(record);
      });
      
      const returnRecords: InvoiceRecord[] = [];
      snapshotReturn.forEach(doc => {
        const data = doc.data() as Record<string, unknown>;
        const originalInvoiceNumber = (data.invoiceNumber as string) || '';
        const returnNumber = (data.referenceNumber as string) || (data.returnNumber as string) || doc.id; // استخدام رقم المرجع أولاً، ثم رقم المرتجع، وأخيراً ID الوثيقة
        
        // إذا كان هناك بحث برقم، تحقق من أنه يطابق رقم المرتجع أو رقم الفاتورة الأصلية
        if (invoiceNumber && returnNumber !== invoiceNumber && originalInvoiceNumber !== invoiceNumber) {
          return; // تخطى هذا المرتجع إذا لم يطابق رقم البحث
        }
        const date = (data.date as string) || '';
        const rawData = doc.data() as Record<string, unknown>;
        const branch = typeof rawData.branch === 'string' ? rawData.branch : '';
        const customer = (data.customerName as string) || (data.customer as string) || '';
        const customerPhone = (data.customerPhone as string) || '';
        const seller = (data.seller as string) || '';
        const paymentMethod = (data.paymentMethod as string) || '';
        const invoiceType = 'مرتجع';
        const items = Array.isArray(data.items) ? data.items : [];
        
        // جلب بيانات الفاتورة الأصلية للحصول على التكلفة
        const originalInvoiceItems = originalInvoicesMap.get(originalInvoiceNumber) || [];
        
        items.forEach((item: Record<string, unknown>, idx: number) => {
          const price = Number(item.price) || 0;
          
          // محاولة جلب التكلفة من عدة مصادر
          let cost = Number(item.cost) || 0;
          if (cost === 0) {
            cost = Number(item.purchasePrice) || 0;
          }
          
          // إذا لم نجد التكلفة، ابحث في الفاتورة الأصلية
          if (cost === 0) {
            const originalItem = originalInvoiceItems.find((origItem: InvoiceRecord) => 
              origItem.itemNumber === (item.itemNumber as string)
            );
            if (originalItem) {
              cost = originalItem.cost || 0;
            }
          }
          
          const quantity = Number(item.returnedQty) || 0;
          const total = price * quantity;
          const discountPercent = Number(item.discountPercent) || 0;
          const discountValue = total * discountPercent / 100;
          const taxPercent = Number(item.taxPercent) || 0;
          const taxValue = (total - discountValue) * taxPercent / 100;
          const net = total - discountValue + taxValue;
          const profit = (price - cost) * quantity * -1;
          returnRecords.push({
            key: 'return-' + doc.id + '-' + idx,
            invoiceNumber: returnNumber, // استخدم رقم المرتجع بدلاً من رقم الفاتورة
            date,
            branch,
            itemNumber: (item.itemNumber as string) || '',
            itemName: (item.itemName as string) || '',
            mainCategory: '',
            quantity,
            price,
            total,
            discountValue,
            discountPercent,
            taxValue,
            taxPercent,
            net,
            cost,
            profit,
            warehouse: (item.warehouseId as string) || (data.warehouse as string) || '',
            customer,
            customerPhone,
            seller,
            paymentMethod,
            invoiceType,
            isReturn: true,
            extraDiscount: undefined,
            itemData: item
          });
        });
      });

      // تجميع المبيعات والمرتجعات لكل فاتورة
      const grouped: { [key: string]: { sales?: InvoiceRecord[]; returns?: InvoiceRecord[] } } = {};
      salesRecords.forEach(rec => {
        if (!grouped[rec.invoiceNumber]) grouped[rec.invoiceNumber] = {};
        if (!grouped[rec.invoiceNumber].sales) grouped[rec.invoiceNumber].sales = [];
        grouped[rec.invoiceNumber].sales!.push(rec);
      });
      returnRecords.forEach(rec => {
        if (!grouped[rec.invoiceNumber]) grouped[rec.invoiceNumber] = {};
        if (!grouped[rec.invoiceNumber].returns) grouped[rec.invoiceNumber].returns = [];
        grouped[rec.invoiceNumber].returns!.push(rec);
      });

      // بناء مصفوفة النتائج: صف للمبيعات وصف للمرتجع لكل فاتورة
      const result: InvoiceRecord[] = [];
      Object.entries(grouped).forEach(([invoiceNumber, { sales, returns }]) => {
        // فقط أضف صف المبيعات إذا كان هناك مبيعات حقيقية (وليس فقط وجود المفتاح)
        if (sales && sales.length > 0) {
          const first = sales[0];
          const total = sales.reduce((acc, r) => acc + r.total, 0);
          const discountValue = sales.reduce((acc, r) => acc + r.discountValue, 0);
          const cost = sales.reduce((acc, r) => acc + r.cost, 0);
          const taxValue = sales.reduce((acc, r) => acc + (r.taxValue || 0), 0);
          // تحقق أن الفاتورة تطابق كل الفلاتر المطلوبة
          let matches = true;
          if (invoiceNumber && first.invoiceNumber !== invoiceNumber) matches = false;
          if (branchId && first.branch !== branchId) matches = false;
          if (warehouseId && first.warehouse !== warehouseId) matches = false;
          if (paymentMethod && first.paymentMethod !== paymentMethod) matches = false;
          if (seller && first.seller !== seller) matches = false;
          if (matches) {
            result.push({
              ...first,
              total,
              discountValue,
              cost,
              taxValue,
              isReturn: false,
              invoiceType: 'فاتورة',
            });
          }
        }
        // فقط أضف صف المرتجع إذا كان هناك مرتجع حقيقي
        if (returns && returns.length > 0) {
          const first = returns[0];
          const total = returns.reduce((acc, r) => acc + r.total, 0);
          const discountValue = returns.reduce((acc, r) => acc + r.discountValue, 0);
          const cost = returns.reduce((acc, r) => acc + r.cost, 0);
          const taxValue = returns.reduce((acc, r) => acc + (r.taxValue || 0), 0);
          // تحقق أن الفاتورة تطابق كل الفلاتر المطلوبة
          let matches = true;
          if (invoiceNumber && first.invoiceNumber !== invoiceNumber) matches = false;
          if (branchId && first.branch !== branchId) matches = false;
          if (warehouseId && first.warehouse !== warehouseId) matches = false;
          if (paymentMethod && first.paymentMethod !== paymentMethod) matches = false;
          if (seller && first.seller !== seller) matches = false;
          if (matches) {
            result.push({
              ...first,
              total,
              discountValue,
              cost,
              taxValue,
              isReturn: true,
              invoiceType: 'مرتجع',
            });
          }
        }
      });
      setInvoices(result);
    } catch (err) {
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  // تطبيق الفلاتر بعد جلب البيانات - محسنة بـ useMemo
  const filteredRows = useMemo(() => {
    let filtered = invoices;
    
    // فلتر نوع الفاتورة
    if (invoiceTypeFilter) {
      if (invoiceTypeFilter === 'فاتورة') {
        filtered = filtered.filter(inv => !inv.isReturn);
      } else if (invoiceTypeFilter === 'مرتجع') {
        filtered = filtered.filter(inv => inv.isReturn);
      } else {
        filtered = filtered.filter(inv => inv.invoiceType === invoiceTypeFilter);
      }
    }
    
    // فلتر طريقة الدفع
    if (paymentMethod) {
      filtered = filtered.filter(inv => inv.paymentMethod === paymentMethod);
    }
    
    // فلتر البائع - محسن للتعامل مع الأسماء والـ IDs
    if (seller) {
      filtered = filtered.filter(inv => {
        if (!inv.seller) return false;
        
        // أولاً: مقارنة مباشرة
        if (inv.seller === seller) return true;
        
        // ثانياً: البحث في قائمة salesRepAccounts
        const foundRep = salesRepAccounts.find(rep => 
          (rep.id === inv.seller && rep.name === seller) ||
          (rep.name === inv.seller && rep.name === seller)
        );
        if (foundRep) return true;
        
        // ثالثاً: التحويل باستخدام نفس منطق getSalesRepName
        // البحث بالـ ID
        const foundRepById = salesRepAccounts.find(rep => rep.id === inv.seller);
        if (foundRepById && foundRepById.name === seller) return true;
        
        // البحث بالاسم
        const foundRepByName = salesRepAccounts.find(rep => 
          rep.name === inv.seller ||
          rep.name.toLowerCase() === inv.seller.toLowerCase()
        );
        if (foundRepByName && foundRepByName.name === seller) return true;
        
        // البحث برقم الحساب
        const foundRepByNumber = salesRepAccounts.find(rep => rep.number === inv.seller);
        if (foundRepByNumber && foundRepByNumber.name === seller) return true;
        
        return false;
      });
    }
    
    return filtered;
  }, [invoices, invoiceTypeFilter, paymentMethod, seller, salesRepAccounts]);

  // دالة للتوافق مع الكود القديم
  const getFilteredRows = () => filteredRows;

  // تطبيق فلاتر التصفية القديمة
  useEffect(() => {
    setFilteredInvoices(filteredRows);
  }, [filteredRows]);

  // عند الضغط على بحث
  const handleSearch = () => {
    fetchInvoices();
  };

  // دالة لجلب اسم الفرع من القائمة
  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch ? branch.name : branchId;
  };

  // دالة لجلب اسم المخزن من القائمة
  const getWarehouseName = (warehouseId: string) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse ? (warehouse.nameAr || warehouse.name || warehouse.nameEn || warehouseId) : warehouseId;
  };

  // دالة لجلب اسم البائع من القائمة
  const getSalesRepName = (salesRepId: string) => {
    // إذا كان salesRepId فارغ أو undefined، أرجع قيمة افتراضية
    if (!salesRepId || salesRepId.trim() === '') return 'غير محدد';
    
    // أولاً: ابحث في قائمة حسابات البائعين بالـ ID
    const foundRepById = salesRepAccounts.find(rep => rep.id === salesRepId);
    if (foundRepById) {
      return foundRepById.name;
    }
    
    // ثانياً: ابحث في قائمة حسابات البائعين بالاسم
    const foundRepByName = salesRepAccounts.find(rep => 
      rep.name === salesRepId ||
      rep.name.toLowerCase() === salesRepId.toLowerCase()
    );
    if (foundRepByName) {
      return foundRepByName.name;
    }
    
    // ثالثاً: ابحث برقم الحساب
    const foundRepByNumber = salesRepAccounts.find(rep => rep.number === salesRepId);
    if (foundRepByNumber) {
      return foundRepByNumber.name;
    }
    
    // رابعاً: بحث جزئي في الأسماء
    const foundRepPartial = salesRepAccounts.find(rep => 
      rep.name.toLowerCase().includes(salesRepId.toLowerCase()) ||
      salesRepId.toLowerCase().includes(rep.name.toLowerCase())
    );
    if (foundRepPartial) {
      return foundRepPartial.name;
    }
    
    // خامساً: في حالة عدم العثور عليه في الحسابات، ابحث في البائعين الموجودين في الفواتير
    const uniqueSellers = Array.from(new Set(invoices.map(inv => inv.seller).filter(s => !!s && s !== '')));
    const foundSeller = uniqueSellers.find(seller => 
      seller === salesRepId || // مطابقة كاملة
      seller.toLowerCase().includes(salesRepId.toLowerCase()) || 
      salesRepId.toLowerCase().includes(seller.toLowerCase())
    );
    
    if (foundSeller) {
      return foundSeller;
    }
    
    // أخيراً: إذا بدا salesRepId كأنه ID (يحتوي على أرقام وحروف)، أرجع "غير محدد"
    // وإلا أرجع القيمة كما هي
    const isLikelyId = /^[a-zA-Z0-9_-]{10,}$/.test(salesRepId);
    return isLikelyId ? 'غير محدد' : salesRepId;
  };

  // دالة تصدير البيانات إلى ملف Excel باستخدام exceljs (حل متوافق مع Vite والمتصفح)
  const handleExport = async () => {
    // تحميل exceljs من CDN إذا لم يكن موجوداً في window
    let ExcelJS = (window as WindowWithExcelJS).ExcelJS;
    if (!ExcelJS) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js';
        script.onload = () => {
          ExcelJS = (window as WindowWithExcelJS).ExcelJS;
          resolve(null);
        };
        script.onerror = reject;
        document.body.appendChild(script);
      });
      ExcelJS = (window as WindowWithExcelJS).ExcelJS;
    }
    const exportData = filteredInvoices.map(inv => {
      const sign = inv.invoiceType === 'مرتجع' ? -1 : 1;
      const afterDiscount = inv.total - inv.discountValue;
      const profit = afterDiscount - inv.cost;
      
      return [
        inv.invoiceNumber,
        dayjs(inv.date).format('YYYY-MM-DD'),
        (sign * inv.total),
        (sign * inv.discountValue),
        (sign * afterDiscount),
        (sign * inv.cost),
        (sign * profit),
        getBranchName(inv.branch),
        getWarehouseName(inv.warehouse)
      ];
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('تقرير الأرباح');

    // إعداد الأعمدة
    sheet.columns = [
      { header: 'رقم الفاتورة/المرتجع', key: 'invoiceNumber', width: 25 },
      { header: 'التاريخ', key: 'date', width: 15 },
      { header: 'السعر قبل الضريبة والخصم', key: 'total', width: 20 },
      { header: 'الخصم', key: 'discount', width: 15 },
      { header: 'المبلغ بعد الخصم', key: 'afterDiscount', width: 18 },
      { header: 'التكلفة', key: 'cost', width: 15 },
      { header: 'الربح', key: 'profit', width: 15 },
      { header: 'الفرع', key: 'branch', width: 15 },
      { header: 'المخزن', key: 'warehouse', width: 15 },
    ];

    // إضافة البيانات
    sheet.addRows(exportData);

    // تنسيق رأس الجدول
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FF305496' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDDEBF7' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFAAAAAA' } },
        bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } },
        left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
        right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
      };
    });

    // تنسيق بقية الصفوف
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      row.eachCell(cell => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFAAAAAA' } },
          bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } },
          left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
          right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
        };
        // صفوف متبادلة اللون
        if (i % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF7F9FC' }
          };
        }
      });
    }

    // Freeze header row
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    // إضافة autofilter
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columnCount }
    };

    // إنشاء ملف وحفظه
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_الأرباح_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <>
      <Helmet>
        <title>تقرير أرباح الفواتير | ERP90 Dashboard</title>
        <meta name="description" content="تقرير أرباح فواتير المبيعات، عرض وتحليل الأرباح، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, فواتير, أرباح, مبيعات, تقرير, عملاء, Sales, Invoice, Profit, Report" />
      </Helmet>
      <div className="w-full min-h-screen p-4 md:p-6 flex flex-col gap-6 bg-gray-50" dir="rtl">
 
        {/* العنوان الرئيسي */}
        <div className="p-3 sm:p-4 font-['Tajawal'] bg-white mb-4 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden">
          <div className="flex items-center">
            <FileTextOutlined className="h-5 w-5 sm:h-8 sm:w-8 text-emerald-600 ml-1 sm:ml-3" />
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800">تقرير أرباح الفواتير</h1>
          </div>
          <p className="text-xs sm:text-base text-gray-600 mt-2">تقرير أرباح فواتير المبيعات</p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-500"></div>
        </div>

        <Breadcrumb
          items={[
            { label: "الرئيسية", to: "/" },
            { label: "إدارة المبيعات", to: "/management/sales" },
            { label: "تقرير أرباح الفواتير" }
          ]}
        />

        {/* Search Options */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm relative"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
          
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <SearchOutlined className="text-emerald-600" /> خيارات البحث
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <span style={labelStyle}>من تاريخ</span>
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
            
            <div className="flex flex-col">
              <span style={labelStyle}>إلى تاريخ</span>
              <DatePicker 
                value={dateTo}
                onChange={setDateTo}
                placeholder="اختر التاريخ"
                style={largeControlStyle}
                size="large"
                format="YYYY-MM-DD"
                locale={arEG}
                disabledDate={disabledDate}
              />
            </div>
            
            <div className="flex flex-col">
              <span style={labelStyle}>رقم الفاتورة/المرتجع</span>
              <Input 
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="ادخل رقم الفاتورة أو المرتجع"
                style={largeControlStyle}
                size="large"
                allowClear
              />
            </div>
            
            <div className="flex flex-col">
              <span style={labelStyle}>الفرع</span>
              <Select
                value={branchId}
                onChange={setBranchId}
                placeholder="اختر الفرع"
                style={{ width: '100%', ...largeControlStyle }}
                size="large"
                className={styles.noAntBorder}
                
                optionFilterProp="label"
                allowClear
                showSearch
                loading={branchesLoading}
                filterOption={(input, option) =>
                  option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                }
              >
                {branches.map(branch => (
                  <Option key={branch.id} value={branch.id}>
                    {branch.name}
                  </Option>
                ))}
              </Select>
            </div>
          </div>

          <AnimatePresence>
            {showMore && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                  <div className="flex flex-col">
                    <span style={labelStyle}>المخزن</span>
                    <Select
                      value={warehouseId || undefined}
                      onChange={setWarehouseId}
                      placeholder="اختر المخزن"
                      style={{ width: '100%', ...largeControlStyle }}
                      size="large"
                      optionFilterProp="label"
                      allowClear
                      className={styles.noAntBorder}

                      showSearch
                      filterOption={(input, option) =>
                        option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                      }
                    >
                      {warehouses.map(w => (
                        <Option key={w.id} value={w.id}>{w.nameAr || w.name || w.nameEn || w.id}</Option>
                      ))}
                    </Select>
                  </div>
                  
                  <div className="flex flex-col">
                    <span style={labelStyle}>طريقة الدفع</span>
                    <Select
                      value={paymentMethod || undefined}
                      onChange={setPaymentMethod}
                      placeholder="اختر طريقة الدفع"
                      style={{ width: '100%', ...largeControlStyle }}
                      size="large"
                      className={styles.noAntBorder}

                      optionFilterProp="label"
                      allowClear
                    >
                      {paymentMethods.map(m => (
                        <Option key={m.id} value={m.name}>{m.name}</Option>
                      ))}
                    </Select>
                  </div>
                  
                  <div className="flex flex-col">
                    <span style={labelStyle}>نوع الفاتورة</span>
                    <Select
                      value={invoiceTypeFilter}
                      onChange={v => setInvoiceTypeFilter(v)}
                      placeholder="اختر نوع الفاتورة"
                      style={{ width: '100%', ...largeControlStyle }}
                      size="large"
                      allowClear
                className={styles.noAntBorder}
                    >
                      <Option value="">الكل</Option>
                      <Option value="فاتورة">فاتورة</Option>
                      <Option value="مرتجع">مرتجع</Option>
                    </Select>
                  </div>
 
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="flex items-center gap-4 mt-4">
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
              loading={isLoading}
              className="bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
              size="large"
            >
              {isLoading ? "جاري البحث..." : "بحث"}
            </Button>
            <span className="text-gray-500 text-sm">
              نتائج البحث: {filteredInvoices.length} فاتورة
            </span>
          </div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="absolute left-4 top-4 flex items-center gap-2 cursor-pointer text-blue-600 select-none"
            onClick={() => setShowMore((prev) => !prev)}
          >
            <span className="text-sm font-medium">{showMore ? "إخفاء الخيارات الإضافية" : "عرض خيارات أكثر"}</span>
            <motion.svg
              animate={{ rotate: showMore ? 180 : 0 }}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-4 h-4 transition-transform"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </motion.svg>
          </motion.div>
        </motion.div>

        {/* Search Results */}
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
              نتائج البحث ({filteredInvoices.length} فاتورة)
            </h3>
            <div className="flex items-center gap-2">
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExport}
                disabled={filteredInvoices.length === 0}
                className="bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700"
                size="large"
              >
                تصدير إكسل
              </Button>
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
                size="large"
              >
                طباعة
              </Button>
            </div>
          </div>

          <Table
            columns={[
              {
                title: 'رقم الفاتورة/المرتجع',
                dataIndex: 'invoiceNumber',
                key: 'invoiceNumber',
                width: 160,
                sorter: (a: InvoiceRecord, b: InvoiceRecord) => a.invoiceNumber.localeCompare(b.invoiceNumber),
                render: (text: string, record: InvoiceRecord) => (
                  <span className={`font-medium ${record.invoiceType === 'مرتجع' ? 'text-red-600' : 'text-blue-600'}`}>
                    {text}
                  </span>
                )
              },
              {
                title: 'التاريخ',
                dataIndex: 'date',
                key: 'date',
                width: 120,
                sorter: (a: InvoiceRecord, b: InvoiceRecord) => dayjs(a.date).unix() - dayjs(b.date).unix(),
                render: (text: string) => dayjs(text).format('YYYY-MM-DD')
              },
              {
                title: 'السعر قبل الضريبة والخصم',
                dataIndex: 'total',
                key: 'total',
                width: 160,
                align: 'center',
                sorter: (a: InvoiceRecord, b: InvoiceRecord) => a.total - b.total,
                render: (value: number, record: InvoiceRecord) => {
                  const sign = record.invoiceType === 'مرتجع' ? -1 : 1;
                  return (
                    <span className={record.invoiceType === 'مرتجع' ? 'text-red-600' : 'text-green-600'}>
                      {(sign * value).toLocaleString()} ر.س
                    </span>
                  );
                }
              },
              {
                title: 'الخصم',
                dataIndex: 'discountValue',
                key: 'discountValue',
                width: 120,
                align: 'center',
                sorter: (a: InvoiceRecord, b: InvoiceRecord) => a.discountValue - b.discountValue,
                render: (value: number, record: InvoiceRecord) => {
                  const sign = record.invoiceType === 'مرتجع' ? -1 : 1;
                  return `${(sign * (value || 0)).toLocaleString()} ر.س`;
                }
              },
              {
                title: 'المبلغ بعد الخصم',
                key: 'afterDiscount',
                width: 150,
                align: 'center',
                render: (record: InvoiceRecord) => {
                  const afterDiscount = record.total - record.discountValue;
                  const sign = record.invoiceType === 'مرتجع' ? -1 : 1;
                  return `${(sign * afterDiscount).toLocaleString()} ر.س`;
                },
                sorter: (a: InvoiceRecord, b: InvoiceRecord) => (a.total - a.discountValue) - (b.total - b.discountValue),
              },
              {
                title: 'التكلفة',
                dataIndex: 'cost',
                key: 'cost',
                width: 120,
                align: 'center',
                sorter: (a: InvoiceRecord, b: InvoiceRecord) => a.cost - b.cost,
                render: (value: number, record: InvoiceRecord) => {
                  const sign = record.invoiceType === 'مرتجع' ? -1 : 1;
                  return (
                    <span>
                      {(sign * value).toLocaleString()} ر.س
                    </span>
                  );
                }
              },
              {
                title: 'الربح',
                key: 'profit',
                width: 120,
                align: 'center',
                sorter: (a: InvoiceRecord, b: InvoiceRecord) => ((a.total - a.discountValue) - a.cost) - ((b.total - b.discountValue) - b.cost),
                render: (record: InvoiceRecord) => {
                  const sign = record.invoiceType === 'مرتجع' ? -1 : 1;
                  const afterDiscount = record.total - record.discountValue;
                  const profit = sign * (afterDiscount - record.cost);
                  return (
                    <span className={profit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {profit.toLocaleString()} ر.س
                    </span>
                  );
                }
              },
              {
                title: 'الفرع',
                dataIndex: 'branch',
                key: 'branch',
                width: 120,
                sorter: (a: InvoiceRecord, b: InvoiceRecord) => getBranchName(a.branch).localeCompare(getBranchName(b.branch)),
                render: (text: string) => getBranchName(text)
              },
              {
                title: 'المخزن',
                dataIndex: 'warehouse',
                key: 'warehouse',
                width: 120,
                sorter: (a: InvoiceRecord, b: InvoiceRecord) => getWarehouseName(a.warehouse).localeCompare(getWarehouseName(b.warehouse)),
                render: (warehouse: string) => getWarehouseName(warehouse),
              }
            ]}
            dataSource={getFilteredRows()}
            rowKey="key"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              position: ['bottomRight'],
              showTotal: (total, range) => `عرض ${range[0]}-${range[1]} من ${total} فاتورة`
            }}
            loading={isLoading}
            scroll={{ x: 1100 }}
            size="small"
            bordered
            className="[&_.ant-table-thead_>_tr_>_th]:bg-gray-400 [&_.ant-table-thead_>_tr_>_th]:text-white [&_.ant-table-thead_>_tr_>_th]:border-gray-400 [&_.ant-table-tbody_>_tr:hover_>_td]:bg-emerald-50"
            locale={{
              emptyText: isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-400">لا توجد بيانات</div>
              )
            }}
            summary={() => {
              if (getFilteredRows().length === 0) return null;
              
              // حساب الإجماليات
              const allRows = getFilteredRows();
              let totalAmount = 0;
              let totalDiscount = 0;
              let totalAfterDiscount = 0;
              let totalCost = 0;
              let totalProfit = 0;

              allRows.forEach((row: InvoiceRecord) => {
                const sign = row.invoiceType === 'مرتجع' ? -1 : 1;
                totalAmount += sign * row.total;
                totalDiscount += sign * row.discountValue;
                totalAfterDiscount += sign * (row.total - row.discountValue);
                totalCost += sign * row.cost;
                totalProfit += sign * ((row.total - row.discountValue) - row.cost);
              });

              return (
                <Table.Summary fixed>
                  <Table.Summary.Row className="">
                    <Table.Summary.Cell index={0} className="text-center font-bold">الإجماليات</Table.Summary.Cell>
                    <Table.Summary.Cell index={1}></Table.Summary.Cell>
                    <Table.Summary.Cell index={2} className="text-center font-bold text-blue-600">
                      {totalAmount.toLocaleString()} ر.س
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} className="text-center font-bold text-red-600">
                      {totalDiscount.toLocaleString()} ر.س
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} className="text-center font-bold text-orange-600">
                      {totalAfterDiscount.toLocaleString()} ر.س
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} className="text-center font-bold">
                      {totalCost.toLocaleString()} ر.س
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6} className={`text-center font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalProfit.toLocaleString()} ر.س
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7}></Table.Summary.Cell>
                    <Table.Summary.Cell index={8}></Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        </motion.div>
      </div>
    </>
  );
};

export default InvoiceProfits;
