
import React, { useState } from 'react';
import { X, UserPlus, Shield, Check, Lock, Building, Phone, Mail, User as UserIcon } from 'lucide-react';
import type { Role, AppUser } from '../types';
import { ALL_SYSTEM_PAGES } from '../store/useStore';

interface CreateUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddUser: (user: Omit<AppUser, 'id' | 'createdAt'>) => void;
}

const ROLE_DEFAULT_PAGES: Record<Role, string[]> = {
    ADMIN: [...ALL_SYSTEM_PAGES],
    STORE_MANAGER: ['Dashboard', 'Store Management', 'Profiles & Stock', 'Protective Films', 'Reports & History', 'Import Excel'],
    PURCHASE: ['Dashboard', 'Store Management', 'Quotations & Sales', 'Reports & History'],
    SALES: ['Dashboard', 'Profiles & Stock', 'Quotations & Sales', 'Shipments', 'Reports & History'],
    MANAGEMENT: ['Dashboard', 'Profiles & Stock', 'Dies & Planning', 'Production', 'Protective Films', 'Reports & History', 'Quotations & Sales'],
    SECURITY: ['Dashboard', 'Reports & History'],
    VIEWER: ['Dashboard', 'Reports & History', 'Profiles & Stock', 'Store Management']
};

export const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onAddUser }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<Role>('STORE_MANAGER');
    const [department, setDepartment] = useState('Store & Warehouse');
    const [phone, setPhone] = useState('');
    const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'INACTIVE'>('ACTIVE');
    const [allowedPages, setAllowedPages] = useState<string[]>(ROLE_DEFAULT_PAGES.STORE_MANAGER);
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [canExport, setCanExport] = useState(true);
    const [canDelete, setCanDelete] = useState(false);
    const [canEditPricing, setCanEditPricing] = useState(false);
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleRoleChange = (newRole: Role) => {
        setRole(newRole);
        setAllowedPages(ROLE_DEFAULT_PAGES[newRole] || []);
        if (newRole === 'ADMIN') {
            setCanDelete(true);
            setCanEditPricing(true);
            setTwoFactorEnabled(true);
        }
    };

    const togglePage = (page: string) => {
        setAllowedPages(prev => 
            prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page]
        );
    };

    const handleSelectAllPages = () => {
        setAllowedPages([...ALL_SYSTEM_PAGES]);
    };

    const handleClearAllPages = () => {
        setAllowedPages([]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Full Name is required');
            return;
        }
        if (!email.trim() || !email.includes('@')) {
            setError('Please provide a valid company or personal email');
            return;
        }

        onAddUser({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role,
            department: department.trim() || 'General Operations',
            phone: phone.trim(),
            status,
            allowedPages,
            twoFactorEnabled,
            canExport,
            canDelete,
            canEditPricing,
            notes: notes.trim(),
            lastLogin: undefined,
        });

        // Reset form
        setName('');
        setEmail('');
        setPhone('');
        setNotes('');
        setError('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600/10 text-blue-600 rounded-2xl">
                            <UserPlus size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-display font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                Add New Team User
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Set up identity, operational role, and module authorization
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-200">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-bold rounded-xl">
                            {error}
                        </div>
                    )}

                    {/* Basic Identity */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">User Identity & Contact</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <UserIcon size={12} /> Full Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Ramesh Varma"
                                    value={name}
                                    onChange={e => { setName(e.target.value); setError(''); }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <Mail size={12} /> Email Address *
                                </label>
                                <input
                                    type="email"
                                    required
                                    placeholder="user@upvc.com"
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); setError(''); }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <Building size={12} /> Department / Plant Section
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Raw Material Store"
                                    value={department}
                                    onChange={e => setDepartment(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <Phone size={12} /> Phone Number
                                </label>
                                <input
                                    type="text"
                                    placeholder="+91 98480 12345"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Role & Status */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Role & Security Policy</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <Shield size={12} /> Assigned Role
                                </label>
                                <select
                                    value={role}
                                    onChange={e => handleRoleChange(e.target.value as Role)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                                >
                                    <option value="ADMIN">ADMIN (Full Plant & Master Control)</option>
                                    <option value="STORE_MANAGER">STORE_MANAGER (Raw Material & Inventory)</option>
                                    <option value="PURCHASE">PURCHASE (Procurement & Purchase Orders)</option>
                                    <option value="SALES">SALES (Quotations, Dispatches & Clients)</option>
                                    <option value="MANAGEMENT">MANAGEMENT (Production Planning & Dies)</option>
                                    <option value="SECURITY">SECURITY (Gate Inward & Security Verification)</option>
                                    <option value="VIEWER">VIEWER (Auditor & Read-Only Access)</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Account Status</label>
                                <select
                                    value={status}
                                    onChange={e => setStatus(e.target.value as any)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                                >
                                    <option value="ACTIVE">ACTIVE (Authorized to Login)</option>
                                    <option value="SUSPENDED">SUSPENDED (Temporarily Blocked)</option>
                                    <option value="INACTIVE">INACTIVE (Offboarded)</option>
                                </select>
                            </div>
                        </div>

                        {/* Special Privilege Toggles */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={twoFactorEnabled}
                                    onChange={e => setTwoFactorEnabled(e.target.checked)}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-[11px] font-bold">Require 2FA PIN</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={canExport}
                                    onChange={e => setCanExport(e.target.checked)}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-[11px] font-bold">Allow Excel Export</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={canEditPricing}
                                    onChange={e => setCanEditPricing(e.target.checked)}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-[11px] font-bold">View / Edit Pricing</span>
                            </label>
                        </div>
                    </div>

                    {/* Module Permissions */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Allowed ERP Modules</h3>
                                <p className="text-[10px] text-slate-500 font-medium">Select pages this team member can access</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleSelectAllPages}
                                    className="text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    Select All
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                    type="button"
                                    onClick={handleClearAllPages}
                                    className="text-[9px] font-black uppercase tracking-wider text-slate-500 hover:underline"
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {ALL_SYSTEM_PAGES.map(page => {
                                const isChecked = allowedPages.includes(page);
                                return (
                                    <button
                                        key={page}
                                        type="button"
                                        onClick={() => togglePage(page)}
                                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                                            isChecked 
                                                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-sm'
                                                : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                                            isChecked ? 'bg-blue-600 text-white' : 'border border-slate-300 dark:border-slate-700'
                                        }`}>
                                            {isChecked && <Check size={10} strokeWidth={3} />}
                                        </div>
                                        <span className="truncate">{page}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Internal Operational Notes</label>
                        <textarea
                            rows={2}
                            placeholder="Optional notes regarding shift, workstation, or permissions..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            Create User Account
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateUserModal;

