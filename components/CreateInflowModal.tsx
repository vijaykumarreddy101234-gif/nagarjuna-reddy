import React, { useState, useEffect, useRef } from 'react';
import type { Item, InflowTransaction, ToastMessage } from '../types';

interface CreateInflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Item[];
  addTransaction: (transaction: Omit<InflowTransaction, 'id' | 'createdAt' | 'totalCost'>) => void;
  createItemAndInflow: (itemData: Omit<Item, 'id' | 'createdAt'>, txData: Omit<InflowTransaction, 'id' | 'createdAt' | 'totalCost' | 'itemId'>) => void;
  addToast: (message: string, type: ToastMessage['type']) => void;
}

const initialNewItemState = {
    sku: '',
    name: '',
    uom: 'kg',
    reorderPoint: '0',
};

const CreateInflowModal: React.FC<CreateInflowModalProps> = ({ isOpen, onClose, items, addTransaction, createItemAndInflow, addToast }) => {
  const [refNo, setRefNo] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newItem, setNewItem] = useState(initialNewItemState);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
        const firstItemId = items[0]?.id || '';
        setRefNo('');
        setItemId(firstItemId);
        setQuantity('');
        setUnitCost(String(items.find(i => i.id === firstItemId)?.costPrice || ''));
        setSupplier('');
        setTxnDate(new Date().toISOString().split('T')[0]);
        setIsCreatingNew(false);
        setNewItem(initialNewItemState);
        setPosition({ x: 0, y: 0 });
        setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen, items]);
  
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
    setIsDragging(true);
    setOffset({ x: e.clientX - position.x, y: e.clientY - position.y, });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) setPosition({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen, onClose, isDragging, offset]);

  if (!isOpen) return null;
  
  const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const { value } = e.target;
      if (value === '__CREATE_NEW__') {
          setIsCreatingNew(true);
          setItemId(value);
          setUnitCost('');
      } else {
          setIsCreatingNew(false);
          setItemId(value);
          setUnitCost(String(items.find(i => i.id === value)?.costPrice || ''));
      }
  };

  const handleNewItemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setNewItem(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numQuantity = parseFloat(quantity);
    const numUnitCost = parseFloat(unitCost);

    if (isCreatingNew) {
        const reorderPoint = parseFloat(newItem.reorderPoint);
        if (!newItem.sku || !newItem.name || !newItem.uom || isNaN(reorderPoint) || !numQuantity || numQuantity <= 0 || !numUnitCost || numUnitCost < 0) {
            addToast('Please fill all new material and transaction fields with valid values.', 'error');
            return;
        }
        createItemAndInflow(
            { sku: newItem.sku, name: newItem.name, category: 'Raw Material', uom: newItem.uom, reorderPoint, costPrice: numUnitCost },
            { refNo, quantity: numQuantity, unitCost: numUnitCost, supplier, txnDate: new Date(txnDate + 'T12:00:00.000Z').toISOString(), warehouseId: 'wh1' }
        );
    } else {
        if (!itemId || itemId === '__CREATE_NEW__' || !numQuantity || numQuantity <= 0 || !numUnitCost || numUnitCost < 0) {
          addToast('Please select an item and fill in all required fields with valid numbers.', 'error');
          return;
        }
        addTransaction({
          refNo, itemId, quantity: numQuantity, unitCost: numUnitCost, supplier,
          txnDate: new Date(txnDate + 'T12:00:00.000Z').toISOString(), warehouseId: 'wh1',
        });
    }
    onClose();
  };
  
  const inputStyles = "mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";
  const modalStyle = { transform: `translate(${position.x}px, ${position.y}px)` };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onPointerDown={onClose}>
      <div ref={modalRef} style={modalStyle} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col" onPointerDown={e => e.stopPropagation()}>
        <div onPointerDown={handlePointerDown} className="p-6 pb-0 cursor-move">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Inflow Transaction</h2>
        </div>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col overflow-hidden">
            <div className="p-6 overflow-y-auto" style={{ maxHeight: '70vh' }}>
                <div className="space-y-4">
                   <div>
                        <label htmlFor="refNo" className="block text-sm font-medium">Reference No.</label>
                        <input ref={firstInputRef} type="text" id="refNo" value={refNo} onChange={e => setRefNo(e.target.value)} className={inputStyles}/>
                    </div>
                     <div>
                        <label htmlFor="item" className="block text-sm font-medium">Material</label>
                        <select id="item" value={itemId} onChange={handleItemChange} className={inputStyles} required>
                            <option value="" disabled>-- Select a Material --</option>
                            {items.map(item => <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>)}
                            <option value="__CREATE_NEW__" className="font-bold text-blue-600 dark:text-blue-400">-- Add New Material --</option>
                        </select>
                    </div>
                    {isCreatingNew && (
                        <div className="p-4 border border-blue-200 dark:border-gray-600 rounded-md space-y-4 bg-blue-50 dark:bg-gray-900/40">
                            <h3 className="font-semibold">New Material Details</h3>
                            <div>
                                <label htmlFor="newItemSku" className="block text-sm font-medium">SKU</label>
                                <input type="text" id="newItemSku" name="sku" value={newItem.sku} onChange={handleNewItemChange} className={inputStyles} required/>
                            </div>
                            <div>
                                <label htmlFor="newItemName" className="block text-sm font-medium">Name</label>
                                <input type="text" id="newItemName" name="name" value={newItem.name} onChange={handleNewItemChange} className={inputStyles} required/>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="newItemUom" className="block text-sm font-medium">UOM</label>
                                    <input type="text" id="newItemUom" name="uom" value={newItem.uom} onChange={handleNewItemChange} className={inputStyles} required/>
                                </div>
                                <div>
                                    <label htmlFor="newItemReorder" className="block text-sm font-medium">Reorder Point</label>
                                    <input type="number" id="newItemReorder" name="reorderPoint" value={newItem.reorderPoint} onChange={handleNewItemChange} className={inputStyles} required min="0"/>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="quantity" className="block text-sm font-medium">Quantity</label>
                            <input type="number" id="quantity" value={quantity} onChange={e => setQuantity(e.target.value)} className={inputStyles} required min="0.01" step="0.01" />
                        </div>
                        <div>
                            <label htmlFor="unitCost" className="block text-sm font-medium">Unit Cost</label>
                            <input type="number" id="unitCost" value={unitCost} onChange={e => setUnitCost(e.target.value)} className={inputStyles} required min="0" step="0.01" placeholder={isCreatingNew ? 'Becomes new item cost price' : ''}/>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="supplier" className="block text-sm font-medium">Supplier</label>
                        <input type="text" id="supplier" value={supplier} onChange={e => setSupplier(e.target.value)} className={inputStyles}/>
                    </div>
                    <div>
                        <label htmlFor="txnDate" className="block text-sm font-medium">Transaction Date</label>
                        <input type="date" id="txnDate" value={txnDate} onChange={e => setTxnDate(e.target.value)} className={inputStyles} required/>
                    </div>
                </div>
            </div>
            <div className="p-6 pt-0 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">Add Transaction</button>
            </div>
        </form>
      </div>
    </div>
  );
};
export default CreateInflowModal;