
import React, { useState, useEffect, useRef } from 'react';
import type { Item, ConsumptionTransaction } from '../types';

interface EditConsumptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: ConsumptionTransaction;
  onUpdate: (transaction: ConsumptionTransaction) => void;
  items: Item[];
}

const EditConsumptionModal: React.FC<EditConsumptionModalProps> = ({ isOpen, onClose, transaction, onUpdate, items }) => {
  const [formData, setFormData] = useState<Partial<ConsumptionTransaction>>({});
  
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
        setFormData({
            ...transaction,
            txnDate: new Date(transaction.txnDate).toISOString().split('T')[0],
            type: transaction.type || 'PROD'
        });
    }
  }, [isOpen, transaction]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = parseFloat(String(formData.quantity));
    if (!formData.itemId || isNaN(quantity) || quantity <= 0) {
      alert('Please fill in all required fields with valid numbers.');
      return;
    }
    
    onUpdate({
      ...transaction,
      ...formData,
      quantity,
      txnDate: new Date(formData.txnDate + 'T12:00:00.000Z').toISOString(),
      type: formData.type as 'PROD' | 'SCRAP'
    });
    onClose();
  };
  
  const inputStyles = "mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Edit Consumption Record</h2>
        <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
               <div className="flex gap-4">
                    <div className="flex-1">
                        <label htmlFor="edit-con-refNo" className="block text-sm font-medium">Batch/Reference No.</label>
                        <input type="text" id="edit-con-refNo" name="refNo" value={formData.refNo || ''} onChange={handleChange} className={inputStyles}/>
                    </div>
                    <div className="w-1/3">
                         <label htmlFor="edit-con-type" className="block text-sm font-medium">Type</label>
                         <select id="edit-con-type" name="type" value={formData.type || 'PROD'} onChange={handleChange} className={inputStyles}>
                            <option value="PROD">Production</option>
                            <option value="SCRAP">Scrap</option>
                         </select>
                    </div>
                </div>
                 <div>
                    <label htmlFor="edit-con-itemId" className="block text-sm font-medium">Material Consumed</label>
                    <select id="edit-con-itemId" name="itemId" value={formData.itemId || ''} onChange={handleChange} className={inputStyles} required>
                        {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="edit-con-quantity" className="block text-sm font-medium">Quantity</label>
                    <input type="number" id="edit-con-quantity" name="quantity" value={formData.quantity || ''} onChange={handleChange} className={inputStyles} required min="0.01" step="0.01" />
                </div>
                <div>
                    <label htmlFor="edit-con-txnDate" className="block text-sm font-medium">Consumption Date</label>
                    <input type="date" id="edit-con-txnDate" name="txnDate" value={formData.txnDate || ''} onChange={handleChange} className={inputStyles} required/>
                </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">Save Changes</button>
            </div>
        </form>
      </div>
    </div>
  );
};
export default EditConsumptionModal;
