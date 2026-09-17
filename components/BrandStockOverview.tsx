import React from 'react';
import { Building2 } from 'lucide-react';
import { ProtectiveFilmInwardTransaction, ProtectiveFilmOutwardAdjustment } from '../types';

interface BrandStats {
    in: number;
    out: number;
    net: number;
}

interface BrandStockOverviewProps {
    brands: string[];
    inward: ProtectiveFilmInwardTransaction[];
    outward: ProtectiveFilmOutwardAdjustment[];
    onBrandClick: (brand: string) => void;
}

export const BrandStockOverview = ({ brands, inward, outward, onBrandClick }) => {
    const stats: Record<string, BrandStats> = brands.reduce((acc, brand) => {
        const brandStr = String(brand || '').toLowerCase();
        const brandIn = inward.filter(t => String(t.brand || '').toLowerCase() === brandStr).reduce((sum, t) => sum + (t.meters * (t.rollCount || 1)), 0);
        const brandOut = outward.filter(a => String(a.brand || '').toLowerCase() === brandStr).reduce((sum, a) => sum + (a.meters || 0), 0);
        acc[brand] = { in: brandIn, out: brandOut, net: brandIn - brandOut };
        return acc;
    }, {} as Record<string, BrandStats>);

    const totalIn = inward.reduce((sum, t) => sum + (t.meters * (t.rollCount || 1)), 0);
    const totalOut = outward.reduce((sum, a) => sum + (a.meters || 0), 0);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900 p-4 rounded-xl cursor-pointer hover:bg-gray-800" onClick={() => onBrandClick('All')}>
                <div className="text-gray-400 text-xs font-bold mb-1 flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> ALL BRANDS
                </div>
                <div className="text-2xl font-bold text-white">{totalIn - totalOut} <span className="text-sm font-normal">m net</span></div>
                <div className="text-gray-500 text-xs mt-2">In: {totalIn}m | Out: {totalOut}m</div>
            </div>
            {brands.map(brand => (
                <div key={brand} className="bg-gray-900 p-4 rounded-xl cursor-pointer hover:bg-gray-800" onClick={() => onBrandClick(brand)}>
                    <div className="text-gray-400 text-xs font-bold mb-1 flex items-center gap-2">
                        {brand.toUpperCase()}
                    </div>
                    <div className="text-2xl font-bold text-white">{stats[brand]?.net || 0} <span className="text-sm font-normal">m net</span></div>
                    <div className="text-gray-500 text-xs mt-2">In: {stats[brand]?.in || 0}m | Out: {stats[brand]?.out || 0}m</div>
                </div>
            ))}
        </div>
    );
};
