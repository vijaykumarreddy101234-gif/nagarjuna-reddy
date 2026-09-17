import React from 'react';
import type { Item } from '../types';

interface StockTableProps {
  items: (Item & { currentStock: number; totalInflow: number; totalOutflow: number })[];
  deleteItem: (itemId: string) => void;
  onEditItem: (item: Item) => void;
}

const StockTable = ({ items, deleteItem, onEditItem }) => {
  const canManage = true; // All permissions enabled
  
  return (
    <div className="table-container shadow-xl">
      <table className="w-full text-left text-slate-600 dark:text-slate-300">
        <thead className="text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400">
          <tr>
            <th scope="col" className="px-6 py-4">SKU Code</th>
            <th scope="col" className="px-6 py-4">Item Name</th>
            <th scope="col" className="px-6 py-4">UOM</th>
            <th scope="col" className="px-6 py-4 text-right bg-slate-50/50 dark:bg-slate-800/20">Opening Balance</th>
            <th scope="col" className="px-6 py-4 text-right text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10">Inflow (+)</th>
            <th scope="col" className="px-6 py-4 text-right text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/10">Outflow (-)</th>
            <th scope="col" className="px-6 py-4 text-right text-primary-600 dark:text-primary-400 bg-blue-50/30 dark:bg-slate-800/40 font-black">Closing Balance</th>
            <th scope="col" className="px-6 py-4 text-right">Reorder Point</th>
            <th scope="col" className="px-6 py-4 text-center">Status</th>
            {canManage && <th scope="col" className="px-6 py-4 no-print text-right"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
          {items.length === 0 ? (
              <tr>
                  <td colSpan={canManage ? 10 : 9} className="text-center py-12 text-slate-500 font-bold uppercase tracking-widest text-xs">No matching inventory items found.</td>
              </tr>
          ) : (
              items.map((item) => {
                  const isLowStock = item.currentStock < item.reorderPoint;
                  return (
                    <tr 
                      key={item.id} 
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <th scope="row" className="px-6 py-4 font-mono font-black text-slate-900 dark:text-white whitespace-nowrap">
                        {item.sku}
                      </th>
                      <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">{item.name}</td>
                      <td className="px-6 py-4 font-mono text-xs">{item.uom}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-gray-500 bg-slate-50/30 dark:bg-slate-800/10">
                          {Number(item.openingStock || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50/10 dark:bg-emerald-950/5">
                          {(item.totalInflow || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-black text-rose-600 dark:text-rose-400 bg-rose-50/10 dark:bg-rose-950/5">
                          {(item.totalOutflow || 0).toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 text-right font-mono font-black text-sm bg-blue-50/10 dark:bg-slate-850/20 ${isLowStock ? 'text-red-500 underline decoration-double' : 'text-slate-900 dark:text-white'}`}>
                          {(item.currentStock || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-500 font-semibold">{(item.reorderPoint || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                          {isLowStock ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                  LOW STOCK
                              </span>
                          ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  IN STOCK
                              </span>
                          )}
                      </td>
                      {canManage && (
                        <td className="px-6 py-4 text-right space-x-3 no-print whitespace-nowrap">
                            <button 
                              onClick={() => onEditItem(item)} 
                              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-950/30 dark:hover:text-primary-400 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => deleteItem(item.id)} 
                              className="px-3 py-1.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                            >
                              Delete
                            </button>
                        </td>
                      )}
                    </tr>
                  )
              })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default StockTable;