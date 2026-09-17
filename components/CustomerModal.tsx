import React, { useState, useEffect, useRef } from 'react';
import type { Customer, ToastMessage } from '../types';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null; // Null for add, Customer object for edit
  onSave: (customerData: Omit<Customer, 'id' | 'createdAt' | 'deletedAt'>) => void;
  addToast: (message: string, type: ToastMessage['type']) => void;
}

const CustomerModal = ({ isOpen, onClose, customer, onSave, addToast }) => {
  const getInitialState = (currentCustomer: Customer | null) => ({
    name: currentCustomer?.name || '',
    address: currentCustomer?.address || '',
    state: currentCustomer?.state || '',
    stateCode: currentCustomer?.stateCode || '',
    gstin: currentCustomer?.gstin || '',
    phone: currentCustomer?.phone || '',
  });

  const [formData, setFormData] = useState(getInitialState(customer));
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
        setFormData(getInitialState(customer));
        setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen, customer]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      addToast('Customer Name is required.', 'error');
      return;
    }
    
    onSave(formData);
    addToast(customer ? 'Customer updated successfully.' : 'Customer added successfully.', 'success');
    onClose();
  };
  
  const inputStyles = "mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h2 id="modal-title" className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{customer ? 'Edit Customer' : 'Add New Customer'}</h2>
        <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</label>
                    <input ref={firstInputRef} type="text" id="name" name="name" value={formData.name} onChange={handleChange} className={inputStyles} required/>
                </div>
                 <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                    <input type="text" id="phone" name="phone" value={formData.phone} onChange={handleChange} className={inputStyles} />
                </div>
                <div>
                    <label htmlFor="gstin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">GSTIN</label>
                    <input type="text" id="gstin" name="gstin" value={formData.gstin} onChange={handleChange} className={inputStyles} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="state" className="block text-sm font-medium text-gray-700 dark:text-gray-300">State</label>
                        <input type="text" id="state" name="state" value={formData.state} onChange={handleChange} className={inputStyles} placeholder="e.g. TELANGANA" />
                    </div>
                    <div>
                        <label htmlFor="stateCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">State Code</label>
                        <input type="text" id="stateCode" name="stateCode" value={formData.stateCode} onChange={handleChange} className={inputStyles} placeholder="e.g. 36" />
                    </div>
                </div>
                <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
                    <textarea id="address" name="address" value={formData.address} onChange={handleChange} rows={3} className={inputStyles}></textarea>
                </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Save Customer</button>
            </div>
        </form>
      </div>
    </div>
  );
};
export default CustomerModal;