import React, { useState, useMemo } from 'react';
import type { Profile, ProfileTransaction } from '../types';

interface ProfileDailyReportProps {
    profiles: Profile[];
    transactions: ProfileTransaction[];
    brandFilter: string;
}

const ProfileDailyReport = ({ profiles, transactions, brandFilter }) => {
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

    const reportData = useMemo(() => {
        if (!reportDate || isNaN(new Date(reportDate).getTime())) return [];
        const [year, month, day] = reportDate.split('-').map(Number);
        const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
        const dayEnd = new Date(year, month - 1, day + 1, 0, 0, 0, 0).getTime();

        const filteredProfiles = brandFilter === 'All'
            ? profiles
            : profiles.filter(p => p.brand === brandFilter);

        // Group profiles by Brand for better sorting
        const sortedProfiles = [...filteredProfiles].sort((a, b) => (a.brand || '').localeCompare(b.brand || '') || a.name.localeCompare(b.name));

        return sortedProfiles.map(profile => {
            // Filter transactions for this profile
            const relevantTxns = transactions.filter(t => t.profileId === profile.id);
            
            // Calculate opening balance (transactions strictly before this day)
            const openingBalance = relevantTxns.reduce((sum, t) => {
                if (t.date && !isNaN(new Date(t.date).getTime()) && new Date(t.date).getTime() < dayStart) {
                    if (t.type === 'PRODUCTION' || t.type === 'RETURN') return sum + t.quantity;
                    if (t.type === 'DISPATCH') return sum - t.quantity;
                    if (t.type === 'SCRAP') return sum - t.quantity;
                }
                return sum;
            }, 0);

            // Calculate daily movements
            let production = 0;
            let dispatch = 0;
            let scrap = 0;

            relevantTxns.forEach(t => {
                if (t.date && !isNaN(new Date(t.date).getTime())) {
                    const tTime = new Date(t.date).getTime();
                    if (tTime >= dayStart && tTime < dayEnd) {
                         if (t.type === 'PRODUCTION' || t.type === 'RETURN') production += t.quantity;
                         if (t.type === 'DISPATCH') dispatch += t.quantity;
                         if (t.type === 'SCRAP') scrap += t.quantity;
                    }
                }
            });

            const closingBalance = openingBalance + production - dispatch - scrap;

            return {
                profile,
                openingBalance,
                production,
                dispatch,
                scrap,
                closingBalance
            };
        }).filter(row => row.openingBalance !== 0 || row.production !== 0 || row.dispatch !== 0 || row.scrap !== 0 || row.closingBalance !== 0);

    }, [profiles, transactions, reportDate, brandFilter]);

    const formattedDate = useMemo(() => {
        if (!reportDate || isNaN(new Date(reportDate).getTime())) return '';
        const [year, month, day] = reportDate.split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }, [reportDate]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-md shadow">
            <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                 <h2 className="text-xl font-bold text-gray-900 dark:text-white">Daily Profile Report</h2>
                <div className="flex items-center gap-2 no-print">
                    <label htmlFor="profile-report-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">Report Date:</label>
                    <input
                        type="date"
                        id="profile-report-date"
                        value={reportDate}
                        onChange={e => setReportDate(e.target.value)}
                        className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-600 dark:text-gray-400">
                    <thead className="text-xs text-white uppercase bg-[#2D3E50] dark:bg-gray-700">
                        <tr className="border-b border-gray-400 dark:border-gray-600">
                            <th colSpan={8} className="px-6 py-3 text-2xl font-bold text-center">PROFILE STOCK REPORT</th>
                        </tr>
                         <tr className="border-b border-gray-400 dark:border-gray-600">
                            <th colSpan={8} className="px-6 py-1 text-sm font-medium text-right">{formattedDate}</th>
                        </tr>
                        <tr>
                            <th scope="col" className="px-6 py-3">Brand</th>
                            <th scope="col" className="px-6 py-3">SKU</th>
                            <th scope="col" className="px-6 py-3">Profile Name</th>
                            <th scope="col" className="px-6 py-3 text-right">Opening Stock</th>
                            <th scope="col" className="px-6 py-3 text-right">Production (In)</th>
                            <th scope="col" className="px-6 py-3 text-right">Dispatch (Out)</th>
                            <th scope="col" className="px-6 py-3 text-right">Scrap (Out)</th>
                            <th scope="col" className="px-6 py-3 text-right">Closing Stock</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-gray-500 dark:text-gray-400">No profile activity for selected date.</td>
                            </tr>
                        ) : (
                            reportData.map(data => (
                                <tr key={data.profile.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <td className="px-6 py-4"><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">{data.profile.brand || '-'}</span></td>
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">{data.profile.sku}</th>
                                    <td className="px-6 py-4">{data.profile.name}</td>
                                    <td className="px-6 py-4 text-right font-medium">{data.openingBalance}</td>
                                    <td className="px-6 py-4 text-right text-green-600 dark:text-green-400">{data.production > 0 ? `+${data.production}` : '-'}</td>
                                    <td className="px-6 py-4 text-right text-blue-600 dark:text-blue-400">{data.dispatch > 0 ? `-${data.dispatch}` : '-'}</td>
                                    <td className="px-6 py-4 text-right text-red-600 dark:text-red-400">{data.scrap > 0 ? `-${data.scrap}` : '-'}</td>
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

export default ProfileDailyReport;