import React, { useState, useMemo } from 'react';
import type { Item, InflowTransaction, ConsumptionTransaction, ReportCorrection, User } from '../types';
import CorrectionModal from './CorrectionModal';

interface ConsumptionReportProps {
    items: Item[];
    inflow: InflowTransaction[];
    consumption: ConsumptionTransaction[];
    reportCorrections: ReportCorrection[];
    addOrUpdateReportCorrection: (correction: Omit<ReportCorrection, 'updatedAt'>) => void;
}

const ConsumptionReport = ({ items, inflow, consumption, reportCorrections, addOrUpdateReportCorrection }) => {
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [correctingItem, setCorrectingItem] = useState<{
        item: Item;
        calculated: { totalIn: number; totalConsumption: number };
        correction?: ReportCorrection;
    } | null>(null);

    const canManage = true; // All permissions enabled

    const reportData = useMemo(() => {
        if (!reportDate || isNaN(new Date(reportDate).getTime())) {
            return [];
        }
        
        const [year, month, day] = reportDate.split('-').map(Number);
        // Get the start and end of the day in the user's local timezone.
        const reportDayStart = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
        const reportDayEnd = new Date(year, month - 1, day + 1, 0, 0, 0, 0).getTime();

        const correctionsForDate: Map<string, ReportCorrection> = new Map(
            reportCorrections
                .filter(c => c.date === reportDate)
                .map(c => [c.itemId, c])
        );

        const results = items.map(item => {
            const allTxnsForItem = [
                ...inflow.filter(t => t.itemId === item.id && t.txnDate && !isNaN(new Date(t.txnDate).getTime())).map(t => ({ date: new Date(t.txnDate), qty: t.quantity })),
                ...consumption.filter(t => t.itemId === item.id && t.txnDate && !isNaN(new Date(t.txnDate).getTime())).map(t => ({ date: new Date(t.txnDate), qty: -t.quantity }))
            ];

            const openingBalance = allTxnsForItem
                .filter(t => t.date.getTime() < reportDayStart)
                .reduce((sum, t) => sum + t.qty, 0);

            const calculatedIn = allTxnsForItem
                .filter(t => t.qty > 0 && t.date.getTime() >= reportDayStart && t.date.getTime() < reportDayEnd)
                .reduce((sum, t) => sum + t.qty, 0);
            
            const calculatedConsumption = allTxnsForItem
                .filter(t => t.qty < 0 && t.date.getTime() >= reportDayStart && t.date.getTime() < reportDayEnd)
                .reduce((sum, t) => sum + t.qty, 0) * -1; // Make it a positive number for display

            const correction = correctionsForDate.get(item.id);
            const finalIn = correction ? correction.correctedInflow : calculatedIn;
            const finalConsumption = correction ? correction.correctedConsumption : calculatedConsumption;
            const closingBalance = openingBalance + finalIn - finalConsumption;

            return {
                item,
                openingBalance,
                calculatedIn,
                calculatedConsumption,
                finalIn,
                finalConsumption,
                closingBalance,
                correction
            };
        });

        return results.filter(r => r.openingBalance !== 0 || r.finalIn !== 0 || r.finalConsumption !== 0 || r.closingBalance !== 0);

    }, [reportDate, items, inflow, consumption, reportCorrections]);

    const formattedDate = useMemo(() => {
        if (!reportDate || isNaN(new Date(reportDate).getTime())) {
            return 'Invalid Date';
        }
        const d = new Date(reportDate + 'T00:00:00.000Z');
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}-${month}-${year}`;
    }, [reportDate]);


    return (
        <>
        <div className="bg-white dark:bg-gray-800 rounded-md shadow">
            <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                 <h2 className="text-xl font-bold text-gray-900 dark:text-white">Raw Material Report</h2>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 no-print">
                        <label htmlFor="report-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">Report Date:</label>
                        <input
                            type="date"
                            id="report-date"
                            value={reportDate}
                            onChange={e => setReportDate(e.target.value)}
                            className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                    <thead className="text-xs text-white uppercase bg-[#374A67] dark:bg-gray-700">
                        <tr className="border-b border-gray-400 dark:border-gray-600">
                            <th colSpan={canManage ? 8 : 7} className="px-6 py-3 text-2xl font-bold text-center">RAW MATERIAL</th>
                        </tr>
                         <tr className="border-b border-gray-400 dark:border-gray-600">
                            <th colSpan={canManage ? 8 : 7} className="px-6 py-1 text-sm font-medium text-right">{formattedDate}</th>
                        </tr>
                        <tr>
                            <th scope="col" className="px-6 py-3">Item Code</th>
                            <th scope="col" className="px-6 py-3">Description</th>
                            <th scope="col" className="px-6 py-3">Unit</th>
                            <th scope="col" className="px-6 py-3 text-right">Open B/L</th>
                            <th scope="col" className="px-6 py-3 text-right">Total In</th>
                            <th scope="col" className="px-6 py-3 text-right">Total Consump</th>
                            <th scope="col" className="px-6 py-3 text-right">Closing B/L</th>
                            {canManage && <th scope="col" className="px-6 py-3 no-print">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.length === 0 ? (
                            <tr>
                                <td colSpan={canManage ? 8 : 7} className="text-center py-8 text-gray-500 dark:text-gray-400">No data for the selected date.</td>
                            </tr>
                        ) : (
                            reportData.map(data => {
                                const { item, openingBalance, calculatedIn, calculatedConsumption, finalIn, finalConsumption, closingBalance, correction } = data;
                                const isInCorrected = correction && correction.correctedInflow !== calculatedIn;
                                const isConsumptionCorrected = correction && correction.correctedConsumption !== calculatedConsumption;

                                return (
                                <tr key={item.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">{item.sku}</th>
                                    <td className="px-6 py-4">{item.name}</td>
                                    <td className="px-6 py-4">{item.uom}</td>
                                    <td className="px-6 py-4 text-right">{openingBalance.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        {finalIn.toLocaleString()}
                                        {isInCorrected && (
                                            <span className="ml-1 text-blue-500 cursor-help no-print" title={`Original: ${calculatedIn.toLocaleString()}. Reason: ${correction.reason}`}>✏️</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {finalConsumption.toLocaleString()}
                                        {isConsumptionCorrected && (
                                            <span className="ml-1 text-blue-500 cursor-help no-print" title={`Original: ${calculatedConsumption.toLocaleString()}. Reason: ${correction.reason}`}>✏️</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right font-semibold">{closingBalance.toLocaleString()}</td>
                                    {canManage && 
                                    <td className="px-6 py-4 whitespace-nowrap no-print">
                                        <button 
                                            onClick={() => setCorrectingItem({
                                                item,
                                                calculated: { totalIn: calculatedIn, totalConsumption: calculatedConsumption },
                                                correction
                                            })}
                                            className="font-medium text-blue-500 hover:underline"
                                        >
                                            Correct
                                        </button>
                                    </td>
                                    }
                                </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
        {correctingItem && (
            <CorrectionModal
                isOpen={!!correctingItem}
                onClose={() => setCorrectingItem(null)}
                item={correctingItem.item}
                reportDate={reportDate}
                calculatedData={correctingItem.calculated}
                existingCorrection={correctingItem.correction}
                onSave={addOrUpdateReportCorrection}
            />
        )}
        </>
    );
};

export default ConsumptionReport;