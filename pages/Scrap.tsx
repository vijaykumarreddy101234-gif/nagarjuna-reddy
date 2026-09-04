import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { TransactionTable, TransactionModal, EditTransactionModal } from '../components/ProfileTransactions';
import { Trash2, Plus, Search, Filter, UploadCloud as CloudUploadIcon } from 'lucide-react';
import type { ProfileTransaction, Profile, ID, ToastMessage } from '../types';
import { Card } from '../components/Card';

interface ScrapProps {
    addToast: (message: string, type: ToastMessage['type']) => void;
}

const Scrap: React.FC<ScrapProps> = ({ addToast }) => {
    const profileTransactions = useStore(state => state.profileTransactions);
    const profiles = useStore(state => state.profiles);
    const deleteProfileTransaction = useStore(state => state.deleteProfileTransaction);
    const addProfileTransaction = useStore(state => state.addProfileTransaction);
    const updateProfileTransaction = useStore(state => state.updateProfileTransaction);
    const brands = useStore(state => state.brands);
    const customers = useStore(state => state.customers);

    const [searchTerm, setSearchTerm] = useState('');
    const [brandFilter, setBrandFilter] = useState('All');
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<ProfileTransaction | null>(null);

    const getProfile = (id: ID) => profiles.find(p => p.id === id);
    const getProfileName = (id: ID) => getProfile(id)?.name || 'Unknown';

    const scrapTransactions = useMemo(() => {
        let filtered = profileTransactions.filter(t => t.type === 'SCRAP' && !t.deletedAt);
        
        if (brandFilter !== 'All') {
            filtered = filtered.filter(t => {
                const profile = getProfile(t.profileId);
                return (t.brand || profile?.brand) === brandFilter;
            });
        }

        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(t => {
                const profile = getProfile(t.profileId);
                return (
                    profile?.name.toLowerCase().includes(lowerSearch) ||
                    profile?.sku.toLowerCase().includes(lowerSearch) ||
                    t.refNo.toLowerCase().includes(lowerSearch)
                );
            });
        }

        return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [profileTransactions, searchTerm, brandFilter, profiles]);

    const getBrandBadge = (brandName?: string) => {
        if (!brandName) return <span className="px-2 py-0.5 rounded-full text-[8px] font-black bg-gray-100 text-gray-500 uppercase tracking-tighter">Generic</span>;
        return (
            <div className="flex items-center gap-1">
                <span className="px-2 py-0.5 rounded-full text-[8px] font-black bg-blue-50 text-blue-600 uppercase tracking-tighter border border-blue-100">{brandName}</span>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Scrap Management</h1>
                    <p className="text-xs text-gray-500 font-medium">Track and manage profile scrap records</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => { setEditingTransaction(null); setIsTransactionModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-700 transition-all hover:scale-105 active:scale-95"
                    >
                        <Plus className="w-4 h-4" /> Record Scrap
                    </button>
                </div>
            </div>

            <Card>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by SKU, Name or Ref No..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/50 p-1 rounded-xl border border-gray-100 dark:border-gray-700">
                        <Filter className="w-3 h-3 text-gray-400 ml-2" />
                        <select
                            value={brandFilter}
                            onChange={(e) => setBrandFilter(e.target.value)}
                            className="bg-transparent text-xs font-bold uppercase tracking-tighter outline-none pr-4"
                        >
                            <option value="All">All Brands</option>
                            {brands.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                </div>

                <TransactionTable 
                    transactions={scrapTransactions} 
                    getProfileName={getProfileName}
                    onEdit={(tx) => { setEditingTransaction(tx); setIsTransactionModalOpen(false); /* We use EditTransactionModal for editing existing ones */ }}
                    onDelete={deleteProfileTransaction}
                    type="SCRAP"
                    getBrandBadge={getBrandBadge}
                    getProfile={getProfile}
                />

                {scrapTransactions.length === 0 && (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tighter">No Scrap Records Found</h3>
                        <p className="text-xs text-gray-500 mt-1">Try adjusting your search or filters.</p>
                    </div>
                )}
            </Card>

            <TransactionModal 
                isOpen={isTransactionModalOpen && !editingTransaction} 
                onClose={() => setIsTransactionModalOpen(false)} 
                type="SCRAP"
                profiles={profiles}
                brands={brands}
                onAdd={addProfileTransaction}
                addToast={addToast}
                customers={customers}
            />

            <EditTransactionModal 
                isOpen={!!editingTransaction} 
                onClose={() => setEditingTransaction(null)} 
                transaction={editingTransaction} 
                onUpdate={updateProfileTransaction} 
            />
        </div>
    );
};

export default Scrap;
