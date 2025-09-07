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
  ClearOutlined,
  PlusSquareOutlined,
  MinusSquareOutlined
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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

  // دالة لتوسيع/طي المراكز الفرعية
  const toggleRowExpansion = (parentId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (expandedRows.has(parentId)) {
      newExpandedRows.delete(parentId);
    } else {
      newExpandedRows.add(parentId);
    }
    setExpandedRows(newExpandedRows);
  };

  // إنشاء قائمة هيكلية تحتوي على المراكز الرئيسية والفرعية
  const getHierarchicalCostCenters = () => {
    const hierarchicalData: (CostCenter & { isChild?: boolean })[] = [];
    
    // الحصول على المراكز الرئيسية المفلترة
    const filteredParentCostCenters = costCenters.filter(costCenter => {
      const isLevelOne = costCenter.level === 1;
      
      const matchesSearch = costCenter.code.includes(searchTerm) ||
        costCenter.nameAr.includes(searchTerm) ||
        costCenter.nameEn.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || costCenter.nameAr === filterType;
      const matchesStatus = filterStatus === 'all' || costCenter.status === filterStatus;
      
      return isLevelOne && matchesSearch && matchesType && matchesStatus;
    }).sort((a, b) => {
      const codeA = parseInt(a.code) || 0;
      const codeB = parseInt(b.code) || 0;
      return codeA - codeB;
    });

    // إضافة المراكز الرئيسية والفرعية التابعة لها
    filteredParentCostCenters.forEach(parent => {
      // إضافة المركز الرئيسي
      hierarchicalData.push({ ...parent, isChild: false });
      
      // إضافة المراكز الفرعية فقط إذا كان المركز الرئيسي موسع
      if (expandedRows.has(parent.id)) {
        const childCostCenters = costCenters
          .filter(costCenter => costCenter.parentId === parent.id)
          .sort((a, b) => {
            const codeA = parseInt(a.code) || 0;
            const codeB = parseInt(b.code) || 0;
            return codeA - codeB;
          });
        
        childCostCenters.forEach(child => {
          hierarchicalData.push({ ...child, isChild: true });
        });
      }
    });

    return hierarchicalData;
  };

  const filteredCostCenters = getHierarchicalCostCenters();

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
    const headers = ['المستوى', 'كود مركز التكلفة', 'اسم مركز التكلفة (عربي)', 'اسم مركز التكلفة (انجليزي)', 'عدد المراكز الفرعية', 'النوع', 'الحالة', 'الموازنة', 'التكلفة الفعلية'];
    const csvContent = [
      headers.join(','),
      ...filteredCostCenters.map((costCenter: CostCenter & { isChild?: boolean }) => {
        const subCostCentersCount = costCenter.isChild ? 0 : costCenters.filter(cc => cc.parentId === costCenter.id).length;
        return [
          costCenter.isChild ? 'فرعي' : 'رئيسي',
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
    link.download = 'cost_centers_hierarchical.csv';
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
      render: (code: string, record: CostCenter & { isChild?: boolean }) => (
        <div style={{ 
          paddingRight: record.isChild ? 24 : 0,
          display: 'flex',
          alignItems: 'center'
        }}>
          {/* زر التوسيع للمراكز الرئيسية */}
          {!record.isChild && (
            <div style={{ marginLeft: 8, width: '20px' }}>
              {costCenters.filter(cc => cc.parentId === record.id).length > 0 && (
                <Button
                  type="text"
                  size="small"
                  icon={expandedRows.has(record.id) ? <MinusSquareOutlined /> : <PlusSquareOutlined />}
                  onClick={() => toggleRowExpansion(record.id)}
                  className="expand-btn"
                  style={{ 
                    color: expandedRows.has(record.id) ? '#52c41a' : '#1890ff',
                    padding: 0,
                    width: '16px',
                    height: '16px',
                    minWidth: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={expandedRows.has(record.id) ? 'إخفاء المراكز الفرعية' : 'إظهار المراكز الفرعية'}
                />
              )}
            </div>
          )}
          
          {record.isChild && (
            <span style={{ 
              marginLeft: 8, 
              color: '#bfbfbf',
              fontSize: '12px'
            }}>
              └─
            </span>
          )}
          <Tag 
            color={record.isChild ? "orange" : "blue"} 
            style={{ 
              fontFamily: 'monospace', 
              fontSize: '13px',
              opacity: record.isChild ? 0.8 : 1
            }}
          >
            {code}
          </Tag>
        </div>
      ),
    },
    {
      title: 'اسم مركز التكلفة (عربي)',
      dataIndex: 'nameAr',
      key: 'nameAr',
      render: (text: string, record: CostCenter & { isChild?: boolean }) => (
        <div style={{ 
          paddingRight: record.isChild ? 24 : 0,
          display: 'flex',
          alignItems: 'center'
        }}>
          <Text 
            strong={!record.isChild}
            style={{ 
              color: record.isChild ? '#8c8c8c' : '#000',
              fontSize: record.isChild ? '13px' : '14px'
            }}
          >
            {text}
          </Text>
        </div>
      ),
    },
    {
      title: 'اسم مركز التكلفة (انجليزي)',
      dataIndex: 'nameEn',
      key: 'nameEn',
      render: (text: string, record: CostCenter & { isChild?: boolean }) => (
        <div style={{ 
          paddingRight: record.isChild ? 24 : 0 
        }}>
          <Text 
            type="secondary"
            style={{ 
              fontSize: record.isChild ? '12px' : '14px',
              opacity: record.isChild ? 0.7 : 1
            }}
          >
            {text}
          </Text>
        </div>
      ),
    },
    {
      title: 'المراكز الفرعية',
      key: 'subCostCenters',
      render: (_: unknown, record: CostCenter & { isChild?: boolean }) => {
        // عدم عرض عدد المراكز الفرعية للمراكز الفرعية نفسها
        if (record.isChild) {
          return <Tag color="default">مركز فرعي</Tag>;
        }
        
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
      render: (type: string, record: CostCenter & { isChild?: boolean }) => (
        <Tag color={
          record.isChild ? 'volcano' : 
          type === 'رئيسي' ? 'gold' : 
          type === 'فرعي' ? 'blue' : 'green'
        }>
          {record.isChild ? 'فرعي' : type}
        </Tag>
      ),
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: CostCenter & { isChild?: boolean }) => (
        <Tag 
          color={status === 'نشط' ? 'green' : 'red'}
          style={{ opacity: record.isChild ? 0.7 : 1 }}
        >
          {status}
        </Tag>
      ),
    },
    {
      title: 'الموازنة',
      dataIndex: 'budget',
      key: 'budget',
      align: 'left' as const,
      render: (budget: number, record: CostCenter & { isChild?: boolean }) => (
        <Text 
          strong={!record.isChild}
          style={{ 
            color: budget > 0 ? '#52c41a' : '#8c8c8c',
            fontFamily: 'monospace',
            fontSize: record.isChild ? '12px' : '14px',
            opacity: record.isChild ? 0.8 : 1
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
      render: (_: unknown, record: CostCenter & { isChild?: boolean }) => {
        const subCostCentersCount = record.isChild ? 0 : costCenters.filter(cc => cc.parentId === record.id).length;
        return (
          <Space>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditClick(record)}
              title="تعديل مركز التكلفة"
              style={{ 
                color: record.isChild ? '#fa8c16' : '#1890ff',
                opacity: record.isChild ? 0.8 : 1
              }}
              size={record.isChild ? 'small' : 'middle'}
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
                  color: subCostCentersCount > 0 ? '#d9d9d9' : record.isChild ? '#fa8c16' : '#ff4d4f',
                  opacity: record.isChild ? 0.8 : 1
                }}
                size={record.isChild ? 'small' : 'middle'}
              />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="w-full p-6 space-y-6 min-h-screen" dir="rtl">
      <style>{`
        .parent-cost-center-row {
          background-color: #ffffff;
          border-left: 4px solid #1890ff;
        }
        .child-cost-center-row {
          background-color: #f8f9fa;
          border-left: 4px solid #fa8c16;
          position: relative;
        }
        .child-cost-center-row:hover {
          background-color: #fff2e8 !important;
        }
        .parent-cost-center-row:hover {
          background-color: #f0f7ff !important;
        }
        .ant-table-tbody > tr.child-cost-center-row > td {
          border-top: 1px solid #e8e8e8;
          border-bottom: 1px solid #e8e8e8;
        }
        .ant-btn.ant-btn-text:hover {
          background-color: transparent !important;
        }
        .expand-btn {
          transition: all 0.2s ease;
        }
        .expand-btn:hover {
          transform: scale(1.1);
        }
      `}</style>
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
                    <Text type="secondary">إجمالي: {costCenters.filter(cc => cc.level === 1).length} مركز رئيسي</Text>
                    <Text type="secondary">•</Text>
                    <Text type="secondary">إجمالي الفرعي: {costCenters.filter(cc => cc.level > 1).length} مركز فرعي</Text>
                    <Text type="secondary">•</Text>
                    <Text type="secondary">المعروض: {filteredCostCenters.length} نتيجة</Text>
                    <Text type="secondary">•</Text>
                    <Text style={{ color: '#52c41a' }}>موسع: {expandedRows.size} مركز</Text>
                  </>
                )}
              </Space>
            </Col>
            
            <Col flex="auto">
              <Row justify="end" gutter={[8, 8]} wrap={false}>
                <Col>
                  <Input
                    placeholder="البحث بالكود أو الاسم..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    prefix={<SearchOutlined />}
                    style={{ width: 220 }}
                  />
                </Col>
                <Col>
                  <Select
                    value={filterType}
                    onChange={(value) => setFilterType(value)}
                    placeholder="النوع"
                    style={{ width: 280 }}
                  >
                    <Option value="all">كل الأنواع</Option>
                    {getLevel1CostCenterNames().map((costCenterName) => (
                      <Option key={costCenterName} value={costCenterName}>
                        {costCenterName}
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col>
                  <Select
                    value={filterStatus}
                    onChange={(value) => setFilterStatus(value as 'all' | 'نشط' | 'غير نشط')}
                    placeholder="الحالة"
                    style={{ width: 120 }}
                  >
                    <Option value="all">كل الحالات</Option>
                    <Option value="نشط">نشط</Option>
                    <Option value="غير نشط">غير نشط</Option>
                  </Select>
                </Col>
                <Col>
                  <Button 
                    onClick={loadCostCenters} 
                    loading={isLoading}
                    icon={<ReloadOutlined />}
                    size="middle"
                  >
                    {isLoading ? 'جاري التحميل...' : 'إعادة تحميل'}
                  </Button>
                </Col>
                <Col>
                  <Button 
                    onClick={() => {
                      const allParentIds = costCenters
                        .filter(cc => cc.level === 1 && costCenters.some(child => child.parentId === cc.id))
                        .map(cc => cc.id);
                      
                      if (expandedRows.size === allParentIds.length) {
                        setExpandedRows(new Set()); // طي الكل
                      } else {
                        setExpandedRows(new Set(allParentIds)); // توسيع الكل
                      }
                    }}
                    icon={expandedRows.size > 0 ? <MinusSquareOutlined /> : <PlusSquareOutlined />}
                    size="middle"
                  >
                    {expandedRows.size > 0 ? 'طي الكل' : 'توسيع الكل'}
                  </Button>
                </Col>
                {(searchTerm || filterType !== 'all' || filterStatus !== 'all') && (
                  <Col>
                    <Button 
                      onClick={() => {
                        setSearchTerm('');
                        setFilterType('all');
                        setFilterStatus('all');
                      }}
                      icon={<ClearOutlined />}
                      size="middle"
                    >
                      إعادة تعيين
                    </Button>
                  </Col>
                )}
                <Col>
                  <Button 
                    onClick={exportToCSV}
                    icon={<DownloadOutlined />}
                    size="middle"
                  >
                    تصدير
                  </Button>
                </Col>
                <Col>
                  <Button 
                    type="primary"
                    onClick={handleAddClick}
                    icon={<PlusOutlined />}
                    size="middle"
                    style={{
                      background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                      border: 'none'
                    }}
                  >
                    إضافة مركز تكلفة
                  </Button>
                </Col>
              </Row>
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
          rowClassName={(record: CostCenter & { isChild?: boolean }) => 
            record.isChild ? 'child-cost-center-row' : 'parent-cost-center-row'
          }
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
                      لا توجد مراكز تكلفة متاحة
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      {costCenters.filter(cc => cc.level === 1).length === 0 
                        ? 'لم يتم العثور على أي مراكز تكلفة في قاعدة البيانات'
                        : 'لا توجد نتائج تطابق البحث الحالي'
                      }
                    </Text>
                    <br />
                    <Text style={{ color: '#1890ff', fontSize: 12 }}>
                      💡 يتم عرض المراكز الرئيسية والفرعية في هيكل شجري
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
