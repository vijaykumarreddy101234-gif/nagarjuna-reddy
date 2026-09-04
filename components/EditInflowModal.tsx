import React, { useState, useEffect, useRef } from 'react';
import type { Item, InflowTransaction } from '../types';

interface EditInflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: InflowTransaction;
  onUpdate: (transaction: InflowTransaction) => void;
  items: Item[];
}

const EditInflowModal: React.FC<EditInflowModalProps> = ({ isOpen, onClose, transaction, onUpdate, items }) => {
  const [formData, setFormData] = useState<Partial<InflowTransaction>>({});
  
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
        setFormData({
            ...transaction,
            txnDate: new Date(transaction.txnDate).toISOString().split('T')[0]
        });
        setTimeout(() => firstInputRef.current?.focus(), 100);
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
    const unitCost = parseFloat(String(formData.unitCost));

    if (!formData.itemId || isNaN(quantity) || quantity <= 0 || isNaN(unitCost) || unitCost <= 0) {
      alert('Please fill in all required fields with valid numbers.');
      return;
    }
    
    onUpdate({
      ...transaction,
      ...formData,
      quantity,
      unitCost,
      totalCost: quantity * unitCost,
      txnDate: new Date(formData.txnDate + 'T12:00:00.000Z').toISOString(),
    });
    onClose();
  };
  
  const inputStyles = "mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h2 id="modal-title" className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Edit Inflow Transaction</h2>
        <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
               <div>
                    <label htmlFor="refNo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reference No.</label>
                    <input ref={firstInputRef} type="text" id="refNo" name="refNo" value={formData.refNo || ''} onChange={handleChange} className={inputStyles}/>
                </div>
                 <div>
                    <label htmlFor="itemId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Item</label>
                    <select id="itemId" name="itemId" value={formData.itemId || ''} onChange={handleChange} className={inputStyles} required>
                        {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</label>
                        <input type="number" id="quantity" name="quantity" value={formData.quantity || ''} onChange={handleChange} className={inputStyles} required min="0.01" step="0.01" />
                    </div>
                    <div>
                        <label htmlFor="unitCost" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Unit Cost</label>
                        <input type="number" id="unitCost" name="unitCost" value={formData.unitCost || ''} onChange={handleChange} className={inputStyles} required min="0.01" step="0.01"/>
                    </div>
                </div>
                <div>
                    <label htmlFor="supplier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Supplier</label>
                    <input type="text" id="supplier" name="supplier" value={formData.supplier || ''} onChange={handleChange} className={inputStyles}/>
                </div>
                <div>
                    <label htmlFor="txnDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Transaction Date</label>
                    <input type="date" id="txnDate" name="txnDate" value={formData.txnDate || ''} onChange={handleChange} className={inputStyles} required/>
                </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Save Changes</button>
            </div>
        </form>
      </div>
    </div>
  );
};
export default EditInflowModal;