import React from 'react';

interface DeletedTransaction {
    id: string;
    refNo: string;
    deletedAt: string | null | undefined;
    type: 'Inflow' | 'Consumption';
}

interface DeletedTransactionsTableProps {
  transactions: DeletedTransaction[];
  restoreTransaction: (id: string, type: 'inflow' | 'consumption') => void;
  permanentlyDeleteTransaction: (id: string, type: 'inflow' | 'consumption') => void;
}

const DeletedTransactionsTable = ({ transactions, restoreTransaction, permanentlyDeleteTransaction }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-md shadow">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
          <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3">Type</th>
              <th scope="col" className="px-6 py-3">Reference No.</th>
              <th scope="col" className="px-6 py-3">Deleted On</th>
              <th scope="col" className="px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
                <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500 dark:text-gray-400">No deleted transactions.</td>
                </tr>
            ) : (
                transactions.map(tx => (
                      <tr key={tx.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                        <td className="px-6 py-4">{tx.type}</td>
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{tx.refNo}</td>
                        <td className="px-6 py-4">{tx.deletedAt ? new Date(tx.deletedAt).toLocaleString() : ''}</td>
                        <td className="px-6 py-4 text-right space-x-4">
                            <button onClick={() => restoreTransaction(tx.id, tx.type === 'Inflow' ? 'inflow' : 'consumption')} className="font-medium text-green-500 hover:underline">Restore</button>
                            <button onClick={() => permanentlyDeleteTransaction(tx.id, tx.type === 'Inflow' ? 'inflow' : 'consumption')} className="font-medium text-red-500 hover:underline">Delete Permanently</button>
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

export default DeletedTransactionsTable;