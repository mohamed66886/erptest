import React, { useState, useEffect } from 'react';
import { Modal, Input, Table } from 'antd';

interface ItemAccount {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  unitName?: string;
  price?: number;
  type?: string;
}

interface ItemSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: ItemAccount) => void;
}

const ItemSearchModal: React.FC<ItemSearchModalProps> = ({ open, onClose, onSelect }) => {
  const [itemSearch, setItemSearch] = useState('');
  const [itemAccounts, setItemAccounts] = useState<ItemAccount[]>([]);
  const [itemLoading, setItemLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const fetchItems = async () => {
        setItemLoading(true);
        try {
          // جلب بيانات الأصناف من قاعدة البيانات أو API
          // مثال: جلب من Firebase
          const { getDocs, collection } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          const itemsSnapshot = await getDocs(collection(db, 'inventory_items'));
          const itemsData: ItemAccount[] = itemsSnapshot.docs.map(doc => ({
            id: doc.id,
            code: doc.data().itemCode || doc.data().code || '',
            nameAr: doc.data().nameAr || doc.data().name || '',
            nameEn: doc.data().nameEn || '',
            unitName: doc.data().unitName || '',
            price: doc.data().salePrice || 0,
            type: doc.data().type || ''
          }));
          setItemAccounts(itemsData);
        } catch (error) {
          setItemAccounts([]);
        } finally {
          setItemLoading(false);
        }
      };
      fetchItems();
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="بحث عن صنف"
      width={800}
    >
      <Input
        placeholder="بحث بالكود أو الاسم العربي أو الإنجليزي..."
        value={itemSearch}
        onChange={e => setItemSearch(e.target.value)}
        style={{ marginBottom: 12, fontSize: 17, borderRadius: 8, padding: '8px 12px' }}
        allowClear
      />
      <Table
        loading={itemLoading}
        dataSource={itemAccounts
          .filter(acc => acc.type === 'مستوى ثاني')
          .filter(acc =>
            acc.code.includes(itemSearch) ||
            acc.nameAr.includes(itemSearch) ||
            (acc.nameEn && acc.nameEn.includes(itemSearch))
          )
        }
        columns={[ 
          { title: 'كود الصنف', dataIndex: 'code', key: 'code', width: 140 },
          { title: 'اسم الصنف (عربي)', dataIndex: 'nameAr', key: 'nameAr' },
          { title: 'سعر البيع', dataIndex: 'price', key: 'price', width: 100, render: (text: number | undefined) => typeof text === 'number' && text > 0 ? `${text} ر.س` : '-' }
        ]}
        rowKey="id"
        pagination={{ pageSize: 8 }}
        size="small"
        bordered
        onRow={record => ({
          onClick: () => {
            onSelect(record);
            onClose();
          },
          style: { cursor: 'pointer' }
        })}
      />
    </Modal>
  );
};

export default ItemSearchModal;
