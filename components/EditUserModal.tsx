
import React, { useState, useEffect } from 'react';
import { X, Shield, Check, Lock, Building, Phone, Mail, User as UserIcon, Trash2, KeyRound } from 'lucide-react';
import type { Role, AppUser } from '../types';
import { ALL_SYSTEM_PAGES } from '../store/useStore';

interface EditUserModalProps {
    isOpen: boolean;
    user: AppUser | null;
    onClose: () => void;
    onUpdateUser: (user: AppUser) => void;
    onDeleteUser?: (id: string) => void;
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

export const EditUserModal: React.FC<EditUserModalProps> = ({ 
    isOpen, 
    user, 
    onClose, 
    onUpdateUser,
    onDeleteUser 
}) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<Role>('STORE_MANAGER');
    const [department, setDepartment] = useState('');
    const [phone, setPhone] = useState('');
    const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'INACTIVE'>('ACTIVE');
    const [allowedPages, setAllowedPages] = useState<string[]>([]);
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [canExport, setCanExport] = useState(true);
    const [canDelete, setCanDelete] = useState(false);
    const [canEditPricing, setCanEditPricing] = useState(false);
    const [notes, setNotes] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [tempPin, setTempPin] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setEmail(user.email || '');
            setRole(user.role || 'STORE_MANAGER');
            setDepartment(user.department || '');
            setPhone(user.phone || '');
            setStatus(user.status || 'ACTIVE');
            setAllowedPages(user.allowedPages || ROLE_DEFAULT_PAGES[user.role] || []);
            setTwoFactorEnabled(Boolean(user.twoFactorEnabled));
            setCanExport(user.canExport !== undefined ? user.canExport : true);
            setCanDelete(Boolean(user.canDelete));
            setCanEditPricing(Boolean(user.canEditPricing));
            setNotes(user.notes || '');
            setShowDeleteConfirm(false);
            setTempPin(null);
        }
    }, [user]);

    if (!isOpen || !user) return null;

    const handleRoleChange = (newRole: Role) => {
        setRole(newRole);
    };

    const applyRoleDefaults = () => {
        setAllowedPages(ROLE_DEFAULT_PAGES[role] || []);
    };

    const togglePage = (page: string) => {
        setAllowedPages(prev => 
            prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page]
        );
    };

    const handleGenerateTempPin = () => {
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        setTempPin(pin);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdateUser({
            ...user,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role,
            department: department.trim() || 'Operations',
            phone: phone.trim(),
            status,
            allowedPages,
            twoFactorEnabled,
            canExport,
            canDelete,
            canEditPricing,
            notes: notes.trim(),
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-base shadow-md">
                            {user.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-display font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                    Edit User Profile
                                </h2>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                    status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-600' :
                                    status === 'SUSPENDED' ? 'bg-red-500/15 text-red-600' : 'bg-slate-500/15 text-slate-500'
                                }`}>
                                    {status}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                User ID: <span className="font-mono">{user.id}</span> &bull; Created {new Date(user.createdAt).toLocaleDateString()}
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
                    {/* Basic Identity */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">User Identity & Contact</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <UserIcon size={12} /> Full Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <Mail size={12} /> Email Address
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <Building size={12} /> Department / Section
                                </label>
                                <input
                                    type="text"
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
                                    <option value="ADMIN">ADMIN (Full Control)</option>
                                    <option value="STORE_MANAGER">STORE_MANAGER (Raw Material & Store)</option>
                                    <option value="PURCHASE">PURCHASE (Orders & Procurement)</option>
                                    <option value="SALES">SALES (Quotations & Dispatches)</option>
                                    <option value="MANAGEMENT">MANAGEMENT (Production Planning)</option>
                                    <option value="SECURITY">SECURITY (Gate Verification)</option>
                                    <option value="VIEWER">VIEWER (Read-Only)</option>
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
                                    <option value="INACTIVE">INACTIVE (Deactivated)</option>
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

                    {/* Temporary Access PIN Generator */}
                    <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40 rounded-2xl flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <KeyRound size={14} className="text-blue-600" /> One-Time Access PIN / Password Reset
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                                Generate temporary 6-digit access code for user verification
                            </p>
                        </div>
                        {tempPin ? (
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1.5 bg-blue-600 text-white font-mono font-bold text-sm tracking-widest rounded-xl">
                                    {tempPin}
                                </span>
                                <span className="text-[10px] text-emerald-600 font-bold">Generated!</span>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={handleGenerateTempPin}
                                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                            >
                                Generate PIN
                            </button>
                        )}
                    </div>

                    {/* Module Permissions */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Allowed ERP Modules</h3>
                                <p className="text-[10px] text-slate-500 font-medium">Granular page-level access matrix for this user</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={applyRoleDefaults}
                                    className="text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    Apply {role} Defaults
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                    type="button"
                                    onClick={() => setAllowedPages([...ALL_SYSTEM_PAGES])}
                                    className="text-[9px] font-black uppercase tracking-wider text-slate-600 hover:underline"
                                >
                                    All
                                </button>
                                <span className="text-slate-300">|</span>
                                <button
                                    type="button"
                                    onClick={() => setAllowedPages([])}
                                    className="text-[9px] font-black uppercase tracking-wider text-slate-400 hover:underline"
                                >
                                    None
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

                    {/* Operational Notes */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Internal Operational Notes</label>
                        <textarea
                            rows={2}
                            placeholder="Add notes about this user..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    {/* Danger Zone: Delete User */}
                    {onDeleteUser && (
                        <div className="p-4 bg-red-50/50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 rounded-2xl">
                            {showDeleteConfirm ? (
                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-red-700 dark:text-red-400">
                                        Are you sure you want to permanently delete {user.name}&apos;s account?
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onDeleteUser(user.id)}
                                            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors"
                                        >
                                            Confirm Delete
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowDeleteConfirm(false)}
                                            className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Remove Account</p>
                                        <p className="text-[10px] text-slate-500">Deletes user identity and revokes access completely.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100/50 rounded-xl border border-red-200 dark:border-red-900 transition-colors flex items-center gap-1.5"
                                    >
                                        <Trash2 size={13} /> Delete User
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

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
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditUserModal;

