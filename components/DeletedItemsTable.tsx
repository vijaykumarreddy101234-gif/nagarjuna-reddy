
import React from 'react';
import type { Item } from '../types';

interface DeletedItemsTableProps {
  items: Item[];
  restoreItem: (itemId: string) => void;
  permanentlyDeleteItem: (itemId: string) => void;
}

const DeletedItemsTable: React.FC<DeletedItemsTableProps> = ({ items, restoreItem, permanentlyDeleteItem }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-md shadow">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
          <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3">SKU</th>
              <th scope="col" className="px-6 py-3">Name</th>
              <th scope="col" className="px-6 py-3">Deleted On</th>
              <th scope="col" className="px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
                <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">No deleted items.</td>
                </tr>
            ) : (
                items.map(item => (
                      <tr key={item.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                        <th scope="row" className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">{item.sku}</th>
                        <td className="px-6 py-4">{item.name}</td>
                        <td className="px-6 py-4">{item.deletedAt ? new Date(item.deletedAt).toLocaleString() : ''}</td>
                        <td className="px-6 py-4 text-right space-x-4">
                            <button onClick={() => restoreItem(item.id)} className="font-medium text-green-500 hover:underline">Restore</button>
                            <button onClick={() => permanentlyDeleteItem(item.id)} className="font-medium text-red-500 hover:underline">Delete Permanently</button>
                        </td>
                      </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DeletedItemsTable;
