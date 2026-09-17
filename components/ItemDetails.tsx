import React from 'react';
import type { InflowTransaction, Item, User } from '../types';

interface ItemDetailsProps {
  transactions: InflowTransaction[];
  items: Item[];
  deleteTransaction: (transactionId: string) => void;
  onEditTransaction: (transaction: InflowTransaction) => void;
}

const ItemDetails = ({ transactions, items, deleteTransaction, onEditTransaction }) => {
  const getItemName = (itemId: string) => {
    return items.find(item => item.id === itemId)?.name || 'Unknown Item';
  };

  const canManage = true; // All permissions enabled
  const canView = true; 

  return (
    <div className="bg-white dark:bg-gray-800 rounded-md shadow">
      <div className="bg-[#4A5E80] dark:bg-gray-700 p-4 rounded-t-md flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Inflow Transactions</h2>
      </div>
      {canView && (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
          <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-4 py-3">Reference No.</th>
              <th scope="col" className="px-4 py-3">Item</th>
              <th scope="col" className="px-4 py-3">Quantity</th>
              <th scope="col" className="px-4 py-3">Unit Cost</th>
              <th scope="col" className="px-4 py-3">Supplier</th>
              {canManage && <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">{tx.refNo}</td>
                <td className="px-4 py-4">{getItemName(tx.itemId)}</td>
                <td className="px-4 py-4">{tx.quantity}</td>
                <td className="px-4 py-4">
                  {tx.unitCost.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                </td>
                <td className="px-4 py-4">{tx.supplier}</td>
                {canManage && (
                  <td className="px-4 py-4 text-right space-x-4">
                      <button onClick={() => onEditTransaction(tx)} className="font-medium text-blue-500 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">Edit</button>
                      <button onClick={() => deleteTransaction(tx.id)} className="font-medium text-red-500 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500 rounded">Delete</button>
                  </td>
                )}
              </tr>
            ))}
             {transactions.length === 0 && (
                <tr><td colSpan={canManage ? 6 : 5} className="text-center py-8 text-gray-500">No inflow transactions found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
};

export default ItemDetails;