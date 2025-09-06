import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  Table, 
  Button, 
  Input, 
  Select, 
  Tag, 
  Space, 
  Popconfirm, 
  Row, 
  Col, 
  Spin,
  Empty,
  Typography,
  message,
  Badge
} from 'antd';
import { 
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ReloadOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { Target } from 'lucide-react';
import { getCostCenters, deleteCostCenter, type CostCenter } from '@/lib/costCenterService';
import Breadcrumb from '@/components/Breadcrumb';

const { Title, Text } = Typography;
const { Option } = Select;

interface CostCenterClassificationPageProps {
  onNavigateToAdd?: () => void;
  onNavigateToEdit?: (costCenter: CostCenter) => void;
  costCenters?: CostCenter[];
  onDeleteCostCenter?: (id: string) => void;
}

const CostCenterClassificationPage: React.FC<CostCenterClassificationPageProps> = ({ 
  onNavigateToAdd, 
  onNavigateToEdit,
  costCenters: externalCostCenters,
  onDeleteCostCenter 
}) => {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'نشط' | 'غير نشط'>('all');

  // Get unique level 1 cost center names for filter options
  const getLevel1CostCenterNames = () => {
    const level1CostCenters = costCenters.filter(costCenter => costCenter.level === 1);
    return [...new Set(level1CostCenters.map(costCenter => costCenter.nameAr))];
  };

  // Load cost centers from Firebase
  const loadCostCenters = async () => {
    try {
      setIsLoading(true);
      console.log('Loading cost centers from Firebase...');
      
      const firebaseCostCenters = await getCostCenters();
      console.log('Cost centers loaded:', firebaseCostCenters);
      setCostCenters(firebaseCostCenters);
      if (firebaseCostCenters.length === 0) {
        message.info('لا توجد مراكز تكلفة في قاعدة البيانات. يمكنك إضافة مراكز تكلفة جديدة.');
      } else {
        message.success(`تم تحميل ${firebaseCostCenters.length} مركز تكلفة من قاعدة البيانات`);
      }
    } catch (error) {
      console.error('Error loading cost centers:', error);
      message.error(`فشل في تحميل مراكز التكلفة: ${error.message || 'خطأ غير معروف'}`);
      setCostCenters([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load cost centers on component mount
  useEffect(() => {
    // Always load from Firebase first, ignore external cost centers for now
    loadCostCenters();
  }, []);

  const filteredCostCenters = costCenters.filter(costCenter => {
    // فلترة المستوى الأول فقط
    const isLevelOne = costCenter.level === 1;
    
    // فلترة النص
    const matchesSearch = costCenter.code.includes(searchTerm) ||
      costCenter.nameAr.includes(searchTerm) ||
      costCenter.nameEn.toLowerCase().includes(searchTerm.toLowerCase());
    
    // فلترة النوع (استخدام اسم مركز التكلفة كتصنيف للمستوى الأول)
    const matchesType = filterType === 'all' || costCenter.nameAr === filterType;
    
    // فلترة الحالة
    const matchesStatus = filterStatus === 'all' || costCenter.status === filterStatus;
    
    return isLevelOne && matchesSearch && matchesType && matchesStatus;
  }).sort((a, b) => {
    // ترتيب مراكز التكلفة بناءً على الكود من الصغير إلى الكبير
    const codeA = parseInt(a.code) || 0;
    const codeB = parseInt(b.code) || 0;
    return codeA - codeB;
  });

  const handleDeleteCostCenter = async (id: string) => {
    // التحقق من وجود مراكز تكلفة فرعية
    const costCenterToDelete = costCenters.find(cc => cc.id === id);
    const subCostCentersCount = costCenters.filter(cc => cc.parentId === id).length;
    
    if (subCostCentersCount > 0) {
      message.error(`لا يمكن حذف مركز التكلفة "${costCenterToDelete?.nameAr}" لأنه يحتوي على ${subCostCentersCount} مركز تكلفة فرعي. يجب حذف المراكز الفرعية أولاً.`);
      return;
    }
    
    try {
      setIsLoading(true);
      console.log('Deleting cost center with ID:', id);
      
      // Always use Firebase delete function
      await deleteCostCenter(id);
      console.log('Cost center deleted successfully');
      
      message.success(`تم حذف مركز التكلفة "${costCenterToDelete?.nameAr}" بنجاح`);
      
      // Reload cost centers from Firebase to reflect changes
      await loadCostCenters();
      
    } catch (error) {
      console.error('Error deleting cost center:', error);
      message.error(`فشل في حذف مركز التكلفة: ${error.message || 'خطأ غير معروف'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (costCenter: CostCenter) => {
    console.log('Editing cost center:', costCenter);
    message.info(`جاري تحميل بيانات مركز التكلفة: ${costCenter.nameAr}`);
    if (onNavigateToEdit) {
      onNavigateToEdit(costCenter);
    } else {
      // التنقل مباشرة إلى صفحة التعديل مع تمرير بيانات مركز التكلفة
      navigate(`/accounting/edit-cost-center/${costCenter.id}`, { 
        state: { costCenter } 
      });
    }
  };

  const navigate = useNavigate();
  const handleAddClick = () => {
    // إذا كان هناك دالة onNavigateToAdd استخدمها، وإلا استخدم التنقل
    if (onNavigateToAdd) {
      onNavigateToAdd();
    } else {
      navigate('/accounting/add-cost-center');
    }
  };

  const exportToCSV = () => {
    const headers = ['كود مركز التكلفة', 'اسم مركز التكلفة (عربي)', 'اسم مركز التكلفة (انجليزي)', 'عدد المراكز الفرعية', 'النوع', 'الحالة', 'الموازنة', 'التكلفة الفعلية'];
    const csvContent = [
      headers.join(','),
      ...filteredCostCenters.map(costCenter => {
        const subCostCentersCount = costCenters.filter(cc => cc.parentId === costCenter.id).length;
        return [
          costCenter.code, 
          costCenter.nameAr, 
          costCenter.nameEn, 
          subCostCentersCount,
          costCenter.type || 'غير محدد',
          costCenter.status || 'غير محدد',
          costCenter.budget || 0,
          costCenter.actualCost || 0
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'cost_centers_level1.csv';
    link.click();
  };

  // Define table columns
  const columns = [
    {
      title: '#',
      key: 'index',
      width: 60,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: 'كود مركز التكلفة',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => (
        <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {code}
        </Tag>
      ),
    },
    {
      title: 'اسم مركز التكلفة (عربي)',
      dataIndex: 'nameAr',
      key: 'nameAr',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'اسم مركز التكلفة (انجليزي)',
      dataIndex: 'nameEn',
      key: 'nameEn',
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
    {
      title: 'المراكز الفرعية',
      key: 'subCostCenters',
      render: (_: unknown, record: CostCenter) => {
        const subCostCentersCount = costCenters.filter(cc => cc.parentId === record.id).length;
        return (
          <Tag color={subCostCentersCount > 0 ? 'blue' : 'default'}>
            {subCostCentersCount} مركز فرعي
          </Tag>
        );
      },
    },
    {
      title: 'النوع',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'رئيسي' ? 'gold' : type === 'فرعي' ? 'blue' : 'green'}>
          {type}
        </Tag>
      ),
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'نشط' ? 'green' : 'red'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'الموازنة',
      dataIndex: 'budget',
      key: 'budget',
      align: 'left' as const,
      render: (budget: number) => (
        <Text 
          strong 
          style={{ 
            color: budget > 0 ? '#52c41a' : '#8c8c8c',
            fontFamily: 'monospace'
          }}
        >
          {(budget || 0).toLocaleString('ar-SA')} ريال
        </Text>
      ),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: CostCenter) => {
        const subCostCentersCount = costCenters.filter(cc => cc.parentId === record.id).length;
        return (
          <Space>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditClick(record)}
              title="تعديل مركز التكلفة"
              style={{ color: '#1890ff' }}
            />
            <Popconfirm
              title="حذف مركز التكلفة"
              description={`هل أنت متأكد من حذف مركز التكلفة "${record.nameAr}"؟ هذا الإجراء لا يمكن التراجع عنه.`}
              onConfirm={() => handleDeleteCostCenter(record.id)}
              okText="نعم"
              cancelText="لا"
              disabled={subCostCentersCount > 0}
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                disabled={subCostCentersCount > 0}
                title={
                  subCostCentersCount > 0 
                    ? `لا يمكن حذف هذا المركز لأنه يحتوي على ${subCostCentersCount} مركز فرعي`
                    : "حذف مركز التكلفة"
                }
                style={{ 
                  color: subCostCentersCount > 0 ? '#d9d9d9' : '#ff4d4f'
                }}
              />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="w-full p-6 space-y-6 min-h-screen" dir="rtl">
      {/* Header */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <Target style={{ fontSize: 32, color: '#1890ff', marginLeft: 12 }} />
          <Title level={2} style={{ margin: 0, color: '#262626' }}>تصنيف مراكز التكلفة</Title>
        </div>
        <Text type="secondary">إدارة وتصنيف مراكز التكلفة</Text>
        <div style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          width: '100%', 
          height: 4, 
          background: 'linear-gradient(to right, #40a9ff, #9254de)' 
        }}></div>
      </Card>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "الادارة الماليه", to: "/management/financial" }, 
          { label: "تصنيف مراكز التكلفة" },
        ]}
      />

      <Card>
        <div style={{ marginBottom: 24 }}>
          <Row justify="space-between" align="middle" gutter={[16, 16]}>
            <Col>
              <Title level={4} style={{ margin: 0 }}>قائمة مراكز التكلفة</Title>
              <Space wrap style={{ marginTop: 8 }}>
                {isLoading ? (
                  <Text type="secondary">جاري التحميل...</Text>
                ) : (
                  <>
                    <Text type="secondary">إجمالي: {costCenters.filter(cc => cc.level === 1).length} مركز تكلفة رئيسي</Text>
                    <Text type="secondary">•</Text>
                    <Text type="secondary">المعروض: {filteredCostCenters.length} نتيجة</Text>
                    <Text type="secondary">•</Text>
                    <Text style={{ color: '#1890ff' }}>مراكز التكلفة للمستوى الأول فقط</Text>
                  </>
                )}
              </Space>
            </Col>
            
            <Col>
              <Space wrap>
                {/* Search Input */}
                <Input
                  placeholder="البحث بالكود أو الاسم..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  prefix={<SearchOutlined />}
                  style={{ width: 280 }}
                />

                {/* Filters */}
                <Select
                  value={filterType}
                  onChange={(value) => setFilterType(value)}
                  placeholder="النوع"
                  style={{ width: 130 }}
                >
                  <Option value="all">كل الأنواع</Option>
                  {getLevel1CostCenterNames().map((costCenterName) => (
                    <Option key={costCenterName} value={costCenterName}>
                      {costCenterName}
                    </Option>
                  ))}
                </Select>

                <Select
                  value={filterStatus}
                  onChange={(value) => setFilterStatus(value as 'all' | 'نشط' | 'غير نشط')}
                  placeholder="الحالة"
                  style={{ width: 130 }}
                >
                  <Option value="all">كل الحالات</Option>
                  <Option value="نشط">نشط</Option>
                  <Option value="غير نشط">غير نشط</Option>
                </Select>

                {/* Reload Button */}
                <Button 
                  onClick={loadCostCenters} 
                  loading={isLoading}
                  icon={<ReloadOutlined />}
                >
                  {isLoading ? 'جاري التحميل...' : 'إعادة تحميل'}
                </Button>
                
                {(searchTerm || filterType !== 'all' || filterStatus !== 'all') && (
                  <Button 
                    onClick={() => {
                      setSearchTerm('');
                      setFilterType('all');
                      setFilterStatus('all');
                    }}
                    icon={<ClearOutlined />}
                  >
                    إعادة تعيين
                  </Button>
                )}
                
                <Button 
                  onClick={exportToCSV}
                  icon={<DownloadOutlined />}
                >
                  تصدير
                </Button>
                
                <Button 
                  type="primary"
                  onClick={handleAddClick}
                  icon={<PlusOutlined />}
                  style={{
                    background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                    border: 'none'
                  }}
                >
                  إضافة مركز تكلفة
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        {/* Active Filters Display */}
        {(searchTerm || filterType !== 'all' || filterStatus !== 'all') && (
          <div style={{ marginBottom: 16 }}>
            <Space wrap>
              <Text type="secondary">الفلاتر النشطة:</Text>
              {searchTerm && (
                <Tag color="blue">البحث: {searchTerm}</Tag>
              )}
              {filterType !== 'all' && (
                <Tag color="green">النوع: {filterType}</Tag>
              )}
              {filterStatus !== 'all' && (
                <Tag color="purple">الحالة: {filterStatus}</Tag>
              )}
            </Space>
          </div>
        )}

        <Table
          columns={columns}
          dataSource={filteredCostCenters}
          rowKey="id"
          loading={isLoading}
          pagination={{
            total: filteredCostCenters.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} من ${total} عنصر`,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 16, fontWeight: 500 }}>
                      لا توجد مراكز تكلفة رئيسية متاحة
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      {costCenters.filter(cc => cc.level === 1).length === 0 
                        ? 'لم يتم العثور على أي مراكز تكلفة رئيسية (مستوى 1) في قاعدة البيانات'
                        : 'لا توجد نتائج تطابق البحث الحالي'
                      }
                    </Text>
                    <br />
                    <Text style={{ color: '#1890ff', fontSize: 12 }}>
                      💡 هذه الصفحة تعرض مراكز التكلفة الرئيسية (المستوى الأول) فقط
                    </Text>
                  </div>
                }
              />
            )
          }}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
};

export default CostCenterClassificationPage;
