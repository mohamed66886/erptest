import React, { useState, useEffect } from 'react';
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { DatePicker, Table, Card, Statistic, Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from "@/components/Breadcrumb";
import { Helmet } from "react-helmet";
import { 
  Package, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  FileBarChart,
  Truck,
  DollarSign
} from 'lucide-react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import dayjs, { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

const { RangePicker } = DatePicker;

interface OrderData {
  id: string;
  status?: string;
  driverName?: string;
  branchBalance?: number | string; // حالة الفرع = مبلغ التوصيل
  deliveryAmount?: number | string;
  totalAmount?: number | string;
  orderDate?: any;
  [key: string]: any;
}

interface DriverReportData {
  key: string;
  driverName: string;
  totalOrders: number;
  completedOrders: number;
  inProgressOrders: number;
  completionRate: number;
  deliveryAmount: number;
}

const ComprehensiveReports: React.FC = () => {
  const { currentFinancialYear } = useFinancialYear();
  const navigate = useNavigate();
  
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ]);
  
  const [loading, setLoading] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);
  const [completedOrders, setCompletedOrders] = useState(0);
  const [inProgressOrders, setInProgressOrders] = useState(0);
  const [driversData, setDriversData] = useState<DriverReportData[]>([]);

  // جلب البيانات من Firebase
  const fetchReportData = async () => {
    if (!dateRange || !currentFinancialYear) return;

    setLoading(true);
    try {
      const startDate = dateRange[0].startOf('day').toDate();
      const endDate = dateRange[1].endOf('day').toDate();

      // جلب الطلبات من Firebase - استخدام المسار الصحيح
      const ordersRef = collection(db, 'delivery_orders');
      const q = query(
        ordersRef,
        where('deliveryDate', '>=', startDate.toISOString().split('T')[0]),
        where('deliveryDate', '<=', endDate.toISOString().split('T')[0])
      );

      const querySnapshot = await getDocs(q);
      const orders: OrderData[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log('Orders fetched:', orders); // للتأكد من جلب البيانات

      // حساب الإحصائيات العامة
      const total = orders.length;
      // المكتملة تشمل: المكتملة + المؤرشفة
      const completed = orders.filter(order => 
        order.status === 'completed' || 
        order.status === 'مكتمل' || 
        order.status === 'مؤرشف'
      ).length;
      const inProgress = orders.filter(order => 
        order.status === 'in-progress' || 
        order.status === 'قيد التنفيذ' || 
        order.status === 'قيد الانتظار'
      ).length;

      setTotalOrders(total);
      setCompletedOrders(completed);
      setInProgressOrders(inProgress);

      // تجميع البيانات حسب السائق
      const driversMap = new Map<string, {
        driverName: string;
        totalOrders: number;
        completedOrders: number;
        inProgressOrders: number;
        deliveryAmount: number;
      }>();

      orders.forEach(order => {
        const driverName = order.driverName || 'غير محدد';
        // مبلغ التوصيل هو حالة الفرع (branchBalance)
        const deliveryAmount = typeof order.branchBalance === 'number' 
          ? order.branchBalance 
          : parseFloat(order.branchBalance || '0');

        if (!driversMap.has(driverName)) {
          driversMap.set(driverName, {
            driverName,
            totalOrders: 0,
            completedOrders: 0,
            inProgressOrders: 0,
            deliveryAmount: 0
          });
        }

        const driverData = driversMap.get(driverName)!;
        driverData.totalOrders += 1;
        driverData.deliveryAmount += deliveryAmount;

        // المكتملة تشمل: المكتملة + المؤرشفة
        if (order.status === 'completed' || order.status === 'مكتمل' || order.status === 'مؤرشف') {
          driverData.completedOrders += 1;
        } else if (order.status === 'in-progress' || order.status === 'قيد التنفيذ' || order.status === 'قيد الانتظار') {
          driverData.inProgressOrders += 1;
        }
      });

      // تحويل البيانات إلى مصفوفة
      const driversArray: DriverReportData[] = Array.from(driversMap.values()).map((driver, index) => ({
        key: `driver-${index}`,
        driverName: driver.driverName,
        totalOrders: driver.totalOrders,
        completedOrders: driver.completedOrders,
        inProgressOrders: driver.inProgressOrders,
        completionRate: driver.totalOrders > 0 
          ? Math.round((driver.completedOrders / driver.totalOrders) * 100) 
          : 0,
        deliveryAmount: driver.deliveryAmount
      }));

      setDriversData(driversArray);

    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateRange) {
      fetchReportData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  // حساب الإجماليات
  const totals = driversData.reduce(
    (acc, driver) => ({
      totalOrders: acc.totalOrders + driver.totalOrders,
      completedOrders: acc.completedOrders + driver.completedOrders,
      inProgressOrders: acc.inProgressOrders + driver.inProgressOrders,
      deliveryAmount: acc.deliveryAmount + driver.deliveryAmount
    }),
    {
      totalOrders: 0,
      completedOrders: 0,
      inProgressOrders: 0,
      deliveryAmount: 0
    }
  );

  const avgCompletionRate = totals.totalOrders > 0 
    ? Math.round((totals.completedOrders / totals.totalOrders) * 100) 
    : 0;

  // أعمدة الجدول
  const columns: ColumnsType<DriverReportData> = [
    {
      title: 'السائق',
      dataIndex: 'driverName',
      key: 'driverName',
      width: 150,
      fixed: 'right',
      render: (text) => <span className="font-semibold">{text}</span>
    },
    {
      title: 'إجمالي الطلبات',
      dataIndex: 'totalOrders',
      key: 'totalOrders',
      width: 120,
      align: 'center',
      render: (value) => <span className="font-medium">{value}</span>
    },
    {
      title: 'الطلبات المكتملة',
      dataIndex: 'completedOrders',
      key: 'completedOrders',
      width: 130,
      align: 'center',
      render: (value) => (
        <span className="text-green-600 font-medium">{value}</span>
      )
    },
    {
      title: 'الطلبات تحت التنفيذ',
      dataIndex: 'inProgressOrders',
      key: 'inProgressOrders',
      width: 140,
      align: 'center',
      render: (value) => (
        <span className="text-orange-600 font-medium">{value}</span>
      )
    },
    {
      title: 'نسبة الإنجاز',
      dataIndex: 'completionRate',
      key: 'completionRate',
      width: 120,
      align: 'center',
      render: (value) => (
        <span className={`font-bold ${value >= 80 ? 'text-green-600' : value >= 50 ? 'text-orange-600' : 'text-red-600'}`}>
          {value}%
        </span>
      )
    },
    {
      title: 'مبلغ التوصيل',
      dataIndex: 'deliveryAmount',
      key: 'deliveryAmount',
      width: 130,
      align: 'center',
      render: (value) => (
        <span className="font-medium">{value.toFixed(2)} ر.س</span>
      )
    }
  ];

  return (
    <div className="w-full p-4 sm:p-6 space-y-6 min-h-screen" dir="rtl">
      <Helmet>
        <title>التقارير الشاملة | ERP90 Dashboard</title>
        <meta name="description" content="التقارير الشاملة لإدارة الطلبات والتوصيل" />
      </Helmet>

      {/* Header */}
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-6">
          <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
            <FileBarChart className="h-8 w-8 text-purple-600 dark:text-purple-300" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">التقارير الشاملة</h1>
            <p className="text-gray-600 dark:text-gray-400">تقارير شاملة عن جميع العمليات والطلبات</p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-blue-500"></div>
      </div>

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المخرجات", to: "/management/outputs" },
          { label: "التقارير الشاملة" }
        ]}
      />

      {/* فلتر التاريخ */}
      <Card className="shadow-sm">
        <div className="flex items-center gap-4">
          <label className="text-base font-medium text-gray-700">الفترة الزمنية:</label>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates) {
                setDateRange([dates[0]!, dates[1]!]);
              }
            }}
            format="YYYY-MM-DD"
            className="w-80"
            placeholder={['من تاريخ', 'إلى تاريخ']}
          />
        </div>
      </Card>

      {/* الإحصائيات العامة */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <Statistic
              title={
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  <span className="text-base">إجمالي الطلبات</span>
                </div>
              }
              value={totalOrders}
              valueStyle={{ color: '#1890ff', fontSize: '2rem', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <Statistic
              title={
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-base">الطلبات المكتملة</span>
                </div>
              }
              value={completedOrders}
              valueStyle={{ color: '#52c41a', fontSize: '2rem', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <Statistic
              title={
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <span className="text-base">الطلبات قيد التنفيذ</span>
                </div>
              }
              value={inProgressOrders}
              valueStyle={{ color: '#fa8c16', fontSize: '2rem', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      {/* جدول السائقين */}
      <Card 
        title={
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-cyan-600" />
            <span className="text-lg font-semibold">تقرير السائقين التفصيلي</span>
          </div>
        }
        className="shadow-sm"
      >
        <Table
          columns={columns}
          dataSource={driversData}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `إجمالي ${total} سائق`,
          }}
          scroll={{ x: 1000 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row className="bg-gray-100 font-bold">
                <Table.Summary.Cell index={0} align="right">
                  <span className="text-lg font-bold text-gray-800">الإجماليات</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="center">
                  <span className="text-lg font-bold text-blue-600">{totals.totalOrders}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="center">
                  <span className="text-lg font-bold text-green-600">{totals.completedOrders}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="center">
                  <span className="text-lg font-bold text-orange-600">{totals.inProgressOrders}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="center">
                  <span className="text-lg font-bold text-purple-600">{avgCompletionRate}%</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="center">
                  <span className="text-lg font-bold text-gray-800">{totals.deliveryAmount.toFixed(2)} ر.س</span>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </div>
  );
};

export default ComprehensiveReports;
