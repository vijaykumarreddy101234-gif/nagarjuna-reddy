import React, { useState, useMemo } from 'react';
import type { Profile, ProfileTransaction } from '../types';

type TimeFilter = '1M' | '3M' | '6M' | '12M' | 'ALL';

interface ProfileMonthlyReportProps {
    profiles: Profile[];
    transactions: ProfileTransaction[];
    brandFilter: string;
    timeFilter: TimeFilter;
}

const ProfileMonthlyReport: React.FC<ProfileMonthlyReportProps> = ({ profiles, transactions, brandFilter, timeFilter }) => {

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

        const filteredProfiles = brandFilter === 'All'
            ? profiles
            : profiles.filter(p => p.brand === brandFilter);

        const sortedProfiles = [...filteredProfiles].sort((a, b) => (a.brand || '').localeCompare(b.brand || '') || a.name.localeCompare(b.name));

        return sortedProfiles.map(profile => {
            const relevantTxns = transactions.filter(t => t.profileId === profile.id);

            // Calculate Opening Balance (transactions before periodStart)
            const openingBalance = relevantTxns.reduce((sum, t) => {
                if (t.date && !isNaN(new Date(t.date).getTime()) && new Date(t.date).getTime() < periodStart) {
                    if (t.type === 'PRODUCTION' || t.type === 'RETURN') return sum + t.quantity;
                    if (t.type === 'DISPATCH' || t.type === 'SCRAP') return sum - t.quantity;
                }
                return sum;
            }, 0);

            // Calculate Period Totals
            let totalProduction = 0;
            let totalDispatch = 0;
            let totalScrap = 0;

            relevantTxns.forEach(t => {
                if (t.date && !isNaN(new Date(t.date).getTime())) {
                    const tTime = new Date(t.date).getTime();
                    if (tTime >= periodStart) {
                         if (t.type === 'PRODUCTION' || t.type === 'RETURN') totalProduction += t.quantity;
                         if (t.type === 'DISPATCH') totalDispatch += t.quantity;
                         if (t.type === 'SCRAP') totalScrap += t.quantity;
                    }
                }
            });

            const closingBalance = openingBalance + totalProduction - totalDispatch - totalScrap;

            return {
                profile,
                openingBalance,
                totalProduction,
                totalDispatch,
                totalScrap,
                closingBalance
            };
        }).filter(row => row.openingBalance !== 0 || row.totalProduction !== 0 || row.totalDispatch !== 0 || row.totalScrap !== 0 || row.closingBalance !== 0);
    }, [profiles, transactions, timeFilter, brandFilter]);

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
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Profile Stock Period Summary</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                     <thead className="text-xs text-white uppercase bg-[#2D3E50] dark:bg-gray-700">
                        <tr className="border-b border-gray-400 dark:border-gray-600">
                            <th colSpan={8} className="px-6 py-3 text-2xl font-bold text-center">PROFILE STOCK REPORT</th>
                        </tr>
                         <tr className="border-b border-gray-400 dark:border-gray-600">
                            <th colSpan={8} className="px-6 py-1 text-sm font-medium text-right">{formattedPeriod}</th>
                        </tr>
                        <tr>
                            <th scope="col" className="px-6 py-3">Brand</th>
                            <th scope="col" className="px-6 py-3">SKU</th>
                            <th scope="col" className="px-6 py-3">Profile Name</th>
                            <th scope="col" className="px-6 py-3 text-right">Opening Balance</th>
                            <th scope="col" className="px-6 py-3 text-right">Total Production</th>
                            <th scope="col" className="px-6 py-3 text-right">Total Dispatch</th>
                            <th scope="col" className="px-6 py-3 text-right">Total Scrap</th>
                            <th scope="col" className="px-6 py-3 text-right">Closing Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.length === 0 ? (
                             <tr>
                                <td colSpan={8} className="text-center py-8 text-gray-500 dark:text-gray-400">No activity for selected period.</td>
                            </tr>
                        ) : (
                            reportData.map(data => (
                                <tr key={data.profile.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <td className="px-6 py-4"><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">{data.profile.brand || '-'}</span></td>
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">{data.profile.sku}</th>
                                    <td className="px-6 py-4">{data.profile.name}</td>
                                    <td className="px-6 py-4 text-right font-medium">{data.openingBalance}</td>
                                    <td className="px-6 py-4 text-right text-green-600 dark:text-green-400">{data.totalProduction}</td>
                                    <td className="px-6 py-4 text-right text-blue-600 dark:text-blue-400">{data.totalDispatch}</td>
                                    <td className="px-6 py-4 text-right text-red-600 dark:text-red-400">{data.totalScrap}</td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">{data.closingBalance}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProfileMonthlyReport;