import React, { useState, useEffect, useMemo } from 'react';
import type { Item } from '../types';
import { SearchIcon, WarningIcon } from './Icon';

interface LowStockItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: (Item & { currentStock: number })[];
}

const LowStockItemsModal = ({ isOpen, onClose, items }) => {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    return items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" 
      onClick={onClose} 
      role="dialog" 
      aria-modal="true"
      aria-labelledby="low-stock-modal-title"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl flex flex-col" 
        onClick={e => e.stopPropagation()}
        style={{ height: '80vh' }}
      >
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
                <WarningIcon className="w-6 h-6 mr-3 text-orange-500"/>
                <h2 id="low-stock-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">Low Stock Items</h2>
            </div>
            <div className="relative">
                <input 
                    type="text"
                    placeholder="Search by name or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500 w-64"
                />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
        </div>

        <div className="overflow-y-auto flex-grow">
          <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700 sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-3">SKU</th>
                <th scope="col" className="px-6 py-3">Name</th>
                <th scope="col" className="px-6 py-3 text-right">Current Stock</th>
                <th scope="col" className="px-6 py-3 text-right">Reorder Point</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <tr key={item.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {item.sku}
                    </th>
                    <td className="px-6 py-4">{item.name}</td>
                    <td className="px-6 py-4 text-right font-bold text-orange-500">
                      {item.currentStock}
                      <span className="ml-2 text-gray-500 dark:text-gray-400 font-normal">{item.uom}</span>
                    </td>
                   <td className="px-6 py-4 text-right">
                      {item.reorderPoint}
                      <span className="ml-2 text-gray-500 dark:text-gray-400 font-normal">{item.uom}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">
                    {items.length === 0 ? 'No items are currently low on stock.' : 'No items match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
            <button 
                type="button" 
                onClick={onClose} 
                className="px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

export default LowStockItemsModal;