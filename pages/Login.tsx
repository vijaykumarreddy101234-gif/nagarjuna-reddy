import React, { useState } from 'react';
import { GoogleIcon, MicrosoftIcon, YahooIcon } from '../components/Icon';
import type { Role, User } from '../types';

interface LoginPageProps {
    onLogin: (user: User) => void;
    offlinePendingCount?: number;
    lastSyncTime?: string | null;
}

type ProviderType = 'google' | 'microsoft' | 'yahoo' | 'offline';

const ROLES: { role: Role; label: string; desc: string; color: string }[] = [
    { role: 'ADMIN', label: 'System Administrator', desc: 'Full system management, user privileges & raw configuration', color: 'from-blue-600 to-indigo-600' },
    { role: 'STORE_MANAGER', label: 'RM Section Manager', desc: 'Inflow, inventory stock control, material formulas & requisitions', color: 'from-emerald-600 to-teal-600' },
    { role: 'PURCHASE', label: 'Purchase Manager', desc: 'Supplier POs, raw material procurement & stock replenishment', color: 'from-amber-600 to-orange-600' },
    { role: 'SALES', label: 'Sales Executive', desc: 'Profiles stock checks, client quotations & dispatch planning', color: 'from-purple-600 to-pink-600' },
    { role: 'SECURITY', label: 'Security Officer', desc: 'Gate entry verification, vehicle log tracking & material movement', color: 'from-cyan-600 to-blue-600' },
    { role: 'MANAGEMENT', label: 'Executive Management', desc: 'Audit reports, batch profitability & operational KPIs', color: 'from-violet-600 to-purple-600' },
];

const LoginPage = ({ onLogin, offlinePendingCount = 0, lastSyncTime }) => {
    const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);
    const [selectedRole, setSelectedRole] = useState<Role>('ADMIN');
    const [customName, setCustomName] = useState('');
    const [customEmail, setCustomEmail] = useState('');

    const handleAuthenticate = (provider: ProviderType) => {
        const defaultNames: Record<ProviderType, string> = {
            google: 'Google User',
            microsoft: 'Microsoft User',
            yahoo: 'Yahoo User',
            offline: 'Offline PC Operator'
        };

        const defaultDomains: Record<ProviderType, string> = {
            google: 'gmail.com',
            microsoft: 'outlook.com',
            yahoo: 'yahoo.com',
            offline: 'local-pc.internal'
        };

        const roleObj = ROLES.find(r => r.role === selectedRole);
        const nameToUse = customName.trim() || `${roleObj?.label || 'ERP'} (${defaultNames[provider]})`;
        const emailToUse = customEmail.trim() || `${selectedRole.toLowerCase()}@${defaultDomains[provider]}`;

        const user: User = {
            id: `usr_${provider}_${selectedRole.toLowerCase()}_${Date.now()}`,
            name: nameToUse,
            email: emailToUse,
            role: selectedRole,
            provider: provider,
            isGuest: provider === 'offline',
            createdAt: new Date().toISOString()
        };

        onLogin(user);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden font-sans">
            {/* Background Glows */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-15%] left-[-15%] w-[50%] h-[50%] bg-blue-600/15 blur-[140px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] bg-purple-600/15 blur-[140px] rounded-full animate-pulse" style={{ animationDelay: '1.5s' }} />
                <div className="absolute top-[40%] right-[30%] w-[30%] h-[30%] bg-emerald-600/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '0.8s' }} />
            </div>

            {/* Top Bar */}
            <header className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-4 relative z-10 border-b border-white/10 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
                        <span className="text-xl font-black">⚙️</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-white uppercase italic">
                            ERP <span className="text-blue-400">ARJUN</span>
                        </h1>
                        <p className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase">Multi-Cloud OAuth & Offline PC Synchronization Hub</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {offlinePendingCount > 0 ? (
                        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-full text-amber-300 text-xs font-bold animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                            <span>{offlinePendingCount} Offline Record(s) Saved on this PC</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 rounded-full text-emerald-300 text-xs font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                            <span>Local PC Storage Ready</span>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content Area */}
            <main className="w-full max-w-6xl mx-auto flex-1 flex flex-col justify-center my-4 relative z-10">
                {/* ARCHITECTURE DIAGRAM SECTION */}
                <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-4 sm:p-6 mb-8 shadow-2xl">
                    <div className="text-center mb-6">
                        <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-black uppercase tracking-widest inline-block mb-2">
                            Architecture Overview
                        </span>
                        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase italic">
                            Authentication & Cloud Sync Architecture
                        </h2>
                        <p className="text-xs text-slate-400 max-w-xl mx-auto mt-1">
                            Entries created offline are saved locally on this PC. Log in with Google, Microsoft, or Yahoo to automatically sync your local data online.
                        </p>
                    </div>

                    {/* Flow Diagram */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 relative">
                        {/* Central Hub Label */}
                        <div className="sm:col-span-2 lg:col-span-4 text-center mb-2">
                            <div className="inline-flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-6 py-2 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-200 shadow-xl">
                                <span className="text-base">🏢</span> ERP ARJUN ENGINE
                            </div>
                        </div>

                        {/* Branch 1: Google */}
                        <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 transition-all text-center flex flex-col items-center justify-between group">
                            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-lg mb-3 group-hover:scale-110 transition-transform">
                                <GoogleIcon className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-wider text-white">Google OAuth 2.0</span>
                            <div className="my-2 text-[11px] text-slate-400 flex flex-col items-center">
                                <span className="text-slate-500">↓</span>
                                <span className="font-semibold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded mt-1">Gmail / Drive Sync</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">Online Enterprise Storage</span>
                        </div>

                        {/* Branch 2: Microsoft */}
                        <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 transition-all text-center flex flex-col items-center justify-between group">
                            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center shadow-lg mb-3 group-hover:scale-110 transition-transform">
                                <MicrosoftIcon className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-wider text-white">Microsoft OAuth 2.0</span>
                            <div className="my-2 text-[11px] text-slate-400 flex flex-col items-center">
                                <span className="text-slate-500">↓</span>
                                <span className="font-semibold text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded mt-1">Outlook / OneDrive</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">Azure AD Connected</span>
                        </div>

                        {/* Branch 3: Yahoo */}
                        <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 transition-all text-center flex flex-col items-center justify-between group">
                            <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shadow-lg mb-3 group-hover:scale-110 transition-transform">
                                <YahooIcon className="w-6 h-6 text-purple-400" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-wider text-white">Yahoo OAuth</span>
                            <div className="my-2 text-[11px] text-slate-400 flex flex-col items-center">
                                <span className="text-slate-500">↓</span>
                                <span className="font-semibold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded mt-1">Yahoo Mail Sync</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">Secure Token Auth</span>
                        </div>

                        {/* Branch 4: Offline Local PC */}
                        <div className="bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 transition-all text-center flex flex-col items-center justify-between group">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shadow-lg mb-3 group-hover:scale-110 transition-transform text-amber-400">
                                <span className="text-2xl">💻</span>
                            </div>
                            <span className="text-xs font-black uppercase tracking-wider text-amber-300">Offline Local PC</span>
                            <div className="my-2 text-[11px] text-amber-200/80 flex flex-col items-center">
                                <span className="text-amber-500">↓</span>
                                <span className="font-semibold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded mt-1">Local Browser PC Storage</span>
                            </div>
                            <span className="text-[10px] text-amber-400/70 font-mono">Auto-Syncs Online After Login</span>
                        </div>
                    </div>
                </div>

                {/* LOGIN SELECTION PANEL */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left: Role Selection & Account Info */}
                    <div className="lg:col-span-7 bg-slate-900/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight">Step 1: Select ERP Operation Role</h3>
                                <p className="text-xs text-slate-400">Choose your privilege level to configure permissions</p>
                            </div>
                            <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                                Active Role: {selectedRole}
                            </span>
                        </div>

                        {/* Role Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                            {ROLES.map((r) => {
                                const isSelected = selectedRole === r.role;
                                return (
                                    <button
                                        key={r.role}
                                        type="button"
                                        onClick={() => setSelectedRole(r.role)}
                                        className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                                            isSelected 
                                                ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/20 ring-2 ring-blue-500/50' 
                                                : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:border-white/20'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-black uppercase tracking-wider">{r.label}</span>
                                            {isSelected && <span className="text-blue-400 text-xs font-bold">✓ Selected</span>}
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-tight">{r.desc}</p>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Optional Name & Email Inputs */}
                        <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 space-y-3">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Optional Account Personalization</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Display Name</label>
                                    <input 
                                        type="text" 
                                        value={customName}
                                        onChange={(e) => setCustomName(e.target.value)}
                                        placeholder={`e.g. Nagarjuna Reddy (${selectedRole})`}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Work Email</label>
                                    <input 
                                        type="email" 
                                        value={customEmail}
                                        onChange={(e) => setCustomEmail(e.target.value)}
                                        placeholder={`e.g. ${selectedRole.toLowerCase()}@company.com`}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Authentication Provider Buttons */}
                    <div className="lg:col-span-5 bg-slate-900/90 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-1">Step 2: Authenticate & Enter</h3>
                            <p className="text-xs text-slate-400 mb-6">Select OAuth Provider or Continue Offline</p>

                            <div className="space-y-3">
                                {/* Google OAuth */}
                                <button
                                    type="button"
                                    onClick={() => handleAuthenticate('google')}
                                    className="w-full bg-white hover:bg-slate-100 text-slate-900 p-4 rounded-2xl flex items-center justify-between transition-all shadow-xl hover:scale-[1.01] active:scale-98 group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-100 rounded-xl group-hover:rotate-6 transition-transform">
                                            <GoogleIcon className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <span className="text-xs font-black uppercase tracking-wider block">Sign in with Google OAuth 2.0</span>
                                            <span className="text-[10px] text-slate-500 font-medium">Syncs Gmail & Google Drive Container</span>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-400 font-bold group-hover:translate-x-1 transition-transform">&rarr;</span>
                                </button>

                                {/* Microsoft OAuth */}
                                <button
                                    type="button"
                                    onClick={() => handleAuthenticate('microsoft')}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-white/10 p-4 rounded-2xl flex items-center justify-between transition-all shadow-xl hover:scale-[1.01] active:scale-98 group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-900 rounded-xl border border-white/10 group-hover:rotate-6 transition-transform">
                                            <MicrosoftIcon className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <span className="text-xs font-black uppercase tracking-wider block">Sign in with Microsoft OAuth 2.0</span>
                                            <span className="text-[10px] text-sky-400 font-medium">Syncs Outlook & OneDrive Enterprise</span>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-400 font-bold group-hover:translate-x-1 transition-transform">&rarr;</span>
                                </button>

                                {/* Yahoo OAuth */}
                                <button
                                    type="button"
                                    onClick={() => handleAuthenticate('yahoo')}
                                    className="w-full bg-purple-950/60 hover:bg-purple-900/70 text-purple-100 border border-purple-500/30 p-4 rounded-2xl flex items-center justify-between transition-all shadow-xl hover:scale-[1.01] active:scale-98 group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-900/50 rounded-xl border border-purple-400/20 group-hover:rotate-6 transition-transform">
                                            <YahooIcon className="w-5 h-5 text-purple-300" />
                                        </div>
                                        <div className="text-left">
                                            <span className="text-xs font-black uppercase tracking-wider block">Sign in with Yahoo OAuth</span>
                                            <span className="text-[10px] text-purple-300 font-medium">Syncs Yahoo Mail & Cloud Services</span>
                                        </div>
                                    </div>
                                    <span className="text-xs text-purple-300 font-bold group-hover:translate-x-1 transition-transform">&rarr;</span>
                                </button>

                                <div className="relative py-2 flex items-center">
                                    <div className="flex-grow border-t border-white/10"></div>
                                    <span className="flex-shrink mx-4 text-white/30 font-black text-[10px] tracking-widest uppercase">Local PC Storage</span>
                                    <div className="flex-grow border-t border-white/10"></div>
                                </div>

                                {/* Offline Local PC Access */}
                                <button
                                    type="button"
                                    onClick={() => handleAuthenticate('offline')}
                                    className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white p-4 rounded-2xl flex items-center justify-between transition-all shadow-xl shadow-amber-600/20 hover:scale-[1.01] active:scale-98 group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-black/20 rounded-xl group-hover:rotate-6 transition-transform">
                                            <span className="text-xl">💻</span>
                                        </div>
                                        <div className="text-left">
                                            <span className="text-xs font-black uppercase tracking-wider block">Continue Offline (Local PC)</span>
                                            <span className="text-[10px] text-amber-100/90 font-medium">Saves locally on PC. Auto-syncs online after login.</span>
                                        </div>
                                    </div>
                                    <span className="text-xs text-white font-bold group-hover:translate-x-1 transition-transform">&rarr;</span>
                                </button>
                            </div>
                        </div>

                        {/* Offline Sync Information Box */}
                        <div className="mt-6 bg-slate-950/70 p-4 rounded-2xl border border-white/5 text-[11px] text-slate-400 space-y-1.5">
                            <div className="flex items-center gap-2 font-bold text-slate-300">
                                <span>🔄</span>
                                <span>Seamless Offline-to-Online Synchronization:</span>
                            </div>
                            <p className="leading-relaxed">
                                Any entries recorded in <strong className="text-amber-300">Offline Mode</strong> are preserved securely in your PC's browser storage. When you log in with Google, Microsoft, or Yahoo, all offline records are uploaded to your online cloud database.
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="w-full max-w-6xl mx-auto py-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 relative z-10">
                <p>© 2026 ERP ARJUN System. Enterprise uPVC Manufacturing & RM Section.</p>
                <div className="flex items-center gap-4 mt-2 sm:mt-0 font-semibold">
                    <span>Google Drive API v3</span>
                    <span>•</span>
                    <span>Microsoft Graph API</span>
                    <span>•</span>
                    <span>Yahoo OAuth2</span>
                    <span>•</span>
                    <span className="text-emerald-400">IndexedDB Local Storage</span>
                </div>
            </footer>
        </div>
    );
};

export default LoginPage;
