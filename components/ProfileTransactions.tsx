import React, { useState, useMemo, useEffect } from 'react';
import { Edit2, Trash2, History, X, Plus } from 'lucide-react';
import type { ProfileTransaction, Profile, Customer, ToastMessage } from '../types';

interface TransactionTableProps {
    transactions: ProfileTransaction[];
    getProfileName: (id: string) => string;
    onEdit: (tx: ProfileTransaction) => void;
    onDelete: (id: string) => void;
    onPrint?: (tx: ProfileTransaction) => void;
    type: 'PRODUCTION' | 'DISPATCH' | 'SCRAP' | 'QUOTATION' | 'RETURN';
    getBrandBadge: (brand?: string) => React.ReactNode;
    getProfile: (id: string) => Profile | undefined;
    isMovementView?: boolean;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({ 
    transactions, 
    getProfileName, 
    onEdit, 
    onDelete, 
    onPrint, 
    type, 
    getBrandBadge, 
    getProfile,
    isMovementView
}) => (
    <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-50/50 dark:bg-gray-900/50 border-b dark:border-gray-700">
                {isMovementView ? (
                    <tr>
                        <th className="px-6 py-4 font-black">DATE</th>
                        <th className="px-6 py-4 font-black">TYPE</th>
                        <th className="px-6 py-4 font-black">ITEM</th>
                        <th className="px-6 py-4 font-black">REFERENCE</th>
                        <th className="px-6 py-4 text-right font-black">QUANTITY CHANGE</th>
                        <th className="px-6 py-4 text-center font-black">DETAILS</th>
                        <th className="px-6 py-4 text-right no-print font-black">ACTIONS</th>
                    </tr>
                ) : (
                    <tr>
                        <th className="px-6 py-4 font-black">Brand</th>
                        <th className="px-6 py-4 font-black">Date / Ref</th>
                        <th className="px-6 py-4 font-black">Profile</th>
                        <th className="px-6 py-4 text-right font-black">Quantity</th>
                        <th className="px-6 py-4 text-right no-print font-black">Actions</th>
                    </tr>
                )}
            </thead>
            <tbody className="divide-y dark:divide-gray-700 text-[11px]">
                {transactions.map((t, idx) => {
                    const profile = getProfile(t.profileId);
                    const isPositive = t.type === 'PRODUCTION' || t.type === 'RETURN';
                    
                    if (isMovementView) {
                        return (
                            <tr key={`${t.id || idx}_${idx}`} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200">
                                <td className="px-6 py-4 font-bold text-gray-500">
                                    {new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                                        isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                        {t.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-black text-gray-900 dark:text-white uppercase">{profile?.name || 'Unknown'}</span>
                                        <span className="text-[9px] text-gray-400 font-mono italic">{profile?.sku}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-mono font-bold text-gray-600 dark:text-gray-400">
                                    {t.refNo}
                                </td>
                                <td className={`px-6 py-4 text-right font-black font-mono text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                    {isPositive ? '+' : '-'}{t.quantity}
                                </td>
                                <td className="px-6 py-4 text-center text-gray-500 font-medium">
                                    {t.customer ? `Client: ${t.customer}` : (t.type === 'PRODUCTION' ? 'Initial Stock' : '-')}
                                </td>
                                <td className="px-6 py-4 text-right no-print">
                                    <div className="flex justify-end gap-1">
                                        <button onClick={() => onEdit(t)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all">
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => onDelete(t.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    }

                    return (
                        <tr key={`${t.id || idx}_${idx}`} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200">
                            <td className="px-6 py-4">{getBrandBadge(t.brand || profile?.brand)}</td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">{new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                                    <span className="font-black text-gray-900 dark:text-white font-mono text-xs">{t.refNo}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">{profile?.name || 'Unknown'}</span>
                            </td>
                            <td className={`px-6 py-4 text-right font-black font-mono ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {isPositive ? '+' : '-'}{t.quantity}
                            </td>
                            <td className="px-6 py-4 text-right no-print whitespace-nowrap">
                                <div className="flex justify-end gap-1">
                                    {t.type === 'DISPATCH' && onPrint && (
                                        <button onClick={() => onPrint(t)} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all">
                                            <History className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button onClick={() => onEdit(t)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => onDelete(t.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'PRODUCTION' | 'DISPATCH' | 'SCRAP' | 'QUOTATION' | 'RETURN';
    profiles: Profile[];
    brands: string[];
    onAdd: (tx: any) => void;
    addToast: (msg: string, type: ToastMessage['type']) => void;
    customers?: Customer[];
    filterType?: string | null;
    initialProfileId?: string | null;
    initialBrand?: string | null;
    onAddNewProfile?: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ 
    isOpen, 
    onClose, 
    type, 
    profiles, 
    brands, 
    onAdd, 
    addToast, 
    customers, 
    filterType, 
    initialProfileId, 
    initialBrand, 
    onAddNewProfile 
}) => {
    const [form, setForm] = useState({ profileId: '', quantity: '', uom: 'Pcs', refNo: '', date: new Date().toISOString().split('T')[0], customer: '', customerAddress: '', customerGST: '', customerPhone: '', machine: '', die: '', brand: '' });
    const [modalBrandFilter, setModalBrandFilter] = useState('All');
    const [customerSearch, setCustomerSearch] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    const filteredProfiles = useMemo(() => {
        let base = profiles;
        if (filterType) {
            base = base.filter((p: any) => p.profileType === filterType);
        }
        return modalBrandFilter === 'All' ? base : base.filter((p: any) => p.brand === modalBrandFilter || p.id === form.profileId);
    }, [profiles, modalBrandFilter, filterType, form.profileId]);
    
    useEffect(() => { 
        if(isOpen) {
            setModalBrandFilter(initialBrand || 'All');
            setForm({ 
                profileId: initialProfileId || '', 
                quantity: '', 
                uom: 'Pcs', 
                refNo: '', 
                date: new Date().toISOString().split('T')[0], 
                customer: '', 
                customerAddress: '', 
                customerGST: '', 
                customerPhone: '', 
                machine: '', 
                die: '',
                brand: initialBrand || ''
            }); 
        }
    }, [isOpen, initialProfileId, initialBrand]);

    if(!isOpen) return null;

    const filteredCustomers = (customers || []).filter((c:any) => c.name.toLowerCase().includes(customerSearch.toLowerCase()) && !c.deletedAt);

    const selectCustomer = (c: any) => { 
        setForm(prev => ({ 
            ...prev, 
            customer: c.name, 
            customerAddress: c.address || '', 
            customerGST: c.gstin || '', 
            customerPhone: c.phone || '',
            invoiceDetails: {
                ...(prev as any).invoiceDetails,
                placeOfSupply: c.state || '',
                state: c.stateCode || ''
            }
        })); 
        setCustomerSearch(c.name); 
        setShowSuggestions(false); 
    };

    const handleSubmit = (e: React.FormEvent) => { 
        e.preventDefault(); 
        if (!form.profileId) { addToast('Select a profile', 'error'); return; } 
        onAdd({ ...form, quantity: parseFloat(form.quantity), type }); 
        onClose(); 
    };

    const inputClass = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded-md text-sm dark:text-white outline-none focus:ring-1 focus:ring-blue-500";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[160] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 bg-gray-900 text-white flex justify-between items-center">
                    <h2 className="text-xl font-bold uppercase">{type} Entry</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[80vh]">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Date</label>
                            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className={inputClass} required />
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border dark:border-gray-700 space-y-3">
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Brand</label>
                                    <select value={form.brand || modalBrandFilter} onChange={(e) => {
                                        setModalBrandFilter(e.target.value);
                                        setForm({...form, brand: e.target.value === 'All' ? '' : e.target.value});
                                    }} className={inputClass}>
                                        <option value="All">All Brands</option>
                                        {brands.map((b:any) => <option key={b.id || b} value={b.name || b}>{b.name || b}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Profile</label>
                                    <select value={form.profileId} onChange={e => {
                                        const p = profiles.find((x:any) => x.id === e.target.value);
                                        setForm({...form, profileId: e.target.value, brand: p?.brand || form.brand});
                                    }} className={inputClass} required>
                                        <option value="">-- Choose Profile --</option>
                                        {filteredProfiles.map((p:any) => <option key={p.id} value={p.id}>{p.name} ({p.sku}){p.size ? ` [${p.size}]` : ''}{p.color ? ` - ${p.color}` : ''}{p.brand ? ` - ${p.brand}` : ''}</option>)}
                                    </select>
                                </div>
                                {onAddNewProfile && (
                                    <button 
                                        type="button" 
                                        onClick={onAddNewProfile} 
                                        className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center h-[38px]"
                                        title="Add New Profile"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            {form.profileId && (() => {
                                const selectedProfile = profiles.find((x:any) => x.id === form.profileId);
                                if (!selectedProfile) return null;
                                return (
                                    <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/50 flex justify-between items-center font-semibold">
                                        <span>Opening Balance: <strong>{Number(selectedProfile.openingStock || (selectedProfile as any).initialStock || 0).toLocaleString()} {selectedProfile.uom || 'Pcs'}</strong></span>
                                        {selectedProfile.price && <span>Rate: <strong>₹{Number(selectedProfile.price).toFixed(2)}</strong></span>}
                                    </div>
                                );
                            })()}
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Ref No</label>
                            <input value={form.refNo} onChange={e => setForm({...form, refNo: e.target.value})} className={inputClass} required />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Quantity</label>
                            <input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className={inputClass} required />
                        </div>
                        {(type === 'PRODUCTION' || type === 'SCRAP') && (
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Machine (Optional)</label>
                                    <input value={form.machine} onChange={e => setForm({...form, machine: e.target.value})} className={inputClass} placeholder="e.g. M1" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Die No (Optional)</label>
                                    <input value={form.die} onChange={e => setForm({...form, die: e.target.value})} className={inputClass} placeholder="e.g. D10" />
                                </div>
                            </div>
                        )}
                        {type === 'DISPATCH' && (
                            <div className="relative">
                                <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Customer</label>
                                <input 
                                    value={form.customer} 
                                    onChange={e => { setForm({...form, customer: e.target.value}); setCustomerSearch(e.target.value); setShowSuggestions(true); }} 
                                    className={inputClass} 
                                    required 
                                    placeholder="Search customer..." 
                                />
                                {showSuggestions && customerSearch && filteredCustomers.length > 0 && (
                                    <div className="absolute z-20 w-full bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto mt-1">
                                        {filteredCustomers.map((c:any) => (
                                            <div key={c.id} onClick={() => selectCustomer(c)} className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm font-bold border-b last:border-0 dark:border-gray-600">
                                                {c.name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex justify-end gap-2 pt-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded font-bold shadow hover:bg-blue-700 uppercase text-xs">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export const EditTransactionModal = ({ isOpen, onClose, transaction, onUpdate }) => {
    const [form, setForm] = useState({ quantity: '', refNo: '', date: '' });

    useEffect(() => {
        if (transaction) {
            setForm({
                quantity: transaction.quantity.toString(),
                refNo: transaction.refNo || '',
                date: transaction.date ? new Date(transaction.date).toISOString().split('T')[0] : ''
            });
        }
    }, [transaction]);

    if (!isOpen || !transaction) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdate({
            ...transaction,
            ...form,
            quantity: parseFloat(form.quantity)
        });
        onClose();
    };

    const inputClass = "w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 rounded-md text-sm dark:text-white outline-none focus:ring-1 focus:ring-blue-500";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[160] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 bg-gray-900 text-white flex justify-between items-center">
                    <h2 className="text-xl font-bold uppercase">Edit {transaction.type}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                <div className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Date</label>
                            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className={inputClass} required />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Ref No</label>
                            <input value={form.refNo} onChange={e => setForm({...form, refNo: e.target.value})} className={inputClass} required />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Quantity</label>
                            <input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className={inputClass} required />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded font-bold shadow hover:bg-blue-700 uppercase text-xs">Update</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
