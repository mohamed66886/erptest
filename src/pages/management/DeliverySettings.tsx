import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { 
  Card, 
  Button, 
  InputNumber, 
  Switch, 
  Alert,
  Spin,
  Typography,
  Space,
  Divider,
  Select,
  Tag,
  message,
  Row,
  Col
} from 'antd';
import Breadcrumb from "@/components/Breadcrumb";
import { Helmet } from "react-helmet";
import { 
  SettingOutlined,
  SaveOutlined,
  ReloadOutlined,
  TruckOutlined,
  EnvironmentOutlined,
  InboxOutlined,
  ClockCircleOutlined,
  SafetyOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  UserOutlined,
  DollarOutlined,
  BellOutlined,
  DownloadOutlined,
  UploadOutlined,
  LoadingOutlined,
  AimOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const { Title, Text } = Typography;

interface DeliverySettingsData {
  maxOrdersPerRegion: number;
  allowZeroLimit: boolean;
  enableDriverAssignment: boolean;
  requireDriverForOrder: boolean;
  allowMultipleDrivers: boolean;
  allowBranchNumberEdit: boolean;
  requireBranchApproval: boolean;
  deliveryTimeWindow: number;
  allowSameDayDelivery: boolean;
  allowNextDayDelivery: boolean;
  requireDeliveryDate: boolean;
  defaultDeliveryFee: number;
  enableDynamicPricing: boolean;
  freeDeliveryThreshold: number;
  expressDeliveryFee: number;
  notifyOnNewOrder: boolean;
  notifyOnStatusChange: boolean;
  notifyDriver: boolean;
  notifyCustomer: boolean;
  smsNotifications: boolean;
  emailNotifications: boolean;
  priorityDeliveryEnabled: boolean;
  autoAssignPriority: boolean;
  priorityTimeLimit: number;
  enableOrderTracking: boolean;
  enableGPSTracking: boolean;
  updateTrackingInterval: number;
  requireManagerApproval: boolean;
  allowOrderCancellation: boolean;
  cancellationTimeLimit: number;
  enableTwoFactorAuth: boolean;
  autoBackupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  backupRetentionDays: number;
  checkInventoryBeforeOrder: boolean;
  reserveInventoryOnOrder: boolean;
  autoUpdateInventory: boolean;
  dailyReportsEnabled: boolean;
  weeklyReportsEnabled: boolean;
  monthlyReportsEnabled: boolean;
  lastUpdated?: Date | { toDate: () => Date };
  updatedBy?: string;
}

const DeliverySettings: React.FC = () => {
  const navigate = useNavigate();
  const { currentFinancialYear } = useFinancialYear();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [settings, setSettings] = useState<DeliverySettingsData>({
    maxOrdersPerRegion: 50,
    allowZeroLimit: true,
    enableDriverAssignment: true,
    requireDriverForOrder: false,
    allowMultipleDrivers: false,
    allowBranchNumberEdit: false,
    requireBranchApproval: true,
    deliveryTimeWindow: 4,
    allowSameDayDelivery: true,
    allowNextDayDelivery: true,
    requireDeliveryDate: true,
    defaultDeliveryFee: 20,
    enableDynamicPricing: false,
    freeDeliveryThreshold: 500,
    expressDeliveryFee: 50,
    notifyOnNewOrder: true,
    notifyOnStatusChange: true,
    notifyDriver: true,
    notifyCustomer: true,
    smsNotifications: false,
    emailNotifications: true,
    priorityDeliveryEnabled: true,
    autoAssignPriority: false,
    priorityTimeLimit: 2,
    enableOrderTracking: true,
    enableGPSTracking: false,
    updateTrackingInterval: 5,
    requireManagerApproval: false,
    allowOrderCancellation: true,
    cancellationTimeLimit: 24,
    enableTwoFactorAuth: false,
    autoBackupEnabled: true,
    backupFrequency: 'daily',
    backupRetentionDays: 30,
    checkInventoryBeforeOrder: true,
    reserveInventoryOnOrder: true,
    autoUpdateInventory: true,
    dailyReportsEnabled: true,
    weeklyReportsEnabled: true,
    monthlyReportsEnabled: true,
  });

  useEffect(() => {
    const loadSettings = async () => {
      if (!currentFinancialYear) return;
      
      setLoading(true);
      try {
        const settingsRef = doc(db, `financialYears/${currentFinancialYear.id}/settings`, 'delivery');
        const settingsDoc = await getDoc(settingsRef);
        
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data() as DeliverySettingsData);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        message.error('حدث خطأ أثناء تحميل الإعدادات');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [currentFinancialYear]);

  const handleSave = async () => {
    if (!currentFinancialYear) {
      message.error('يرجى اختيار السنة المالية');
      return;
    }

    setSaving(true);
    try {
      const settingsRef = doc(db, `financialYears/${currentFinancialYear.id}/settings`, 'delivery');
      await setDoc(settingsRef, {
        ...settings,
        lastUpdated: serverTimestamp(),
        updatedBy: 'admin',
      });

      message.success('تم حفظ الإعدادات بنجاح');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      message.error('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('هل أنت متأكد من إعادة تعيين جميع الإعدادات إلى القيم الافتراضية؟')) {
      window.location.reload();
    }
  };

  const updateSetting = <K extends keyof DeliverySettingsData>(
    key: K,
    value: DeliverySettingsData[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="جاري تحميل الإعدادات..." />
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-6 space-y-6 min-h-screen" dir="rtl">
      <Helmet>
        <title>إعدادات التوصيل | ERP90 Dashboard</title>
        <meta name="description" content="إدارة وتكوين إعدادات نظام التوصيل" />
      </Helmet>

      <Card className="shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <Space size="large">
            <div className="p-3 bg-blue-100 rounded-lg">
              <SettingOutlined style={{ fontSize: 32, color: '#1890ff' }} />
            </div>
            <div>
              <Title level={2} style={{ margin: 0 }}>إعدادات التوصيل</Title>
              <Text type="secondary">إدارة وتكوين إعدادات نظام التوصيل والطلبات</Text>
            </div>
          </Space>
          
          <Space>
            {hasChanges && (
              <Tag icon={<WarningOutlined />} color="warning">
                يوجد تغييرات غير محفوظة
              </Tag>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReset}
              disabled={saving}
            >
              إعادة تعيين
            </Button>
            <Button
              type="primary"
              icon={saving ? <LoadingOutlined /> : <SaveOutlined />}
              onClick={handleSave}
              disabled={saving || !hasChanges}
              loading={saving}
            >
              حفظ التغييرات
            </Button>
          </Space>
        </div>
      </Card>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المخرجات", to: "/management/outputs" },
          { label: "إعدادات التوصيل" },
        ]}
      />

      <Row gutter={[16, 16]}>
        
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <InboxOutlined style={{ color: '#1890ff' }} />
                <span>إعدادات الحد الأقصى للطلبات</span>
              </Space>
            }
            className="h-full"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>الحد الأقصى للطلبات لكل منطقة في اليوم</Text>
                <div className="mt-2">
                  <InputNumber
                    value={settings.maxOrdersPerRegion}
                    onChange={(value) => updateSetting('maxOrdersPerRegion', value || 0)}
                    min={0}
                    style={{ width: '100%' }}
                    addonAfter="طلب"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Text strong>السماح بحد أقصى صفر</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      إمكانية تعيين الحد الأقصى إلى صفر لإيقاف الطلبات مؤقتاً
                    </Text>
                  </div>
                </div>
                <Switch
                  checked={settings.allowZeroLimit}
                  onChange={(checked) => updateSetting('allowZeroLimit', checked)}
                />
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <TruckOutlined style={{ color: '#52c41a' }} />
                <span>إعدادات السائقين</span>
              </Space>
            }
            className="h-full"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div className="flex items-center justify-between">
                <div>
                  <Text strong>تفعيل تعيين السائقين</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      إمكانية إضافة سائق في الطلب الجديد
                    </Text>
                  </div>
                </div>
                <Switch
                  checked={settings.enableDriverAssignment}
                  onChange={(checked) => updateSetting('enableDriverAssignment', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Text strong>إلزامية تعيين السائق</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      جعل تعيين السائق إلزامياً لإنشاء الطلب
                    </Text>
                  </div>
                </div>
                <Switch
                  checked={settings.requireDriverForOrder}
                  onChange={(checked) => updateSetting('requireDriverForOrder', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Text strong>السماح بتعدد السائقين</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      إمكانية تعيين أكثر من سائق للطلب الواحد
                    </Text>
                  </div>
                </div>
                <Switch
                  checked={settings.allowMultipleDrivers}
                  onChange={(checked) => updateSetting('allowMultipleDrivers', checked)}
                />
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <EnvironmentOutlined style={{ color: '#722ed1' }} />
                <span>إعدادات الفروع</span>
              </Space>
            }
            className="h-full"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div className="flex items-center justify-between">
                <div>
                  <Text strong>السماح بتعديل رقم الفرع</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      إمكانية تعديل رقم الفرع في الطلبات
                    </Text>
                  </div>
                </div>
                <Switch
                  checked={settings.allowBranchNumberEdit}
                  onChange={(checked) => updateSetting('allowBranchNumberEdit', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Text strong>طلب موافقة الفرع</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      تتطلب موافقة من المدير على الطلبات
                    </Text>
                  </div>
                </div>
                <Switch
                  checked={settings.requireBranchApproval}
                  onChange={(checked) => updateSetting('requireBranchApproval', checked)}
                />
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#fa8c16' }} />
                <span>إعدادات التوصيل العامة</span>
              </Space>
            }
            className="h-full"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>نافذة وقت التوصيل</Text>
                <div className="mt-2">
                  <InputNumber
                    value={settings.deliveryTimeWindow}
                    onChange={(value) => updateSetting('deliveryTimeWindow', value || 1)}
                    min={1}
                    max={24}
                    style={{ width: '100%' }}
                    addonAfter="ساعة"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Text strong>السماح بالتوصيل في نفس اليوم</Text>
                <Switch
                  checked={settings.allowSameDayDelivery}
                  onChange={(checked) => updateSetting('allowSameDayDelivery', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Text strong>السماح بالتوصيل في اليوم التالي</Text>
                <Switch
                  checked={settings.allowNextDayDelivery}
                  onChange={(checked) => updateSetting('allowNextDayDelivery', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Text strong>إلزامية تحديد تاريخ التوصيل</Text>
                <Switch
                  checked={settings.requireDeliveryDate}
                  onChange={(checked) => updateSetting('requireDeliveryDate', checked)}
                />
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <DollarOutlined style={{ color: '#13c2c2' }} />
                <span>إعدادات التكلفة والرسوم</span>
              </Space>
            }
            className="h-full"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>رسوم التوصيل الافتراضية</Text>
                <div className="mt-2">
                  <InputNumber
                    value={settings.defaultDeliveryFee}
                    onChange={(value) => updateSetting('defaultDeliveryFee', value || 0)}
                    min={0}
                    style={{ width: '100%' }}
                    addonAfter="ريال"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Text strong>تفعيل التسعير الديناميكي</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      حساب رسوم التوصيل بناءً على المسافة والوزن
                    </Text>
                  </div>
                </div>
                <Switch
                  checked={settings.enableDynamicPricing}
                  onChange={(checked) => updateSetting('enableDynamicPricing', checked)}
                />
              </div>

              <div>
                <Text strong>حد التوصيل المجاني</Text>
                <div className="mt-2">
                  <InputNumber
                    value={settings.freeDeliveryThreshold}
                    onChange={(value) => updateSetting('freeDeliveryThreshold', value || 0)}
                    min={0}
                    style={{ width: '100%' }}
                    addonAfter="ريال"
                  />
                </div>
              </div>

              <div>
                <Text strong>رسوم التوصيل السريع</Text>
                <div className="mt-2">
                  <InputNumber
                    value={settings.expressDeliveryFee}
                    onChange={(value) => updateSetting('expressDeliveryFee', value || 0)}
                    min={0}
                    style={{ width: '100%' }}
                    addonAfter="ريال"
                  />
                </div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <BellOutlined style={{ color: '#eb2f96' }} />
                <span>إعدادات الإشعارات</span>
              </Space>
            }
            className="h-full"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div className="flex items-center justify-between">
                <Text strong>إشعار عند طلب جديد</Text>
                <Switch
                  checked={settings.notifyOnNewOrder}
                  onChange={(checked) => updateSetting('notifyOnNewOrder', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Text strong>إشعار عند تغيير الحالة</Text>
                <Switch
                  checked={settings.notifyOnStatusChange}
                  onChange={(checked) => updateSetting('notifyOnStatusChange', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Text strong>إشعار السائق</Text>
                <Switch
                  checked={settings.notifyDriver}
                  onChange={(checked) => updateSetting('notifyDriver', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Text strong>إشعار العميل</Text>
                <Switch
                  checked={settings.notifyCustomer}
                  onChange={(checked) => updateSetting('notifyCustomer', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Text strong>إشعارات SMS</Text>
                <Switch
                  checked={settings.smsNotifications}
                  onChange={(checked) => updateSetting('smsNotifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Text strong>إشعارات البريد الإلكتروني</Text>
                <Switch
                  checked={settings.emailNotifications}
                  onChange={(checked) => updateSetting('emailNotifications', checked)}
                />
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <AimOutlined style={{ color: '#a0d911' }} />
                <span>إعدادات الأولويات</span>
              </Space>
            }
            className="h-full"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div className="flex items-center justify-between">
                <Text strong>تفعيل التوصيل ذو الأولوية</Text>
                <Switch
                  checked={settings.priorityDeliveryEnabled}
                  onChange={(checked) => updateSetting('priorityDeliveryEnabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Text strong>تعيين الأولوية تلقائياً</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      تعيين أولوية عالية للطلبات العاجلة تلقائياً
                    </Text>
                  </div>
                </div>
                <Switch
                  checked={settings.autoAssignPriority}
                  onChange={(checked) => updateSetting('autoAssignPriority', checked)}
                />
              </div>

              <div>
                <Text strong>حد وقت الأولوية</Text>
                <div className="mt-2">
                  <InputNumber
                    value={settings.priorityTimeLimit}
                    onChange={(value) => updateSetting('priorityTimeLimit', value || 1)}
                    min={1}
                    max={24}
                    style={{ width: '100%' }}
                    addonAfter="ساعة"
                  />
                </div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <EnvironmentOutlined style={{ color: '#f5222d' }} />
                <span>إعدادات التتبع</span>
              </Space>
            }
            className="h-full"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div className="flex items-center justify-between">
                <Text strong>تفعيل تتبع الطلبات</Text>
                <Switch
                  checked={settings.enableOrderTracking}
                  onChange={(checked) => updateSetting('enableOrderTracking', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Text strong>تفعيل تتبع GPS</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      تتبع موقع السائق بالوقت الفعلي
                    </Text>
                  </div>
                </div>
                <Switch
                  checked={settings.enableGPSTracking}
                  onChange={(checked) => updateSetting('enableGPSTracking', checked)}
                />
              </div>

              <div>
                <Text strong>فترة تحديث التتبع</Text>
                <div className="mt-2">
                  <InputNumber
                    value={settings.updateTrackingInterval}
                    onChange={(value) => updateSetting('updateTrackingInterval', value || 1)}
                    min={1}
                    max={60}
                    style={{ width: '100%' }}
                    addonAfter="دقيقة"
                  />
                </div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <SafetyOutlined style={{ color: '#fa541c' }} />
                <span>الأمان والصلاحيات</span>
              </Space>
            }
            className="h-full"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div className="flex items-center justify-between">
                <div>
                  <Text strong>طلب موافقة المدير</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      تتطلب موافقة المدير على بعض العمليات
                    </Text>
                  </div>
                </div>
                <Switch
                  checked={settings.requireManagerApproval}
                  onChange={(checked) => updateSetting('requireManagerApproval', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Text strong>السماح بإلغاء الطلبات</Text>
                <Switch
                  checked={settings.allowOrderCancellation}
                  onChange={(checked) => updateSetting('allowOrderCancellation', checked)}
                />
              </div>

              <div>
                <Text strong>مهلة الإلغاء</Text>
                <div className="mt-2">
                  <InputNumber
                    value={settings.cancellationTimeLimit}
                    onChange={(value) => updateSetting('cancellationTimeLimit', value || 1)}
                    min={1}
                    style={{ width: '100%' }}
                    addonAfter="ساعة"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Text strong>تفعيل المصادقة الثنائية</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      طلب رمز تحقق إضافي للعمليات الحساسة
                    </Text>
                  </div>
                </div>
                <Switch
                  checked={settings.enableTwoFactorAuth}
                  onChange={(checked) => updateSetting('enableTwoFactorAuth', checked)}
                />
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <DatabaseOutlined style={{ color: '#2f54eb' }} />
                <span>النسخ الاحتياطي</span>
              </Space>
            }
            className="h-full"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div className="flex items-center justify-between">
                <Text strong>تفعيل النسخ الاحتياطي التلقائي</Text>
                <Switch
                  checked={settings.autoBackupEnabled}
                  onChange={(checked) => updateSetting('autoBackupEnabled', checked)}
                />
              </div>

              <div>
                <Text strong>تكرار النسخ الاحتياطي</Text>
                <div className="mt-2">
                  <Select
                    value={settings.backupFrequency}
                    onChange={(value) => updateSetting('backupFrequency', value)}
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="daily">يومي</Select.Option>
                    <Select.Option value="weekly">أسبوعي</Select.Option>
                    <Select.Option value="monthly">شهري</Select.Option>
                  </Select>
                </div>
              </div>

              <div>
                <Text strong>مدة الاحتفاظ بالنسخ الاحتياطية</Text>
                <div className="mt-2">
                  <InputNumber
                    value={settings.backupRetentionDays}
                    onChange={(value) => updateSetting('backupRetentionDays', value || 7)}
                    min={7}
                    max={365}
                    style={{ width: '100%' }}
                    addonAfter="يوم"
                  />
                </div>
              </div>

              <Space style={{ width: '100%' }}>
                <Button icon={<DownloadOutlined />} block>
                  تحميل نسخة احتياطية
                </Button>
                <Button icon={<UploadOutlined />} block>
                  استعادة نسخة
                </Button>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <InboxOutlined style={{ color: '#52c41a' }} />
                <span>إعدادات المخزون</span>
              </Space>
            }
            className="h-full"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div className="flex items-center justify-between">
                <Text strong>فحص المخزون قبل إنشاء الطلب</Text>
                <Switch
                  checked={settings.checkInventoryBeforeOrder}
                  onChange={(checked) => updateSetting('checkInventoryBeforeOrder', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Text strong>حجز المخزون عند إنشاء الطلب</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      حجز الكمية المطلوبة فوراً
                    </Text>
                  </div>
                </div>
                <Switch
                  checked={settings.reserveInventoryOnOrder}
                  onChange={(checked) => updateSetting('reserveInventoryOnOrder', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Text strong>تحديث المخزون تلقائياً</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      تحديث المخزون عند تأكيد أو إلغاء الطلب
                    </Text>
                  </div>
                </div>
                <Switch
                  checked={settings.autoUpdateInventory}
                  onChange={(checked) => updateSetting('autoUpdateInventory', checked)}
                />
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <FileTextOutlined style={{ color: '#fa8c16' }} />
                <span>إعدادات التقارير</span>
              </Space>
            }
            className="h-full"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div className="flex items-center justify-between">
                <Text strong>تفعيل التقارير اليومية</Text>
                <Switch
                  checked={settings.dailyReportsEnabled}
                  onChange={(checked) => updateSetting('dailyReportsEnabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Text strong>تفعيل التقارير الأسبوعية</Text>
                <Switch
                  checked={settings.weeklyReportsEnabled}
                  onChange={(checked) => updateSetting('weeklyReportsEnabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Text strong>تفعيل التقارير الشهرية</Text>
                <Switch
                  checked={settings.monthlyReportsEnabled}
                  onChange={(checked) => updateSetting('monthlyReportsEnabled', checked)}
                />
              </div>
            </Space>
          </Card>
        </Col>

      </Row>

      {settings.lastUpdated && (
        <Alert
          message={
            <Space split={<Divider type="vertical" />}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <Text>
                  آخر تحديث: {
                    typeof settings.lastUpdated === 'object' && 'toDate' in settings.lastUpdated
                      ? new Date(settings.lastUpdated.toDate()).toLocaleString('ar-EG')
                      : new Date(settings.lastUpdated).toLocaleString('ar-EG')
                  }
                </Text>
              </Space>
              {settings.updatedBy && (
                <Space>
                  <UserOutlined />
                  <Text>بواسطة: {settings.updatedBy}</Text>
                </Space>
              )}
            </Space>
          }
          type="success"
          showIcon={false}
        />
      )}

    </div>
  );
};

export default DeliverySettings;
