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
  FileTextOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ReloadOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { getAccounts, addAccount, deleteAccount, type Account } from '@/services/accountsService';
import Breadcrumb from '@/components/Breadcrumb';

const { Title, Text } = Typography;
const { Option } = Select;


interface AccountsSettlementPageProps {
  onNavigateToAdd?: () => void;
  onNavigateToEdit?: (account: Account) => void;
  accounts?: Account[];
  onDeleteAccount?: (id: string) => void;
}


const AccountsSettlementPage: React.FC<AccountsSettlementPageProps> = ({ 
  onNavigateToAdd, 
  onNavigateToEdit,
  accounts: externalAccounts,
  onDeleteAccount 
}) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBalance, setFilterBalance] = useState<'all' | 'positive' | 'zero' | 'negative'>('all');

  // Get unique level 1 account names for filter options
  const getLevel1AccountNames = () => {
    const level1Accounts = accounts.filter(account => account.level === 1);
    return [...new Set(level1Accounts.map(account => account.nameAr))];
  };

  // Load accounts from Firebase
  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      console.log('Loading accounts from Firebase...');
      const firebaseAccounts = await getAccounts();
      console.log('Accounts loaded:', firebaseAccounts);
      setAccounts(firebaseAccounts);
      if (firebaseAccounts.length === 0) {
        message.info('لا توجد حسابات في قاعدة البيانات. يمكنك إضافة حسابات جديدة.');
      } else {
        message.success(`تم تحميل ${firebaseAccounts.length} حساب من قاعدة البيانات`);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
      message.error(`فشل في تحميل الحسابات: ${error.message || 'خطأ غير معروف'}`);
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load accounts on component mount
  useEffect(() => {
    // Always load from Firebase first, ignore external accounts for now
    loadAccounts();
  }, []);

  const filteredAccounts = accounts.filter(account => {
    // فلترة المستوى الأول فقط
    const isLevelOne = account.level === 1;
    
    // فلترة النص
    const matchesSearch = account.code.includes(searchTerm) ||
      account.nameAr.includes(searchTerm) ||
      account.nameEn.toLowerCase().includes(searchTerm.toLowerCase());
    
    // فلترة النوع (استخدام اسم الحساب كتصنيف للمستوى الأول)
    const matchesType = filterType === 'all' || account.nameAr === filterType;
    
    // فلترة الرصيد
    let matchesBalance = true;
    if (filterBalance === 'positive') {
      matchesBalance = account.balance > 0;
    } else if (filterBalance === 'zero') {
      matchesBalance = account.balance === 0;
    } else if (filterBalance === 'negative') {
      matchesBalance = account.balance < 0;
    }
    
    return isLevelOne && matchesSearch && matchesType && matchesBalance;
  }).sort((a, b) => {
    // ترتيب الحسابات بناءً على الكود من الصغير إلى الكبير
    const codeA = parseInt(a.code) || 0;
    const codeB = parseInt(b.code) || 0;
    return codeA - codeB;
  });

  const handleDeleteAccount = async (id: string) => {
    // التحقق من وجود حسابات فرعية
    const accountToDelete = accounts.find(acc => acc.id === id);
    const subAccountsCount = accounts.filter(acc => acc.parentId === id).length;
    
    if (subAccountsCount > 0) {
      message.error(`لا يمكن حذف الحساب "${accountToDelete?.nameAr}" لأنه يحتوي على ${subAccountsCount} حساب فرعي. يجب حذف الحسابات الفرعية أولاً.`);
      return;
    }
    
    try {
      setIsLoading(true);
      console.log('Deleting account with ID:', id);
      
      // Always use Firebase delete function
      await deleteAccount(id);
      console.log('Account deleted successfully');
      
      message.success(`تم حذف الحساب "${accountToDelete?.nameAr}" بنجاح`);
      
      // Reload accounts from Firebase to reflect changes
      await loadAccounts();
      
    } catch (error) {
      console.error('Error deleting account:', error);
      message.error(`فشل في حذف الحساب: ${error.message || 'خطأ غير معروف'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (account: Account) => {
    console.log('Editing account:', account);
    message.info(`جاري تحميل بيانات الحساب: ${account.nameAr}`);
    if (onNavigateToEdit) {
      onNavigateToEdit(account);
    } else {
      // التنقل مباشرة إلى صفحة التعديل مع تمرير بيانات الحساب
      navigate(`/accounting/edit-account/${account.id}`, { 
        state: { account } 
      });
    }
  };

  const navigate = useNavigate();
  const handleAddClick = () => {
    // إذا كان هناك دالة onNavigateToAdd استخدمها، وإلا استخدم التنقل
    if (onNavigateToAdd) {
      onNavigateToAdd();
    } else {
      navigate('/accounting/add-account');
    }
  };

  // ...existing code...

  const exportToCSV = () => {
    const headers = ['كود الحساب', 'اسم الحساب (عربي)', 'اسم الحساب (انجليزي)', 'عدد الحسابات الفرعية', 'طبيعة الحساب', 'الرصيد'];
    const csvContent = [
      headers.join(','),
      ...filteredAccounts.map(account => {
        const subAccountsCount = accounts.filter(acc => acc.parentId === account.id).length;
        return [
          account.code, 
          account.nameAr, 
          account.nameEn, 
          subAccountsCount,
          account.nature || 'غير محدد', 
          account.balance
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'main_accounts_level1.csv';
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
      title: 'كود الحساب',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => (
        <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {code}
        </Tag>
      ),
    },
    {
      title: 'اسم الحساب (عربي)',
      dataIndex: 'nameAr',
      key: 'nameAr',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'اسم الحساب (انجليزي)',
      dataIndex: 'nameEn',
      key: 'nameEn',
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
    {
      title: 'الحسابات الفرعية',
      key: 'subAccounts',
      render: (_: unknown, record: Account) => {
        const subAccountsCount = accounts.filter(acc => acc.parentId === record.id).length;
        return (
          <Tag color={subAccountsCount > 0 ? 'blue' : 'default'}>
            {subAccountsCount} حساب فرعي
          </Tag>
        );
      },
    },
    {
      title: 'طبيعة الحساب',
      dataIndex: 'nature',
      key: 'nature',
      render: (nature: string) => (
        <Tag color={nature === 'مدينة' ? 'green' : 'red'}>
          {nature}
        </Tag>
      ),
    },
    {
      title: 'الرصيد',
      dataIndex: 'balance',
      key: 'balance',
      align: 'left' as const,
      render: (balance: number) => (
        <Text 
          strong 
          style={{ 
            color: balance > 0 ? '#52c41a' : balance < 0 ? '#ff4d4f' : '#8c8c8c',
            fontFamily: 'monospace'
          }}
        >
          {balance.toLocaleString('ar-SA')} ريال
        </Text>
      ),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Account) => {
        const subAccountsCount = accounts.filter(acc => acc.parentId === record.id).length;
        return (
          <Space>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditClick(record)}
              title="تعديل الحساب"
              style={{ color: '#1890ff' }}
            />
            <Popconfirm
              title="حذف الحساب"
              description={`هل أنت متأكد من حذف الحساب "${record.nameAr}"؟ هذا الإجراء لا يمكن التراجع عنه.`}
              onConfirm={() => handleDeleteAccount(record.id)}
              okText="نعم"
              cancelText="لا"
              disabled={subAccountsCount > 0}
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                disabled={subAccountsCount > 0}
                title={
                  subAccountsCount > 0 
                    ? `لا يمكن حذف هذا الحساب لأنه يحتوي على ${subAccountsCount} حساب فرعي`
                    : "حذف الحساب"
                }
                style={{ 
                  color: subAccountsCount > 0 ? '#d9d9d9' : '#ff4d4f'
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
          <FileTextOutlined style={{ fontSize: 32, color: '#1890ff', marginLeft: 12 }} />
          <Title level={2} style={{ margin: 0, color: '#262626' }}>تصنيف الحسابات</Title>
        </div>
        <Text type="secondary">إدارة وتصنيف الحسابات المالية</Text>
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
          { label: "تصنيف الحسابات" },
        ]}
      />

      <Card>
        <div style={{ marginBottom: 24 }}>
          <Row justify="space-between" align="middle" gutter={[16, 16]}>
            <Col span={24}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Title level={4} style={{ margin: 0 }}>قائمة الحسابات</Title>
                <Button 
                  type="primary"
                  onClick={handleAddClick}
                  icon={<PlusOutlined />}
                  style={{
                    background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                    border: 'none',
                    marginRight: 8
                  }}
                >
                  إضافة حساب
                </Button>
              </div>
              <Space wrap style={{ marginTop: 8 }}>
                {isLoading ? (
                  <Text type="secondary">جاري التحميل...</Text>
                ) : (
                  <>
                    <Text type="secondary">إجمالي: {accounts.filter(a => a.level === 1).length} حساب رئيسي</Text>
                    <Text type="secondary">•</Text>
                    <Text type="secondary">المعروض: {filteredAccounts.length} نتيجة</Text>
                    <Text type="secondary">•</Text>
                    <Text style={{ color: '#1890ff' }}>حسابات المستوى الأول فقط</Text>
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
                  {getLevel1AccountNames().map((accountName) => (
                    <Option key={accountName} value={accountName}>
                      {accountName}
                    </Option>
                  ))}
                </Select>

                <Select
                  value={filterBalance}
                  onChange={(value) => setFilterBalance(value as 'all' | 'positive' | 'zero' | 'negative')}
                  placeholder="الرصيد"
                  style={{ width: 130 }}
                >
                  <Option value="all">كل الأرصدة</Option>
                  <Option value="positive">موجب</Option>
                  <Option value="zero">صفر</Option>
                  <Option value="negative">سالب</Option>
                </Select>

                {/* Action Buttons */}
                <Button 
                  onClick={loadAccounts} 
                  loading={isLoading}
                  icon={<ReloadOutlined />}
                >
                  {isLoading ? 'جاري التحميل...' : 'إعادة تحميل'}
                </Button>
                
                {(searchTerm || filterType !== 'all' || filterBalance !== 'all') && (
                  <Button 
                    onClick={() => {
                      setSearchTerm('');
                      setFilterType('all');
                      setFilterBalance('all');
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
                
 
              </Space>
            </Col>
          </Row>
        </div>

        {/* Active Filters Display */}
        {(searchTerm || filterType !== 'all' || filterBalance !== 'all') && (
          <div style={{ marginBottom: 16 }}>
            <Space wrap>
              <Text type="secondary">الفلاتر النشطة:</Text>
              {searchTerm && (
                <Tag color="blue">البحث: {searchTerm}</Tag>
              )}
              {filterType !== 'all' && (
                <Tag color="green">النوع: {filterType}</Tag>
              )}
              {filterBalance !== 'all' && (
                <Tag color="purple">
                  الرصيد: {filterBalance === 'positive' ? 'موجب' : filterBalance === 'zero' ? 'صفر' : 'سالب'}
                </Tag>
              )}
            </Space>
          </div>
        )}

        <Table
          columns={columns}
          dataSource={filteredAccounts}
          rowKey="id"
          loading={isLoading}
          pagination={{
            total: filteredAccounts.length,
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
                      لا توجد حسابات رئيسية متاحة
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      {accounts.filter(a => a.level === 1).length === 0 
                        ? 'لم يتم العثور على أي حسابات رئيسية (مستوى 1) في قاعدة البيانات'
                        : 'لا توجد نتائج تطابق البحث الحالي'
                      }
                    </Text>
                    <br />
                    <Text style={{ color: '#1890ff', fontSize: 12 }}>
                      💡 هذه الصفحة تعرض الحسابات الرئيسية (المستوى الأول) فقط
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

export default AccountsSettlementPage;
