import React from 'react';
import type { Item, User } from '../types';

interface ItemsTableProps {
  items: Item[];
  deleteItem: (itemId: string) => void;
  onEditItem: (item: Item) => void;
}

const ItemsTable = ({ items, deleteItem, onEditItem }) => {
  const canManage = true; // All permissions enabled

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
          <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-4 py-3 sm:px-6">SKU</th>
              <th scope="col" className="px-4 py-3 sm:px-6">Name</th>
              <th scope="col" className="px-4 py-3 sm:px-6">Category</th>
              <th scope="col" className="px-4 py-3 sm:px-6 hidden sm:table-cell">UOM</th>
              <th scope="col" className="px-4 py-3 sm:px-6 text-right">Cost Price</th>
              <th scope="col" className="px-4 py-3 sm:px-6 text-right">Opening Balance</th>
              {canManage && <th scope="col" className="px-4 py-3 sm:px-6 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {items.map((item) => (
              <tr 
                key={item.id} 
                className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <th scope="row" className="px-4 py-4 sm:px-6 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                  {item.sku}
                </th>
                <td className="px-4 py-4 sm:px-6">
                    <div className="font-medium sm:font-normal">{item.name}</div>
                    <div className="text-xs text-gray-400 sm:hidden">{item.uom} | {item.category}</div>
                </td>
                <td className="px-4 py-4 sm:px-6">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                        item.category === 'Hardware' ? 'bg-purple-100 text-purple-800' :
                        item.category === 'Accessory' ? 'bg-orange-100 text-orange-800' :
                        item.category === 'Profile' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                        {item.category}
                    </span>
                </td>
                <td className="px-4 py-4 sm:px-6 hidden sm:table-cell">{item.uom}</td>
                <td className="px-4 py-4 sm:px-6 text-right font-mono text-gray-900 dark:text-white">
                  ₹{Number(item.costPrice || 0).toFixed(2)}
                </td>
                <td className="px-4 py-4 sm:px-6 text-right font-mono text-blue-600 dark:text-blue-400 font-bold">
                  {Number(item.openingStock || 0).toLocaleString()} {item.uom}
                </td>
                {canManage && (
                  <td className="px-4 py-4 sm:px-6 text-right space-x-3 whitespace-nowrap">
                      <button onClick={() => onEditItem(item)} className="text-blue-500 hover:text-blue-600 font-semibold transition-colors">Edit</button>
                      <button onClick={() => { if(confirm('Are you sure you want to delete this material?')) deleteItem(item.id); }} className="text-red-500 hover:text-red-600 font-semibold transition-colors">Delete</button>
                  </td>
                )}
              </tr>
            ))}
             {items.length === 0 && (
                <tr>
                    <td colSpan={canManage ? 7 : 6} className="text-center py-8 text-gray-500">No items found.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ItemsTable;