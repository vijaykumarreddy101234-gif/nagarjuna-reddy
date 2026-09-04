import React, { useState, useMemo } from 'react';
import type { Item, InflowTransaction, ConsumptionTransaction } from '../types';
import { SearchIcon } from './Icon';

interface StockMovementTableProps {
    items: Item[];
    inflow: InflowTransaction[];
    consumption: ConsumptionTransaction[];
}

const StockMovementTable: React.FC<StockMovementTableProps> = ({ items, inflow, consumption }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const allMovements = useMemo(() => {
        const itemMap = new Map(items.map(item => [item.id, item]));

        const inflowMovements = inflow.map(tx => ({
            type: 'IN' as const,
            date: tx.txnDate,
            id: tx.id,
            refNo: tx.refNo,
            item: itemMap.get(tx.itemId),
            quantity: tx.quantity,
            details: `from ${tx.supplier || 'N/A'}`,
        }));

        const consumptionMovements = consumption.map(tx => ({
            type: 'CONSUMED' as const,
            date: tx.txnDate,
            id: tx.id,
            refNo: tx.refNo,
            item: itemMap.get(tx.itemId),
            quantity: tx.quantity,
            details: `for Batch Ref ${tx.batchNo || tx.refNo || 'N/A'}`,
        }));

        return [...inflowMovements, ...consumptionMovements]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    }, [items, inflow, consumption]);
    
    const filteredMovements = useMemo(() => {
        if (!searchTerm) return allMovements;
        const lowercasedFilter = searchTerm.toLowerCase();
        return allMovements.filter(m => 
            m.refNo.toLowerCase().includes(lowercasedFilter) ||
            m.item?.name.toLowerCase().includes(lowercasedFilter) ||
            m.item?.sku.toLowerCase().includes(lowercasedFilter) ||
            m.details.toLowerCase().includes(lowercasedFilter)
        );
    }, [allMovements, searchTerm]);

    const getBadgeClass = (type: 'IN' | 'CONSUMED') => {
        switch (type) {
            case 'IN': return "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300";
            case 'CONSUMED': return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
            default: return "";
        }
    }
    
    const getQuantityClass = (type: 'IN' | 'CONSUMED') => {
       return type === 'CONSUMED' ? 'text-red-600' : 'text-green-600';
    }


    return (
        <div className="bg-white dark:bg-gray-800 rounded-md shadow">
            <div className="p-4 flex justify-end no-print">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search ref, item, supplier..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md focus:ring-blue-500 focus:border-blue-500 w-64"
                        aria-label="Search stock movements"
                    />
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th scope="col" className="px-6 py-3">Date</th>
                            <th scope="col" className="px-6 py-3">Type</th>
                            <th scope="col" className="px-6 py-3">Item</th>
                            <th scope="col" className="px-6 py-3">Reference</th>
                            <th scope="col" className="px-6 py-3 text-right">Quantity Change</th>
                            <th scope="col" className="px-6 py-3">Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredMovements.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">No stock movements found.</td>
                            </tr>
                        ) : (
                            filteredMovements.map(m => (
                                <tr key={m.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                    <td className="px-6 py-4 whitespace-nowrap">{new Date(m.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeClass(m.type)}`}>
                                            {m.type}
                                        </span>
                                    </td>
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                                        {m.item?.name || 'Unknown Item'}
                                        <div className="text-xs text-gray-500">{m.item?.sku}</div>
                                    </th>
                                    <td className="px-6 py-4">{m.refNo}</td>
                                    <td className={`px-6 py-4 text-right font-semibold ${getQuantityClass(m.type)}`}>
                                        {m.type === 'CONSUMED' ? '-' : '+'}{(m.quantity || 0).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">{m.details}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StockMovementTable;