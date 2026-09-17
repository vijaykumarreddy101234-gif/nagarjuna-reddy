import React, { useState, useEffect, useRef } from 'react';
import type { Item, ToastMessage } from '../types';

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item;
  onUpdate: (item: Item) => void;
  addToast?: (message: string, type: ToastMessage['type']) => void;
}

const EditItemModal: React.FC<EditItemModalProps> = ({ isOpen, onClose, item, onUpdate, addToast }) => {
  const [formData, setFormData] = useState<Partial<Item>>({});
  
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
        setFormData(item);
        setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen, item]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
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
    const reorderPoint = parseFloat(String(formData.reorderPoint));
    const costPrice = parseFloat(String(formData.costPrice));
    const openingStock = parseFloat(String(formData.openingStock));

    if (!formData.sku || !formData.name || !formData.uom || isNaN(reorderPoint)) {
      addToast?.('Please fill in all required fields with valid values.', 'error');
      return;
    }
    
    onUpdate({
        ...item,
        ...formData,
        reorderPoint,
        costPrice: isNaN(costPrice) ? undefined : costPrice,
        openingStock: isNaN(openingStock) ? 0 : openingStock,
    });
    onClose();
  };
  
  const inputStyles = "mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h2 id="modal-title" className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Edit Item</h2>
        <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="edit-sku" className="block text-sm font-medium text-gray-700 dark:text-gray-300">SKU</label>
                        <input ref={firstInputRef} type="text" id="edit-sku" name="sku" value={formData.sku || ''} onChange={handleChange} className={inputStyles} required/>
                    </div>
                    <div>
                        <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                        <select id="edit-category" name="category" value={formData.category || ''} onChange={handleChange} className={inputStyles}>
                            <option value="Raw Material">Raw Material</option>
                            <option value="Hardware">Hardware</option>
                            <option value="Accessory">Accessory</option>
                            <option value="Profile">Profile</option>
                        </select>
                    </div>
                </div>
                 <div>
                    <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                    <input type="text" id="edit-name" name="name" value={formData.name || ''} onChange={handleChange} className={inputStyles} required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="edit-uom" className="block text-sm font-medium text-gray-700 dark:text-gray-300">UOM</label>
                        <input type="text" id="edit-uom" name="uom" value={formData.uom || ''} onChange={handleChange} className={inputStyles} required />
                    </div>
                    <div>
                        <label htmlFor="edit-reorderPoint" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reorder Point</label>
                        <input type="number" id="edit-reorderPoint" name="reorderPoint" value={formData.reorderPoint || ''} onChange={handleChange} className={inputStyles} required min="0"/>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="edit-costPrice" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cost Price</label>
                        <input type="number" id="edit-costPrice" name="costPrice" value={formData.costPrice || ''} onChange={handleChange} className={inputStyles} min="0" step="0.01"/>
                    </div>
                    <div>
                        <label htmlFor="edit-openingStock" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Opening Balance / Previous Month Stock</label>
                        <input type="number" id="edit-openingStock" name="openingStock" value={formData.openingStock || ''} onChange={handleChange} className={inputStyles} min="0" step="0.01"/>
                    </div>
                </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Save Changes</button>
            </div>
        </form>
      </div>
    </div>
  );
};
export default EditItemModal;