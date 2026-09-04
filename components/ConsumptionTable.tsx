import React from 'react';
import type { Item, ConsumptionTransaction, User } from '../types';

interface ConsumptionTableProps {
  transactions: ConsumptionTransaction[];
  items: Item[];
  onEdit: (tx: ConsumptionTransaction) => void;
  onDelete: (txId: string) => void;
}

const ConsumptionTable: React.FC<ConsumptionTableProps> = ({ transactions, items, onEdit, onDelete }) => {
  const getItemName = (itemId: string) => items.find(item => item.id === itemId)?.name || 'Unknown Item';
  const canManage = true; // All permissions enabled

  return (
    <div className="bg-white dark:bg-gray-800 rounded-md shadow">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
          <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-4 py-3">Date</th>
              <th scope="col" className="px-4 py-3">Type</th>
              <th scope="col" className="px-4 py-3">Reference No.</th>
              <th scope="col" className="px-4 py-3">Item Consumed</th>
              <th scope="col" className="px-4 py-3 text-right">Quantity</th>
              {canManage && <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                <td className="px-4 py-4">{new Date(tx.txnDate).toLocaleDateString()}</td>
                <td className="px-4 py-4">
                    {tx.type === 'SCRAP' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                            Scrap
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                            Production
                        </span>
                    )}
                </td>
                <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">{tx.refNo}</td>
                <td className="px-4 py-4">{getItemName(tx.itemId)}</td>
                <td className="px-4 py-4 text-right">{tx.quantity}</td>
                {canManage && (
                  <td className="px-4 py-4 text-right space-x-4">
                      <button onClick={() => onEdit(tx)} className="font-medium text-blue-500 hover:underline">Edit</button>
                      <button onClick={() => onDelete(tx.id)} className="font-medium text-red-500 hover:underline">Delete</button>
                  </td>
                )}
              </tr>
            ))}
            {transactions.length === 0 && (
                <tr><td colSpan={canManage ? 6 : 5} className="text-center py-8 text-gray-500">No consumption records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ConsumptionTable;