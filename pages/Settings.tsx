import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store/useStore';
import type { AppUser, Page, Role, ToastMessage } from '../types';
import { Card } from '../components/Card';
import { Plus, Trash2, Shield, User as UserIcon, Lock, Check, X } from 'lucide-react';

const ALL_PAGES: Page[] = [
    'Dashboard',
    'RM Section',
    'Profiles & Stock',
    'Dies & Planning',
    'Reports & History',
    'Storage',
    'Excel & Sheets',
    'Users',
    'Trash',
    'Import Excel',
    'Settings'
];

interface SettingsProps {
    addToast: (message: string, type: ToastMessage['type']) => void;
}

const Settings = ({ addToast }) => {
    const currentUser = useStore(state => state.currentUser);
    const appUsers = useStore(state => state.appUsers);
    const systemSettings = useStore(state => state.systemSettings);
    const updateSystemSettings = useStore(state => state.updateSystemSettings);
    const addAppUser = useStore(state => state.addAppUser);
    const updateAppUser = useStore(state => state.updateAppUser);
    const deleteAppUser = useStore(state => state.deleteAppUser);

    const [isAdding, setIsAdding] = useState(false);
    const [newUser, setNewUser] = useState<Omit<AppUser, 'id' | 'createdAt'>>({
        email: '',
        name: '',
        role: 'VIEWER',
        allowedPages: ['Dashboard']
    });

    const handleAddUser = () => {
        if (!newUser.email || !newUser.name) {
            addToast('Please fill all fields', 'error');
            return;
        }
        addAppUser(newUser);
        setIsAdding(false);
        setNewUser({
            email: '',
            name: '',
            role: 'VIEWER',
            allowedPages: ['Dashboard']
        });
        addToast('User created successfully', 'success');
    };

    const togglePage = (user: AppUser, page: Page) => {
        const allowedPages = user.allowedPages.includes(page)
            ? user.allowedPages.filter(p => p !== page)
            : [...user.allowedPages, page];
        updateAppUser({ ...user, allowedPages });
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
            <header>
                <h1 className="text-4xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">System Settings</h1>
                <p className="text-slate-500 font-medium mt-1">Manage user access control and advanced system permissions.</p>
            </header>

            {currentUser && (
                <Card className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-none shadow-xl">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            {currentUser.picture ? (
                                <img src={currentUser.picture} className="w-16 h-16 rounded-2xl object-cover ring-4 ring-primary-500/30 shadow-lg" alt="" />
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center text-white font-black text-2xl shadow-lg">
                                    {currentUser.name?.charAt(0) || 'U'}
                                </div>
                            )}
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-display font-black uppercase tracking-tight text-white">{currentUser.name}</h2>
                                    <span className="px-2.5 py-0.5 bg-primary-500/20 text-primary-300 rounded-lg text-[10px] font-black uppercase tracking-widest border border-primary-500/30">
                                        {currentUser.role}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-300 font-medium mt-1 flex items-center gap-1.5">
                                    <span>Gmail / Email:</span> 
                                    <span className="font-bold text-white underline">{currentUser.email || (currentUser.isGuest ? 'Offline Guest User' : 'Not Connected')}</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-right flex-1 md:flex-initial">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Session Status</p>
                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{currentUser.isGuest ? 'Guest Mode' : 'Active & Authenticated'}</p>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-6">
                    <Card className="p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-display font-black uppercase italic text-slate-900 dark:text-white">User Access Matrix</h2>
                                <p className="text-xs text-slate-500 font-medium mt-1">Define granular page-level permissions for team members.</p>
                            </div>
                            <button 
                                onClick={() => setIsAdding(true)}
                                className="bg-primary-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-primary-500/20"
                            >
                                <Plus size={14} /> New User
                            </button>
                        </div>

                        {isAdding && (
                            <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-primary-500/20 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <input 
                                        type="text" 
                                        placeholder="Full Name"
                                        value={newUser.name}
                                        onChange={e => setNewUser({...newUser, name: e.target.value})}
                                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-bold"
                                    />
                                    <input 
                                        type="email" 
                                        placeholder="Email Address"
                                        value={newUser.email}
                                        onChange={e => setNewUser({...newUser, email: e.target.value})}
                                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-bold"
                                    />
                                    <select 
                                        value={newUser.role}
                                        onChange={e => setNewUser({...newUser, role: e.target.value as Role})}
                                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-bold"
                                    >
                                        <option value="ADMIN">ADMIN</option>
                                        <option value="MANAGER">MANAGER</option>
                                        <option value="AGENT">AGENT</option>
                                        <option value="VIEWER">VIEWER</option>
                                    </select>
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-xs font-black uppercase text-slate-500">Cancel</button>
                                    <button onClick={handleAddUser} className="bg-primary-600 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest">Create User Account</button>
                                </div>
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                        <th className="px-4 py-4">User Identity</th>
                                        <th className="px-4 py-4">Role</th>
                                        <th className="px-4 py-4">Allowed Modules</th>
                                        <th className="px-4 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {appUsers.map(user => (
                                        <tr key={user.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                                        <UserIcon size={14} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{user.name}</p>
                                                        <p className="text-[10px] text-slate-500 font-medium">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="px-2 py-1 bg-primary-50 dark:bg-primary-500/10 text-primary-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {ALL_PAGES.map(page => (
                                                        <button 
                                                            key={page}
                                                            onClick={() => togglePage(user, page)}
                                                            className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all ${
                                                                user.allowedPages.includes(page) 
                                                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200'
                                                            }`}
                                                        >
                                                            {page}
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <button 
                                                    onClick={() => deleteAppUser(user.id)}
                                                    className="p-2 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {appUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                                                No users registered yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="p-6 bg-slate-950 dark:bg-slate-900 border-none">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-primary-500/20 rounded-2xl text-primary-400">
                                <Shield size={20} />
                            </div>
                            <h3 className="text-lg font-display font-black text-white uppercase italic tracking-tight">Security Hardening</h3>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                                <div>
                                    <p className="text-xs font-black text-white uppercase tracking-widest">Gmail Access Level</p>
                                    <p className="text-[10px] text-slate-500 font-medium mt-1 italic">Restrict AI context window depth.</p>
                                </div>
                                <div className="flex gap-1">
                                    {(['Basic', 'Deep', 'Full'] as const).map(level => (
                                        <button 
                                            key={level} 
                                            onClick={() => updateSystemSettings({ gmailAccessLevel: level })}
                                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                                                systemSettings.gmailAccessLevel === level 
                                                ? 'bg-primary-500 text-white' 
                                                : 'bg-white/5 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                                <div>
                                    <p className="text-xs font-black text-white uppercase tracking-widest">Hostinger Sync</p>
                                    <p className="text-[10px] text-slate-500 font-medium mt-1 italic">Real-time database mirroring status.</p>
                                </div>
                                <button 
                                    onClick={() => updateSystemSettings({ syncEnabled: !systemSettings.syncEnabled })}
                                    className={`w-12 h-6 rounded-full relative p-1 transition-colors ${systemSettings.syncEnabled ? 'bg-emerald-500/20' : 'bg-slate-700'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full shadow-lg transition-all ${systemSettings.syncEnabled ? 'bg-emerald-500 translate-x-6' : 'bg-slate-400 translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-primary-500/10 rounded-2xl border border-primary-500/20">
                                <Lock className="text-primary-500 flex-shrink-0" size={16} />
                                <p className="text-[10px] font-bold text-primary-500 leading-relaxed uppercase tracking-tight">
                                    System is operating under strict AES-256 cloud encryption protocols.
                                </p>
                             </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
                                <Trash2 size={18} />
                            </div>
                            <h3 className="text-sm font-black text-red-900 dark:text-red-400 uppercase tracking-tighter">Data Management</h3>
                        </div>
                        <p className="text-[10px] text-red-600 dark:text-red-400 font-medium mb-4 leading-relaxed uppercase tracking-tight">
                            Permanently delete all Profile Master data, Reinforcements, and Quotation history to start fresh imports.
                        </p>
                        <button 
                            onClick={() => {
                                if (confirm('Are you absolutely sure? This will wipe ALL profile catalogue, reinforcement data, and quotations. This action cannot be undone.')) {
                                    useStore.getState().resetCatalogueAndQuotations();
                                    addToast('All Profile and Quotation data has been wiped.', 'success');
                                }
                            }}
                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
                        >
                            Wipe Master Catalogue & Quotations
                        </button>
                    </Card>

                    <Card className="p-6 overflow-hidden">
                        <div className="relative">
                            <h3 className="text-lg font-display font-black text-slate-900 dark:text-white uppercase italic tracking-tight mb-4">Hostinger Integration</h3>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Mirror URL</label>
                                    <input 
                                        type="text"
                                        value={systemSettings.hostingerUrl || ''}
                                        onChange={e => updateSystemSettings({ hostingerUrl: e.target.value })}
                                        placeholder="https://your-hostinger-endpoint.com"
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">API Secret Key</label>
                                    <input 
                                        type="password"
                                        value={systemSettings.hostingerApiKey || ''}
                                        onChange={e => updateSystemSettings({ hostingerApiKey: e.target.value })}
                                        placeholder="••••••••••••••••"
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-slate-200"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Settings;
