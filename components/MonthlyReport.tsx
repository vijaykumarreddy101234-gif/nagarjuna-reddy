
import React, { useState, useMemo } from 'react';
import type { Item, InflowTransaction, ConsumptionTransaction, ReportCorrection } from '../types';

type TimeFilter = '1M' | '3M' | '6M' | '12M' | 'ALL';

interface MonthlyReportProps {
    items: Item[];
    inflow: InflowTransaction[];
    consumption: ConsumptionTransaction[];
    reportCorrections: ReportCorrection[];
    timeFilter: TimeFilter;
}

const MonthlyReport = ({ items, inflow, consumption, reportCorrections, timeFilter }) => {
    
    const reportData = useMemo(() => {
        const now = new Date();
        let thresholdDate: Date | null = null;

        switch(timeFilter) {
            case '1M': thresholdDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break;
            case '3M': thresholdDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break;
            case '6M': thresholdDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()); break;
            case '12M': thresholdDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break;
            case 'ALL': thresholdDate = null; break;
        }
        
        const periodStart = thresholdDate ? thresholdDate.getTime() : -Infinity;

        const results = items.map(item => {
            const allTxnsForItem = [
                ...inflow.filter(t => t.itemId === item.id && t.txnDate && !isNaN(new Date(t.txnDate).getTime())).map(t => ({ date: new Date(t.txnDate), qty: t.quantity })),
                ...consumption.filter(t => t.itemId === item.id && t.txnDate && !isNaN(new Date(t.txnDate).getTime())).map(t => ({ date: new Date(t.txnDate), qty: -t.quantity }))
            ];
            
            const correctionsForItem = reportCorrections.filter(c => c.itemId === item.id);

            // Calculate historical balance from transactions
            const historicalTxnsBalance = allTxnsForItem
                .filter(t => t.date.getTime() < periodStart)
                .reduce((sum, t) => sum + t.qty, 0);

            // Calculate the net effect of all corrections made before this period
            const historicalCorrectionDelta = correctionsForItem
                .filter(c => c.date && !isNaN(new Date(c.date).getTime()) && new Date(c.date).getTime() < periodStart)
                .reduce((delta, correction) => {
                    const dayStart = new Date(correction.date + 'T00:00:00').getTime();
                    const dayEnd = new Date(correction.date + 'T23:59:59').getTime();

                    const originalInflow = inflow
                        .filter(t => t.itemId === item.id && t.txnDate && !isNaN(new Date(t.txnDate).getTime()) && new Date(t.txnDate).getTime() >= dayStart && new Date(t.txnDate).getTime() <= dayEnd)
                        .reduce((sum, t) => sum + t.quantity, 0);

                    const originalConsumption = consumption
                        .filter(t => t.itemId === item.id && t.txnDate && !isNaN(new Date(t.txnDate).getTime()) && new Date(t.txnDate).getTime() >= dayStart && new Date(t.txnDate).getTime() <= dayEnd)
                        .reduce((sum, t) => sum + t.quantity, 0);

                    return delta + (correction.correctedInflow - originalInflow) - (correction.correctedConsumption - originalConsumption);
                }, 0);

            const openingBalance = historicalTxnsBalance + historicalCorrectionDelta;

            // Calculate this period's totals by iterating through each day and applying corrections
            let periodInflow = 0;
            let periodConsumption = 0;
            
            const periodTxns = allTxnsForItem.filter(t => t.date.getTime() >= periodStart);
            // Explicitly type the Map to ensure correct type inference for `correction` variable below.
            const periodCorrections: Map<string, ReportCorrection> = new Map(correctionsForItem.filter(c => c.date && !isNaN(new Date(c.date).getTime()) && new Date(c.date).getTime() >= periodStart).map(c => [c.date, c]));

            const dailyTotals = new Map<string, {in: number, out: number}>();
            
            periodTxns.forEach(t => {
                const dateStr = t.date.toISOString().split('T')[0];
                if (!dailyTotals.has(dateStr)) dailyTotals.set(dateStr, {in: 0, out: 0});
                const totals = dailyTotals.get(dateStr)!;
                if (t.qty > 0) totals.in += t.qty;
                else totals.out += -t.qty;
            });
            
            dailyTotals.forEach((totals, dateStr) => {
                const correction = periodCorrections.get(dateStr);
                periodInflow += correction ? correction.correctedInflow : totals.in;
                periodConsumption += correction ? correction.correctedConsumption : totals.out;
            });
            
            const closingBalance = openingBalance + periodInflow - periodConsumption;

            return { item, openingBalance, periodInflow, periodConsumption, closingBalance };
        });

        return results.filter(r => r.openingBalance !== 0 || r.periodInflow !== 0 || r.periodConsumption !== 0 || r.closingBalance !== 0);
    }, [timeFilter, items, inflow, consumption, reportCorrections]);
    
    const formattedPeriod = useMemo(() => {
        switch(timeFilter) {
            case '1M': return "Last 1 Month";
            case '3M': return "Last 3 Months";
            case '6M': return "Last 6 Months";
            case '12M': return "Last 12 Months";
            case 'ALL': return "All Time";
            default: return "Period Summary";
        }
    }, [timeFilter]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-md shadow">
            <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">RM Period Summary</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                     <thead className="text-xs text-white uppercase bg-[#374A67] dark:bg-gray-700">
                        <tr className="border-b border-gray-400 dark:border-gray-600">
                            <th colSpan={7} className="px-6 py-3 text-2xl font-bold text-center">RAW MATERIAL</th>
                        </tr>
                         <tr className="border-b border-gray-400 dark:border-gray-600">
                            <th colSpan={7} className="px-6 py-1 text-sm font-medium text-right">{formattedPeriod}</th>
                        </tr>
                        <tr>
                            <th scope="col" className="px-6 py-3">Item Code</th>
                            <th scope="col" className="px-6 py-3">Description</th>
                            <th scope="col" className="px-6 py-3">Unit</th>
                            <th scope="col" className="px-6 py-3 text-right">Opening Balance</th>
                            <th scope="col" className="px-6 py-3 text-right">Total Inflow</th>
                            <th scope="col" className="px-6 py-3 text-right">Total Consumption</th>
                            <th scope="col" className="px-6 py-3 text-right">Closing Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.length === 0 ? (
                             <tr>
                                <td colSpan={7} className="text-center py-8 text-gray-500 dark:text-gray-400">No data for the selected period.</td>
                            </tr>
                        ) : (
                            reportData.map(data => (
                                <tr key={data.item.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">{data.item.sku}</th>
                                    <td className="px-6 py-4">{data.item.name}</td>
                                    <td className="px-6 py-4">{data.item.uom}</td>
                                    <td className="px-6 py-4 text-right">{data.openingBalance.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right">{data.periodInflow.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right">{data.periodConsumption.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-semibold">{data.closingBalance.toLocaleString()}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MonthlyReport;
