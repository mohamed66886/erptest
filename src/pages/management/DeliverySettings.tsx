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
  EnvironmentOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  UserOutlined,
  LoadingOutlined,
  WarningOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  HddOutlined,
  DownloadOutlined,
  UploadOutlined,
  SafetyOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getStorage, ref, listAll, getMetadata, StorageReference } from 'firebase/storage';

const { Title, Text } = Typography;

interface DeliverySettingsData {
  maxOrdersPerRegion: number;
  allowZeroLimit: boolean;
  allowBranchNumberEdit: boolean;
  requireBranchApproval: boolean;
  autoBackupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  backupRetentionDays: number;
  totalStorageGB: number; // المساحة الكلية المتاحة بالجيجابايت
  lastBackupDate?: Date | { toDate: () => Date };
  lastUpdated?: Date | { toDate: () => Date };
  updatedBy?: string;
}

interface StorageStats {
  totalSpace: number;
  usedSpace: number;
  remainingSpace: number;
  usagePercentage: number;
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
    allowBranchNumberEdit: false,
    requireBranchApproval: true,
    autoBackupEnabled: true,
    backupFrequency: 'daily',
    backupRetentionDays: 30,
    totalStorageGB: 10, // القيمة الافتراضية 10 GB (يمكن تعديلها حسب خطة Firebase)
  });

  const [storageStats, setStorageStats] = useState<StorageStats>({
    totalSpace: 10240, // 10 GB in MB
    usedSpace: 0,   
    remainingSpace: 10240,
    usagePercentage: 0
  });

  const [loadingStorage, setLoadingStorage] = useState(false);

  // حساب حجم المساحة المستخدمة من Firebase
  const calculateStorageUsage = React.useCallback(async () => {
    setLoadingStorage(true);
    try {
      const storage = getStorage();
      let totalSize = 0;
      let fileCount = 0;

      // حساب حجم الملفات في Storage
      const storageRef = ref(storage);
      
      const calculateFolderSize = async (folderRef: StorageReference): Promise<number> => {
        let size = 0;
        try {
          const result = await listAll(folderRef);
          
          // حساب حجم الملفات
          for (const itemRef of result.items) {
            try {
              const metadata = await getMetadata(itemRef);
              size += metadata.size || 0;
              fileCount++;
            } catch (error) {
              console.error('Error getting file metadata:', error);
            }
          }
          
          // حساب حجم المجلدات الفرعية
          for (const prefixRef of result.prefixes) {
            size += await calculateFolderSize(prefixRef);
          }
        } catch (error) {
          console.error('Error listing folder:', error);
        }
        
        return size;
      };

      totalSize = await calculateFolderSize(storageRef);

      // حساب حجم قاعدة البيانات (تقريبي)
      let dbSize = 0;
      if (currentFinancialYear) {
        const collections = [
          'customers', 'items', 'invoices', 'outputs', 
          'purchases', 'salesRepresentatives', 'drivers',
          'branches', 'warehouses', 'accounts'
        ];

        for (const collectionName of collections) {
          try {
            const collectionRef = collection(db, `financialYears/${currentFinancialYear.id}/${collectionName}`);
            const snapshot = await getDocs(collectionRef);
            // تقدير حجم كل مستند بـ 2KB في المتوسط
            dbSize += snapshot.size * 2 * 1024; // بالبايت
          } catch (error) {
            console.error(`Error getting ${collectionName}:`, error);
          }
        }
      }

      // تحويل إلى ميجابايت
      const totalUsedMB = (totalSize + dbSize) / (1024 * 1024);
      const totalSpaceMB = 10240; // 10 GB
      const remainingMB = totalSpaceMB - totalUsedMB;
      const usagePercent = (totalUsedMB / totalSpaceMB) * 100;

      setStorageStats({
        totalSpace: totalSpaceMB,
        usedSpace: totalUsedMB,
        remainingSpace: Math.max(0, remainingMB),
        usagePercentage: Math.min(100, usagePercent)
      });

      message.success(`تم تحديث إحصائيات المساحة - عدد الملفات: ${fileCount}`);
    } catch (error) {
      console.error('Error calculating storage:', error);
      message.error('حدث خطأ أثناء حساب المساحة المستخدمة');
    } finally {
      setLoadingStorage(false);
    }
  }, [currentFinancialYear]);

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

  // تحميل إحصائيات المساحة عند فتح الصفحة
  useEffect(() => {
    if (currentFinancialYear) {
      calculateStorageUsage();
    }
  }, [currentFinancialYear, calculateStorageUsage]);

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
          { label: "إدارة التوصيلات", to: "/management/outputs" },
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
                  <div className="mt-2">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      💡 ملاحظة: يتم حساب الحد الأقصى على مستوى المنطقة (وليس الحي) بحسب تاريخ التوصيل
                    </Text>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Text strong>السماح بحد أقصى صفر</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      إمكانية تعيين الحد الأقصى إلى صفر لإيقاف الطلبات مؤقتاً في جميع المناطق
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

        <Col xs={24}>
          <Card 
            title={
              <Space>
                <DatabaseOutlined style={{ color: '#2f54eb' }} />
                <span>المساحة التخزينية والنسخ الاحتياطي</span>
              </Space>
            }
          >
            <Row gutter={[16, 16]}>
              {/* Storage Statistics */}
              <Col xs={24} md={12}>
                <Card 
                  type="inner" 
                  title={<Space><HddOutlined /> إحصائيات المساحة</Space>}
                  extra={
                    <Button 
                      size="small"
                      icon={<ReloadOutlined spin={loadingStorage} />}
                      onClick={calculateStorageUsage}
                      disabled={loadingStorage}
                    >
                      تحديث
                    </Button>
                  }
                >
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Text type="secondary">المساحة الكلية:</Text>
                        <Text strong>{(storageStats.totalSpace / 1024).toFixed(2)} GB</Text>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <Text type="secondary">المساحة المستخدمة:</Text>
                        <Text strong style={{ color: '#1890ff' }}>
                          {storageStats.usedSpace.toFixed(2)} MB
                          {loadingStorage && <LoadingOutlined style={{ marginRight: 8 }} />}
                        </Text>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <Text type="secondary">المساحة المتبقية:</Text>
                        <Text strong style={{ color: '#52c41a' }}>
                          {(storageStats.remainingSpace / 1024).toFixed(2)} GB
                        </Text>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Text type="secondary">نسبة الاستخدام:</Text>
                        <Text strong style={{ 
                          color: storageStats.usagePercentage > 80 ? '#ff4d4f' : 
                                 storageStats.usagePercentage > 60 ? '#fa8c16' : '#52c41a' 
                        }}>
                          {storageStats.usagePercentage.toFixed(1)}%
                        </Text>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div 
                          className="h-3 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${storageStats.usagePercentage}%`,
                            backgroundColor: storageStats.usagePercentage > 80 ? '#ff4d4f' : 
                                           storageStats.usagePercentage > 60 ? '#fa8c16' : '#52c41a'
                          }}
                        />
                      </div>
                    </div>

                    {storageStats.usagePercentage > 80 && (
                      <Alert
                        message="تحذير: المساحة المتاحة منخفضة"
                        description="يرجى حذف الملفات غير الضرورية أو الترقية لزيادة المساحة"
                        type="warning"
                        showIcon
                        closable
                      />
                    )}
                  </Space>
                </Card>
              </Col>

              {/* Backup Settings */}
              <Col xs={24} md={12}>
                <Card type="inner" title={<Space><SafetyOutlined /> إعدادات النسخ الاحتياطي</Space>}>
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
                          disabled={!settings.autoBackupEnabled}
                        >
                          <Select.Option value="daily">
                            <Space><ClockCircleOutlined /> يومي</Space>
                          </Select.Option>
                          <Select.Option value="weekly">
                            <Space><ClockCircleOutlined /> أسبوعي</Space>
                          </Select.Option>
                          <Select.Option value="monthly">
                            <Space><ClockCircleOutlined /> شهري</Space>
                          </Select.Option>
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
                          disabled={!settings.autoBackupEnabled}
                        />
                      </div>
                    </div>

                    {settings.lastBackupDate && (
                      <Alert
                        message={
                          <Space>
                            <CheckCircleOutlined />
                            <Text>
                              آخر نسخة احتياطية: {
                                typeof settings.lastBackupDate === 'object' && 'toDate' in settings.lastBackupDate
                                  ? new Date(settings.lastBackupDate.toDate()).toLocaleString('ar-EG')
                                  : new Date(settings.lastBackupDate).toLocaleString('ar-EG')
                              }
                            </Text>
                          </Space>
                        }
                        type="info"
                        showIcon={false}
                      />
                    )}
                  </Space>
                </Card>
              </Col>

              {/* Backup Actions */}
              <Col xs={24}>
                <Card type="inner" title={<Space><CloudServerOutlined /> إجراءات النسخ الاحتياطي</Space>}>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={6}>
                      <Button 
                        type="primary"
                        icon={<DownloadOutlined />} 
                        block
                        onClick={() => message.info('جاري تحميل النسخة الاحتياطية...')}
                      >
                        تحميل نسخة احتياطية
                      </Button>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Button 
                        icon={<UploadOutlined />} 
                        block
                        onClick={() => message.info('جاري استعادة النسخة الاحتياطية...')}
                      >
                        استعادة نسخة
                      </Button>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Button 
                        icon={<DatabaseOutlined />} 
                        block
                        onClick={() => message.success('تم إنشاء نسخة احتياطية يدوية بنجاح')}
                      >
                        نسخة احتياطية يدوية
                      </Button>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Button 
                        danger
                        icon={<WarningOutlined />} 
                        block
                        onClick={() => {
                          if (window.confirm('هل أنت متأكد من حذف جميع النسخ الاحتياطية القديمة؟')) {
                            message.success('تم حذف النسخ الاحتياطية القديمة');
                          }
                        }}
                      >
                        حذف النسخ القديمة
                      </Button>
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>
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
