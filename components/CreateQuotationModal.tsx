import React, { useState, useEffect, useMemo } from 'react';
import type { Profile, ProfileTransaction, InvoiceDetails, Customer, ToastMessage, CompanySettings } from '../types';
import { TrashIcon, PencilIcon } from './Icon';
import { createPortal } from 'react-dom';

interface CreateQuotationModalProps {
    isOpen: boolean;
    onClose: () => void;
    profiles: Profile[];
    customers: Customer[];
    onAddMultiple: (txs: Omit<ProfileTransaction, 'id' | 'createdAt'>[]) => void;
    addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'deletedAt'>) => void;
    addToast: (message: string, type: ToastMessage['type']) => void;
    existingTransactions?: ProfileTransaction[];
    brands: string[];
    addBrand: (brand: string) => void;
    deleteBrand: (brand: string) => void;
    companySettings: CompanySettings;
}

interface QuotationItem {
    id: number;
    profileId: string;
    description: string; 
    hsnCode: string;
    profileCode: string; 
    packets: number;
    lengthsPerPacket: number;
    quantity: number; 
    weight: number; 
    price: number;
    amount: number;
    brand?: string; 
}

const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return createPortal(children, document.body);
};

const CreateQuotationModal: React.FC<CreateQuotationModalProps> = ({ isOpen, onClose, profiles, customers, onAddMultiple, addCustomer, addToast, existingTransactions, brands, addBrand, deleteBrand, companySettings }) => {
    const [invoiceData, setInvoiceData] = useState<InvoiceDetails>({
        category: 'Tax Invoice', reverseCharge: 'No', documentType: 'Tax Invoice', documentNo: '',
        documentDate: new Date().toISOString().split('T')[0], legalName: '', address1: '', address2: '', location: '', pincode: '', phone: '',
        gstin: '', state: companySettings.state || 'Telangana', email: '', placeOfSupply: companySettings.state || 'Telangana', igstOnIntra: 'No', transactionType: 'Regular',
        totalTaxable: 0, igstValue: 0, sgstValue: 0, cgstValue: 0, cessAdvolValue: 0, cessNonAdValue: 0, stateCessValue: 0, totalAmount: 0
    });

    const [items, setItems] = useState<QuotationItem[]>([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [brandFilter, setBrandFilter] = useState('All');
    const [isLocalManageBrandsOpen, setIsLocalManageBrandsOpen] = useState(false);

    const availableBrands = useMemo(() => ['All', ...brands], [brands]);

    const filteredProfiles = useMemo(() => {
        if (brandFilter === 'All') return profiles;
        return profiles.filter(p => p.brand === brandFilter);
    }, [profiles, brandFilter]);

    useEffect(() => {
        if (isOpen) {
            // If existing transactions have a brand, set it as default filter
            if (existingTransactions && existingTransactions.length > 0) {
                const first = existingTransactions[0];
                const p = profiles.find(prof => prof.id === first.profileId);
                if (first.brand || p?.brand) {
                    setBrandFilter(first.brand || p?.brand || 'All');
                }
            } else {
                setBrandFilter('All');
            }

            if (existingTransactions && existingTransactions.length > 0) {
                const first = existingTransactions[0];
                if (first.invoiceDetails) {
                    setInvoiceData(first.invoiceDetails);
                    setCustomerSearch(first.invoiceDetails.legalName);
                } else {
                    setInvoiceData(prev => ({ ...prev, documentNo: first.refNo, legalName: first.customer || '', documentDate: (first.date || '').split('T')[0] }));
                    setCustomerSearch(first.customer || '');
                }
                const mappedItems = existingTransactions.map((tx, idx) => {
                    const p = profiles.find(prof => prof.id === tx.profileId);
                    return {
                        id: Date.now() + idx, profileId: tx.profileId, description: tx.profileNameOverride || p?.name || 'Unknown',
                        hsnCode: tx.hsnCode || p?.hsnCode || '39252000', profileCode: tx.profileSkuOverride || p?.sku || '',
                        packets: Number(tx.packets || Math.ceil(tx.quantity / (tx.piecesPerPacket || p?.piecesPerPacket || 1))),
                        lengthsPerPacket: Number(tx.piecesPerPacket || p?.piecesPerPacket || 1), quantity: Number(tx.quantity || 0),
                        weight: Number(tx.weight || p?.weight || 0), price: Number(tx.unitPrice || p?.price || 0),
                        amount: Number(tx.quantity || 0) * Number(tx.unitPrice || p?.price || 0), brand: tx.brand || p?.brand
                    };
                });
                setItems(mappedItems);
            } else {
                setInvoiceData(prev => ({ ...prev, documentNo: `QT-${Date.now().toString().slice(-6)}`, documentDate: new Date().toISOString().split('T')[0], legalName: '', address1: '', gstin: '', phone: '', totalTaxable: 0, igstValue: 0, sgstValue: 0, cgstValue: 0, totalAmount: 0 }));
                setItems([]); setCustomerSearch('');
            }
        }
    }, [isOpen, existingTransactions, profiles]);

    const filteredCustomers = useMemo(() => customerSearch ? customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())) : [], [customers, customerSearch]);

    const handleCustomerSelect = (customer: Customer) => {
        setInvoiceData(prev => ({ 
            ...prev, 
            legalName: customer.name, 
            address1: customer.address || '', 
            gstin: customer.gstin || '', 
            phone: customer.phone || '',
            placeOfSupply: customer.state || prev.placeOfSupply
        }));
        setCustomerSearch(customer.name); setShowSuggestions(false);
    };

    const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target; setInvoiceData(prev => ({ ...prev, [name]: value }));
    };

    const addItem = () => {
        setItems(prev => [...prev, { id: Date.now(), profileId: '', description: '', hsnCode: '39252000', profileCode: '', packets: 0, lengthsPerPacket: 1, quantity: 1, weight: 0, price: 0, amount: 0, brand: brandFilter !== 'All' ? brandFilter : '' }]);
    };

    const updateItem = (id: number, field: keyof QuotationItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                if (field === 'profileId') {
                    const profile = profiles.find(p => p.id === value);
                    updated.description = profile?.name || ''; updated.hsnCode = profile?.hsnCode || '39252000'; updated.profileCode = profile?.sku || '';
                    updated.lengthsPerPacket = Number(profile?.piecesPerPacket || 1); updated.weight = Number(profile?.weight || 0); updated.price = Number(profile?.price || 0);
                    updated.brand = profile?.brand || ''; updated.quantity = (Number(updated.packets) || 0) * (Number(updated.lengthsPerPacket) || 1) || updated.quantity;
                }
                if (field === 'packets' || field === 'lengthsPerPacket') updated.quantity = (Number(updated.packets) || 0) * (Number(updated.lengthsPerPacket) || 0);
                if (field === 'quantity') updated.packets = Math.ceil((Number(updated.quantity) || 0) / (Number(updated.lengthsPerPacket) || 1));
                updated.amount = (Number(updated.quantity) || 0) * (Number(updated.price) || 0);
                return updated;
            }
            return item;
        }));
    };

    const removeItem = (id: number) => setItems(prev => prev.filter(item => item.id !== id));
    const clearAllItems = () => setItems([]);

    useEffect(() => {
        const totalTaxable = items.reduce((sum, item) => sum + item.amount, 0);
        const taxRate = 0.18; let igst = 0, cgst = 0, sgst = 0;
        
        const companyState = (companySettings.state || 'Telangana').toLowerCase();
        const supplyState = invoiceData.placeOfSupply.toLowerCase();
        
        if (supplyState !== companyState) igst = totalTaxable * taxRate;
        else { cgst = totalTaxable * (taxRate / 2); sgst = totalTaxable * (taxRate / 2); }
        
        setInvoiceData(prev => ({ ...prev, totalTaxable, igstValue: parseFloat(igst.toFixed(2)), cgstValue: parseFloat(cgst.toFixed(2)), sgstValue: parseFloat(sgst.toFixed(2)), totalAmount: Math.round(totalTaxable + igst + cgst + sgst) }));
    }, [items, invoiceData.placeOfSupply, companySettings.state]);

    const handleSave = () => {
        const customerName = invoiceData.legalName.trim();
        if (!customerName || items.length === 0) { addToast('Name and items are required.', 'error'); return; }
        const existingCustomer = customers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
        if (!existingCustomer) { addCustomer({ name: customerName, address: invoiceData.address1, gstin: invoiceData.gstin, phone: invoiceData.phone }); addToast(`Customer "${customerName}" saved.`, 'info'); }
        const transactions: Omit<ProfileTransaction, 'id' | 'createdAt'>[] = items.map(item => ({
            profileId: item.profileId, type: 'QUOTATION', quantity: Number(item.quantity), uom: 'Pcs', date: new Date(invoiceData.documentDate).toISOString(), refNo: invoiceData.documentNo,
            status: 'PENDING', customer: customerName, customerAddress: invoiceData.address1, customerGST: invoiceData.gstin, customerPhone: invoiceData.phone,
            unitPrice: Number(item.price), hsnCode: item.hsnCode, weight: Number(item.weight), piecesPerPacket: Number(item.lengthsPerPacket), packets: Number(item.packets),
            profileNameOverride: item.description, profileSkuOverride: item.profileCode, brand: item.brand, invoiceDetails: invoiceData
        }));
        onAddMultiple(transactions); addToast('Quotation saved.', 'success'); onClose();
    };

    if (!isOpen) return null;
    const labelStyle = "block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1";
    const inputStyle = "w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all";
    const sectionHeaderStyle = "font-black text-white px-4 py-2 bg-[#4A5E80] text-[10px] uppercase tracking-widest";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex justify-center items-center p-2" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col md:flex-row h-1/3">
                    <div className="w-full md:w-1/4 border-r dark:border-gray-700 flex flex-col">
                        <div className={sectionHeaderStyle}>Document Info</div>
                        <div className="p-4 space-y-3 bg-gray-50 dark:bg-gray-900/50 h-full overflow-y-auto">
                            <div><label className={labelStyle}>Category</label><select name="category" value={invoiceData.category} onChange={handleHeaderChange} className={inputStyle}><option className="bg-white dark:bg-gray-800">Tax Invoice</option><option className="bg-white dark:bg-gray-800">Proforma Invoice</option></select></div>
                            <div><label className={labelStyle}>Ref No.</label><input name="documentNo" value={invoiceData.documentNo} onChange={handleHeaderChange} className={`${inputStyle} font-mono`} /></div>
                            <div><label className={labelStyle}>Date</label><input type="date" name="documentDate" value={invoiceData.documentDate} onChange={handleHeaderChange} className={inputStyle} /></div>
                            <div>
                                <label className={labelStyle}>Select Brand (Project Filter)</label>
                                <select 
                                    value={brandFilter} 
                                    onChange={(e) => setBrandFilter(e.target.value)} 
                                    className={`${inputStyle} border-blue-500 font-black text-blue-600`}
                                >
                                    {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="w-full md:w-1/2 border-r dark:border-gray-700 flex flex-col">
                        <div className={sectionHeaderStyle}>Billing Details</div>
                        <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3 bg-gray-50 dark:bg-gray-900/50 h-full overflow-y-auto">
                            <div className="relative col-span-2">
                                <label className={labelStyle}>Customer Name (Auto-saves new)</label>
                                <input value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setInvoiceData(prev => ({ ...prev, legalName: e.target.value })); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} className={inputStyle} placeholder="Search or type new..." />
                                {showSuggestions && customerSearch && filteredCustomers.length > 0 && (
                                    <div className="absolute gap-2 z-50 w-full bg-white dark:bg-gray-800 border dark:border-gray-600 shadow-2xl rounded-md mt-1 max-h-48 overflow-y-auto ring-1 ring-black ring-opacity-5">
                                        {filteredCustomers.map(c => (
                                            <div key={c.id} className="px-4 py-3 hover:bg-blue-600 hover:text-white cursor-pointer text-sm font-bold border-b last:border-0 dark:border-gray-700 transition-colors" onClick={() => handleCustomerSelect(c)}>
                                                <div className="flex justify-between"><span>{c.name}</span><span className="text-[10px] opacity-70">{c.gstin || 'No GST'}</span></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div><label className={labelStyle}>GSTIN</label><input name="gstin" value={invoiceData.gstin} onChange={handleHeaderChange} className={`${inputStyle} font-mono uppercase`} /></div>
                            <div><label className={labelStyle}>Phone No.</label><input name="phone" value={invoiceData.phone} onChange={handleHeaderChange} className={inputStyle} /></div>
                            <div className="col-span-2"><label className={labelStyle}>Address</label><input name="address1" value={invoiceData.address1} onChange={handleHeaderChange} className={inputStyle} /></div>
                        </div>
                    </div>
                    <div className="w-full md:w-1/4 flex flex-col">
                        <div className={sectionHeaderStyle}>Transaction Settings</div>
                        <div className="p-4 space-y-3 bg-gray-50 dark:bg-gray-900/50 h-full">
                            <div><label className={labelStyle}>Transaction Type</label><select name="transactionType" value={invoiceData.transactionType} onChange={handleHeaderChange} className={inputStyle}><option className="bg-white dark:bg-gray-800">Regular</option><option className="bg-white dark:bg-gray-800">Bill To - Ship To</option></select></div>
                            <div><label className={labelStyle}>Place of Supply</label><input name="placeOfSupply" value={invoiceData.placeOfSupply} onChange={handleHeaderChange} className={inputStyle} /></div>
                        </div>
                    </div>
                </div>

                <div className="bg-[#2D89C8] text-white px-4 py-2 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <div className="flex items-center gap-4">
                        <span>Items Breakdown {brandFilter !== 'All' && <span className="ml-2 bg-white/20 px-2 py-0.5 rounded text-white italic">Filter: {brandFilter}</span>}</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={addItem} className="bg-white text-blue-700 px-4 py-1 rounded hover:bg-gray-100 font-black shadow-sm transition-colors uppercase text-[9px]">+ Add Item</button>
                        <button onClick={clearAllItems} className="bg-white text-red-500 px-4 py-1 rounded hover:bg-gray-100 font-black shadow-sm transition-colors uppercase text-[9px]">Clear</button>
                    </div>
                </div>

                <div className="flex-grow overflow-auto bg-white dark:bg-gray-800">
                    <table className="w-full text-[11px] text-left border-collapse">
                        <thead className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 sticky top-0 border-b dark:border-gray-600">
                            <tr>
                                <th className="px-2 py-2 w-8 border-r dark:border-gray-600 text-center font-bold">S.N</th>
                                <th className="px-2 py-2 w-64 border-r dark:border-gray-600 font-bold">Profile Selection</th>
                                <th className="px-2 py-2 w-24 border-r dark:border-gray-600 text-center font-bold">HSN</th>
                                <th className="px-2 py-2 w-24 border-r dark:border-gray-600 text-center font-bold">Code</th>
                                <th className="px-2 py-2 w-16 border-r dark:border-gray-600 text-center font-bold">Pkt</th>
                                <th className="px-2 py-2 w-20 border-r dark:border-gray-600 text-center font-bold">Total L</th>
                                <th className="px-2 py-2 w-20 border-r dark:border-gray-600 text-center font-bold">Wt/m</th>
                                <th className="px-2 py-2 w-24 border-r dark:border-gray-600 text-right font-bold">Rate</th>
                                <th className="px-2 py-2 w-24 border-r dark:border-gray-600 text-right font-bold">Amount</th>
                                <th className="px-2 py-2 w-10 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {items.length === 0 ? (
                                <tr><td colSpan={10} className="text-center py-20 text-gray-400 italic text-sm">Use "+ Add Item" and the brand filter to begin.</td></tr>
                            ) : (
                                items.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 group transition-colors">
                                        <td className="px-2 py-3 text-center border-r dark:border-gray-600 font-mono text-gray-400">{index + 1}</td>
                                        <td className="px-2 py-3 border-r dark:border-gray-600">
                                            <div className="space-y-1">
                                                <select value={item.profileId} onChange={e => updateItem(item.id, 'profileId', e.target.value)} className="w-full border dark:border-gray-600 p-1 rounded bg-white dark:bg-gray-700 text-[11px] font-black text-blue-600 dark:text-blue-400 outline-none">
                                                    <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" value="">Select Profile...</option>
                                                    {filteredProfiles.map(p => <option className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white" key={p.id} value={p.id}>{p.name} ({p.sku}){p.size ? ` [${p.size}]` : ''}{p.color ? ` - ${p.color}` : ''}{p.brand ? ` - ${p.brand}` : ''}</option>)}
                                                </select>
                                                <input placeholder="Manual description override..." value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} className="w-full border border-gray-200 dark:border-gray-600 p-1.5 rounded bg-white dark:bg-gray-800 text-[10px] outline-none dark:text-gray-200" />
                                            </div>
                                        </td>
                                        <td className="px-2 py-3 border-r dark:border-gray-600"><input value={item.hsnCode} onChange={e => updateItem(item.id, 'hsnCode', e.target.value)} className="w-full text-center border p-1 rounded bg-white dark:bg-gray-800 text-[11px] dark:text-gray-200" /></td>
                                        <td className="px-2 py-3 border-r dark:border-gray-600"><input value={item.profileCode} onChange={e => updateItem(item.id, 'profileCode', e.target.value)} className="w-full text-center border p-1 rounded bg-white dark:bg-gray-800 text-[11px] font-mono dark:text-gray-200" /></td>
                                        <td className="px-2 py-3 border-r dark:border-gray-600"><input type="number" value={item.packets} onChange={e => updateItem(item.id, 'packets', e.target.value)} className="w-full text-center border p-1 rounded bg-white dark:bg-gray-800 text-[11px] dark:text-gray-200" /></td>
                                        <td className="px-2 py-3 border-r dark:border-gray-600"><input type="number" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)} className="w-full text-center border p-1 rounded bg-white dark:bg-gray-800 text-[11px] font-black text-gray-900 dark:text-white" /></td>
                                        <td className="px-2 py-3 border-r dark:border-gray-600"><input type="number" value={item.weight} onChange={e => updateItem(item.id, 'weight', e.target.value)} className="w-full text-center border p-1 rounded bg-white dark:bg-gray-800 text-[11px] dark:text-gray-200" /></td>
                                        <td className="px-2 py-3 border-r dark:border-gray-600"><input type="number" value={item.price} onChange={e => updateItem(item.id, 'price', e.target.value)} className="w-full text-right border p-1 rounded bg-white dark:bg-gray-800 text-[11px] font-bold dark:text-gray-200" /></td>
                                        <td className="px-2 py-3 border-r dark:border-gray-600 text-right font-black text-gray-900 dark:text-white">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td className="px-2 py-3 text-center"><button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-4 h-4"/></button></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="bg-gray-100 dark:bg-gray-900/80 p-6 border-t dark:border-gray-700">
                    <div className="grid grid-cols-4 md:grid-cols-8 gap-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        <div><label>Subtotal</label><div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg mt-1 text-gray-900 dark:text-white text-sm border dark:border-gray-700 shadow-sm font-mono">{invoiceData.totalTaxable.toFixed(2)}</div></div>
                        <div><label>IGST</label><div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg mt-1 text-gray-900 dark:text-white text-sm border dark:border-gray-700 shadow-sm font-mono">{invoiceData.igstValue.toFixed(2)}</div></div>
                        <div><label>SGST</label><div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg mt-1 text-gray-900 dark:text-white text-sm border dark:border-gray-700 shadow-sm font-mono">{invoiceData.sgstValue.toFixed(2)}</div></div>
                        <div><label>CGST</label><div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg mt-1 text-gray-900 dark:text-white text-sm border dark:border-gray-700 shadow-sm font-mono">{invoiceData.cgstValue.toFixed(2)}</div></div>
                        <div className="col-span-2 md:col-span-4 text-right flex flex-col justify-end">
                            <label className="text-[11px] font-bold mb-1">Grand Total (INR)</label>
                            <div className="text-4xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">₹ {invoiceData.totalAmount.toLocaleString('en-IN')}</div>
                        </div>
                    </div>
                    <div className="mt-8 flex justify-end gap-3 border-t dark:border-gray-700 pt-6">
                        <button onClick={onClose} className="px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors uppercase tracking-widest text-[10px]">Cancel</button>
                        <button onClick={handleSave} className="px-10 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-black hover:bg-blue-700 shadow-lg transition-all active:scale-95 uppercase tracking-widest text-[10px]">Save Quotation</button>
                    </div>
                </div>
                {isLocalManageBrandsOpen && (<Portal><ManageBrandsSubModal isOpen={isLocalManageBrandsOpen} onClose={() => setIsLocalManageBrandsOpen(false)} brands={brands} addBrand={addBrand} deleteBrand={deleteBrand} addToast={addToast} /></Portal>)}
            </div>
        </div>
    );
};

const ManageBrandsSubModal: React.FC<any> = ({ isOpen, onClose, brands, addBrand, deleteBrand, addToast }) => {
    const [newB, setNewB] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    if (!isOpen) return null;
    const handleAdd = () => { if (newB.trim() && !brands.includes(newB.trim())) { addBrand(newB.trim()); setNewB(''); } else { addToast('Invalid brand.', 'error'); } };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[200] flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg w-full max-w-sm shadow-2xl border dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <h3 className="font-black mb-6 dark:text-white uppercase text-xs tracking-widest text-gray-800">Manage Brands</h3>
                <div className="flex gap-2 mb-6"><input value={newB} onChange={e => setNewB(e.target.value)} className="border border-gray-300 dark:border-gray-600 p-2.5 flex-1 rounded text-sm dark:bg-gray-700 dark:text-white outline-none" placeholder="New Brand..." /><button onClick={handleAdd} className="bg-blue-600 text-white px-5 rounded text-xs font-bold uppercase transition-colors">Add</button></div>
                <div className="max-h-56 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900/30 mb-6">
                    {brands.map((b:string) => (
                        <div key={b} className="flex justify-between items-center p-3.5 border-b border-gray-200 dark:border-gray-700 last:border-0 transition-colors">
                            <span className="text-sm font-bold dark:text-gray-200">{b}</span>
                            {confirmDelete === b ? (
                                <div className="flex gap-2 animate-in fade-in zoom-in duration-200">
                                    <button onClick={() => setConfirmDelete(null)} className="text-[10px] font-black uppercase text-gray-500 hover:text-gray-700">No</button>
                                    <button onClick={() => { deleteBrand(b); setConfirmDelete(null); }} className="text-[10px] font-black uppercase text-red-600 hover:text-red-800">Delete</button>
                                </div>
                            ) : (
                                <button onClick={() => setConfirmDelete(b)} className="text-red-500 hover:bg-red-50 p-1 rounded transition-all"><TrashIcon className="w-3.5 h-3.5"/></button>
                            )}
                        </div>
                    ))}
                </div>
                <button onClick={onClose} className="w-full py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-black rounded uppercase text-xs">Close</button>
            </div>
        </div>
    );
};

export default CreateQuotationModal;