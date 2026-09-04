import React, { useState, useMemo } from 'react';
import { 
    Users as UsersIcon, 
    UserPlus, 
    Shield, 
    ShieldAlert, 
    ShieldCheck, 
    Sliders, 
    Settings2, 
    Search, 
    Filter, 
    Check, 
    X, 
    Lock, 
    Unlock, 
    Download, 
    RefreshCw, 
    AlertTriangle, 
    KeyRound, 
    Clock, 
    Building, 
    Phone, 
    Mail, 
    FileText, 
    CheckCircle2, 
    XCircle, 
    Edit2, 
    Trash2, 
    Eye, 
    LogOut, 
    Database,
    RotateCcw
} from 'lucide-react';
import { useStore, ALL_SYSTEM_PAGES, MOCK_APP_USERS } from '../store/useStore';
import type { AppUser, Role, SecurityAuditLog } from '../types';
import CreateUserModal from '../components/CreateUserModal';
import EditUserModal from '../components/EditUserModal';

interface UsersProps {
    addToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

type ViewSubTab = 'DIRECTORY' | 'ACCESS_MATRIX' | 'ADVANCED_OPTIONS' | 'AUDIT_LOGS';

const ROLE_COLORS: Record<Role, { bg: string; text: string; border: string }> = {
    ADMIN: { bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
    STORE_MANAGER: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
    PURCHASE: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
    SALES: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
    MANAGEMENT: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
    SECURITY: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700' },
    VIEWER: { bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' }
};

const Users: React.FC<UsersProps> = ({ addToast }) => {
    const store = useStore();
    const appUsers = store.appUsers || [];
    const systemSettings = store.systemSettings || {};
    const auditLogs = store.securityAuditLogs || [];

    const [activeTab, setActiveTab] = useState<ViewSubTab>('DIRECTORY');
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AppUser | null>(null);
    const [auditSearch, setAuditSearch] = useState('');
    const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('ALL');

    const notify = (msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
        if (addToast) {
            addToast(msg, type);
        }
    };

    // If appUsers is empty, ensure we can seed or display correctly
    const handleSeedDefaults = () => {
        store.resetAppUsersToDefaults();
        notify('Team directory and permissions reset to standard templates.', 'info');
    };

    // Filtered users
    const filteredUsers = useMemo(() => {
        return appUsers.filter(user => {
            const matchesSearch = 
                user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (user.department && user.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
                user.role.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
            const matchesStatus = statusFilter === 'ALL' || (user.status || 'ACTIVE') === statusFilter;

            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [appUsers, searchQuery, roleFilter, statusFilter]);

    // Filtered audit logs
    const filteredAuditLogs = useMemo(() => {
        return auditLogs.filter(log => {
            const matchesSearch = 
                log.userName.toLowerCase().includes(auditSearch.toLowerCase()) ||
                log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
                log.details.toLowerCase().includes(auditSearch.toLowerCase());
            const matchesCat = auditCategoryFilter === 'ALL' || log.category === auditCategoryFilter;
            return matchesSearch && matchesCat;
        });
    }, [auditLogs, auditSearch, auditCategoryFilter]);

    // Summary counts
    const activeCount = appUsers.filter(u => (u.status || 'ACTIVE') === 'ACTIVE').length;
    const suspendedCount = appUsers.filter(u => u.status === 'SUSPENDED').length;
    const adminCount = appUsers.filter(u => u.role === 'ADMIN' || u.role === 'MANAGEMENT').length;

    // Toggle a single page permission for a user
    const handleTogglePagePermission = (user: AppUser, page: string) => {
        const currentPages = user.allowedPages || [];
        const newPages = currentPages.includes(page)
            ? currentPages.filter(p => p !== page)
            : [...currentPages, page];

        store.updateAppUser({ ...user, allowedPages: newPages });
        store.addSecurityAuditLog({
            userName: store.currentUser?.name || 'Administrator',
            action: currentPages.includes(page) ? 'REVOKE_PAGE' : 'GRANT_PAGE',
            category: 'PERMISSION',
            details: `${currentPages.includes(page) ? 'Revoked' : 'Granted'} "${page}" for ${user.name}`
        });
        notify(`Updated module permissions for ${user.name}`);
    };

    // Toggle user status (Active / Suspended)
    const handleToggleUserStatus = (user: AppUser) => {
        const newStatus = (user.status || 'ACTIVE') === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        store.updateAppUser({ ...user, status: newStatus });
        store.addSecurityAuditLog({
            userName: store.currentUser?.name || 'Administrator',
            action: newStatus === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
            category: 'USER_MANAGEMENT',
            details: `Changed account status of ${user.name} to ${newStatus}`
        });
        notify(`${user.name} account is now ${newStatus.toLowerCase()}`, newStatus === 'ACTIVE' ? 'success' : 'warning');
    };

    // Export User Directory as CSV
    const handleExportUsersCsv = () => {
        const headers = ['User ID', 'Full Name', 'Email', 'Role', 'Status', 'Department', 'Phone', 'Allowed Modules', 'Created At'];
        const rows = appUsers.map(u => [
            u.id,
            `"${u.name.replace(/"/g, '""')}"`,
            `"${u.email}"`,
            u.role,
            u.status || 'ACTIVE',
            `"${(u.department || '').replace(/"/g, '""')}"`,
            `"${u.phone || ''}"`,
            `"${(u.allowedPages || []).join('; ')}"`,
            u.createdAt
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `erp_users_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        store.addSecurityAuditLog({
            userName: store.currentUser?.name || 'Administrator',
            action: 'DATA_EXPORT',
            category: 'SECURITY',
            details: 'Exported team directory and access permissions CSV file.'
        });
        notify('User directory exported successfully');
    };

    // Export Audit Logs as CSV
    const handleExportAuditLogsCsv = () => {
        const headers = ['Log ID', 'Timestamp', 'Admin/User', 'Category', 'Action', 'Details', 'IP Address'];
        const rows = auditLogs.map(l => [
            l.id,
            l.timestamp,
            `"${l.userName.replace(/"/g, '""')}"`,
            l.category,
            l.action,
            `"${l.details.replace(/"/g, '""')}"`,
            l.ipAddress || 'Internal'
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `erp_security_audit_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        notify('Security audit logs exported');
    };

    // Revoke all active sessions
    const handleRevokeAllSessions = () => {
        store.addSecurityAuditLog({
            userName: store.currentUser?.name || 'Administrator',
            action: 'REVOKE_SESSIONS',
            category: 'AUTH',
            details: 'Master command executed: all active non-admin user sessions revoked.'
        });
        notify('All external sessions invalidated. Users will need to re-login.', 'warning');
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
            {/* Top Alert if Emergency Read-Only Mode is On */}
            {systemSettings.emergencyReadOnlyMode && (
                <div className="p-4 bg-amber-500/15 border-2 border-amber-500 rounded-2xl flex items-center justify-between gap-4 text-amber-900 dark:text-amber-200 shadow-lg shadow-amber-500/10">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="text-amber-600 flex-shrink-0 animate-bounce" size={24} />
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider">Emergency Read-Only Mode Active</p>
                            <p className="text-[11px] font-medium text-amber-800/80 dark:text-amber-300/80">
                                ERP modifications are restricted plant-wide. Non-admin transactions are locked for physical audit or maintenance.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            store.updateSystemSettings({ emergencyReadOnlyMode: false });
                            store.addSecurityAuditLog({
                                userName: store.currentUser?.name || 'Administrator',
                                action: 'EMERGENCY_MODE_DISABLED',
                                category: 'SECURITY',
                                details: 'Disabled Emergency Read-Only Mode. ERP operational write access restored.'
                            });
                            notify('Emergency Read-Only Mode disabled. Standard access restored.', 'success');
                        }}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
                    >
                        Deactivate Mode
                    </button>
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-3xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight italic">
                            Users & Access Control
                        </h1>
                        <span className="px-2.5 py-0.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-600/20">
                            Enterprise Security
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        Manage user accounts, assign role permissions, view audit trails, and configure advanced system security policies.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Advanced Options Quick Button */}
                    <button
                        onClick={() => setActiveTab('ADVANCED_OPTIONS')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm ${
                            activeTab === 'ADVANCED_OPTIONS'
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 ring-2 ring-blue-500'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                    >
                        <Sliders size={15} className="text-blue-500" />
                        <span>Advanced Options</span>
                        {systemSettings.emergencyReadOnlyMode && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        )}
                    </button>

                    {/* Export Users */}
                    <button
                        onClick={handleExportUsersCsv}
                        className="px-3.5 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-sm"
                        title="Export Users to CSV"
                    >
                        <Download size={14} /> Export CSV
                    </button>

                    {/* Add New User */}
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <UserPlus size={15} /> Add New User
                    </button>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
                    <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                        <UsersIcon size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Team Users</p>
                        <p className="text-xl font-display font-black text-slate-900 dark:text-white mt-0.5">{appUsers.length}</p>
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
                    <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                        <CheckCircle2 size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Active Accounts</p>
                        <p className="text-xl font-display font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{activeCount}</p>
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
                    <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-xl">
                        <Shield size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Admins & Managers</p>
                        <p className="text-xl font-display font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{adminCount}</p>
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
                    <div className="p-3 bg-slate-500/10 text-slate-600 rounded-xl">
                        <Lock size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Session Policy</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1 truncate">
                            {systemSettings.sessionTimeoutMinutes ? `${systemSettings.sessionTimeoutMinutes}m Timeout` : '60m Timeout'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation Sub-Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-px">
                <button
                    onClick={() => setActiveTab('DIRECTORY')}
                    className={`pb-3 px-4 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                        activeTab === 'DIRECTORY'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <UsersIcon size={14} /> Team Directory ({appUsers.length})
                </button>

                <button
                    onClick={() => setActiveTab('ACCESS_MATRIX')}
                    className={`pb-3 px-4 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                        activeTab === 'ACCESS_MATRIX'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <ShieldCheck size={14} /> Access Control Matrix
                </button>

                <button
                    onClick={() => setActiveTab('ADVANCED_OPTIONS')}
                    className={`pb-3 px-4 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                        activeTab === 'ADVANCED_OPTIONS'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <Sliders size={14} /> Advanced Options
                    {systemSettings.emergencyReadOnlyMode && (
                        <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded text-[8px]">ACTIVE</span>
                    )}
                </button>

                <button
                    onClick={() => setActiveTab('AUDIT_LOGS')}
                    className={`pb-3 px-4 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                        activeTab === 'AUDIT_LOGS'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <Clock size={14} /> Security Audit Trail ({auditLogs.length})
                </button>
            </div>

            {/* TAB 1: TEAM DIRECTORY */}
            {activeTab === 'DIRECTORY' && (
                <div className="space-y-4">
                    {/* Search & Filter Bar */}
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                type="text"
                                placeholder="Search users by name, email, department, or role..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
                                <Filter size={12} className="text-slate-400" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Role:</span>
                                <select
                                    value={roleFilter}
                                    onChange={e => setRoleFilter(e.target.value)}
                                    className="bg-transparent text-xs font-bold outline-none cursor-pointer text-slate-700 dark:text-slate-300"
                                >
                                    <option value="ALL">All Roles</option>
                                    <option value="ADMIN">ADMIN</option>
                                    <option value="STORE_MANAGER">STORE_MANAGER</option>
                                    <option value="PURCHASE">PURCHASE</option>
                                    <option value="SALES">SALES</option>
                                    <option value="MANAGEMENT">MANAGEMENT</option>
                                    <option value="SECURITY">SECURITY</option>
                                    <option value="VIEWER">VIEWER</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Status:</span>
                                <select
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value)}
                                    className="bg-transparent text-xs font-bold outline-none cursor-pointer text-slate-700 dark:text-slate-300"
                                >
                                    <option value="ALL">All Status</option>
                                    <option value="ACTIVE">Active Only</option>
                                    <option value="SUSPENDED">Suspended</option>
                                    <option value="INACTIVE">Inactive</option>
                                </select>
                            </div>

                            {appUsers.length === 0 && (
                                <button
                                    onClick={handleSeedDefaults}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 flex items-center gap-1"
                                >
                                    <RefreshCw size={12} /> Seed Defaults
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                        <th className="px-5 py-4">User Details</th>
                                        <th className="px-4 py-4">Role & Policy</th>
                                        <th className="px-4 py-4">Department & Contact</th>
                                        <th className="px-4 py-4">Allowed Modules</th>
                                        <th className="px-4 py-4">Status</th>
                                        <th className="px-5 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                                    {filteredUsers.map(user => {
                                        const roleStyle = ROLE_COLORS[user.role] || ROLE_COLORS.VIEWER;
                                        const isActive = (user.status || 'ACTIVE') === 'ACTIVE';

                                        return (
                                            <tr key={user.id} className="group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-black text-sm shadow-sm">
                                                            {user.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                                                    {user.name}
                                                                </p>
                                                                {user.twoFactorEnabled && (
                                                                    <span title="Two-Factor PIN Enforced" className="text-emerald-500">
                                                                        <Lock size={12} />
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                                                <Mail size={11} className="text-slate-400" />
                                                                <span>{user.email}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                                                        {user.role}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400 font-medium">
                                                        {user.canExport && <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[8px] font-bold">EXPORT</span>}
                                                        {user.canEditPricing && <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[8px] font-bold">PRICING</span>}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                                        <Building size={12} className="text-slate-400" />
                                                        <span>{user.department || 'General Plant'}</span>
                                                    </p>
                                                    {user.phone && (
                                                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                                                            <Phone size={11} className="text-slate-400" />
                                                            <span>{user.phone}</span>
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                                                        {(user.allowedPages || []).slice(0, 3).map(p => (
                                                            <span key={p} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[9px] font-bold">
                                                                {p}
                                                            </span>
                                                        ))}
                                                        {(user.allowedPages || []).length > 3 && (
                                                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-md text-[9px] font-black">
                                                                +{(user.allowedPages || []).length - 3} more
                                                            </span>
                                                        )}
                                                        {(!user.allowedPages || user.allowedPages.length === 0) && (
                                                            <span className="text-[10px] text-slate-400 italic">No access</span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <button
                                                        onClick={() => handleToggleUserStatus(user)}
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors ${
                                                            isActive
                                                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                                                                : 'bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25'
                                                        }`}
                                                        title="Click to toggle Active / Suspended status"
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                        <span>{user.status || 'ACTIVE'}</span>
                                                    </button>
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => setEditingUser(user)}
                                                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors"
                                                            title="Edit User Profile & Permissions"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>

                                                        <button
                                                            onClick={() => {
                                                                if (confirm(`Remove ${user.name} account permanently?`)) {
                                                                    store.deleteAppUser(user.id);
                                                                    notify(`Deleted user: ${user.name}`);
                                                                }
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
                                                            title="Delete User"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                                                No team members match the search filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: ACCESS CONTROL MATRIX */}
            {activeTab === 'ACCESS_MATRIX' && (
                <div className="space-y-4">
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                Interactive Module Authorization Matrix
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Click any cell pill to instantly grant or revoke page navigation access for team members.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Preset:</span>
                            <button
                                onClick={() => {
                                    appUsers.forEach(u => {
                                        store.updateAppUser({ ...u, allowedPages: [...ALL_SYSTEM_PAGES] });
                                    });
                                    notify('Granted all module permissions to all users.');
                                }}
                                className="px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors"
                            >
                                Grant All to All
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/80 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-5 py-4 min-w-[200px] bg-slate-50 dark:bg-slate-950">Team Member</th>
                                        <th className="px-3 py-4 min-w-[120px]">Assigned Role</th>
                                        {ALL_SYSTEM_PAGES.map(page => (
                                            <th key={page} className="px-2.5 py-4 text-center min-w-[100px] whitespace-nowrap">
                                                {page}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                                    {appUsers.map(user => (
                                        <tr key={user.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-5 py-3.5 font-black text-slate-900 dark:text-white uppercase tracking-tight bg-white dark:bg-slate-900 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-600/10 text-blue-600 flex items-center justify-center text-[10px]">
                                                        {user.name.charAt(0)}
                                                    </div>
                                                    <span className="truncate">{user.name}</span>
                                                </div>
                                            </td>

                                            <td className="px-3 py-3.5">
                                                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-[9px] font-black uppercase">
                                                    {user.role}
                                                </span>
                                            </td>

                                            {ALL_SYSTEM_PAGES.map(page => {
                                                const hasAccess = (user.allowedPages || []).includes(page);
                                                return (
                                                    <td key={page} className="px-2.5 py-3.5 text-center">
                                                        <button
                                                            onClick={() => handleTogglePagePermission(user, page)}
                                                            className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all ${
                                                                hasAccess
                                                                    ? 'bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 scale-100 hover:scale-110'
                                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 hover:bg-slate-200'
                                                            }`}
                                                            title={`${hasAccess ? 'Revoke' : 'Grant'} access to ${page}`}
                                                        >
                                                            {hasAccess ? <Check size={14} strokeWidth={3} /> : <X size={12} />}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: ADVANCED OPTIONS */}
            {activeTab === 'ADVANCED_OPTIONS' && (
                <div className="space-y-6">
                    {/* Header Banner */}
                    <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-700/50">
                        <div className="flex items-center gap-4">
                            <div className="p-3.5 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
                                <Sliders size={28} />
                            </div>
                            <div>
                                <h2 className="text-xl font-display font-black uppercase tracking-tight">
                                    Advanced Access & Enterprise Policies
                                </h2>
                                <p className="text-xs text-slate-300 font-medium mt-1">
                                    Configure company-wide authentication policies, emergency lockout controls, and operational data restrictions.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleRevokeAllSessions}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/20 flex items-center gap-1.5 transition-all"
                            >
                                <LogOut size={13} /> Invalidate All Sessions
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Section 1: Session & Authentication Security */}
                        <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
                            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div className="p-2.5 bg-blue-600/10 text-blue-600 rounded-xl">
                                    <KeyRound size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                        Session & Authentication Policies
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-medium">Manage timeout parameters and login safeguards</p>
                                </div>
                            </div>

                            {/* Inactivity Timeout */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                                    <span>Session Inactivity Auto-Timeout</span>
                                    <span className="text-[10px] font-mono text-blue-600 font-bold">
                                        {systemSettings.sessionTimeoutMinutes ? `${systemSettings.sessionTimeoutMinutes} Minutes` : '60 Minutes'}
                                    </span>
                                </label>
                                <p className="text-[11px] text-slate-500">Automatically logout inactive users to prevent unauthorized workstation access.</p>
                                <div className="grid grid-cols-5 gap-2 pt-1">
                                    {[15, 30, 60, 240, 480].map(mins => {
                                        const isSelected = (systemSettings.sessionTimeoutMinutes || 60) === mins;
                                        return (
                                            <button
                                                key={mins}
                                                type="button"
                                                onClick={() => {
                                                    store.updateSystemSettings({ sessionTimeoutMinutes: mins });
                                                    store.addSecurityAuditLog({
                                                        userName: store.currentUser?.name || 'Administrator',
                                                        action: 'POLICY_UPDATE',
                                                        category: 'SECURITY',
                                                        details: `Updated session inactivity timeout to ${mins} minutes`
                                                    });
                                                    notify(`Session timeout set to ${mins} minutes`);
                                                }}
                                                className={`py-2 rounded-xl text-xs font-black uppercase transition-all ${
                                                    isSelected
                                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                                }`}
                                            >
                                                {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Enforce 2FA / Security PIN */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div className="space-y-0.5 pr-4">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Require Two-Factor PIN Verification</p>
                                    <p className="text-[11px] text-slate-500">Prompt for secondary security passcodes during critical deletions or pricing changes.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextVal = !systemSettings.requireTwoFactor;
                                        store.updateSystemSettings({ requireTwoFactor: nextVal });
                                        store.addSecurityAuditLog({
                                            userName: store.currentUser?.name || 'Administrator',
                                            action: nextVal ? '2FA_ENFORCED' : '2FA_OPTIONAL',
                                            category: 'SECURITY',
                                            details: `Two-Factor PIN policy toggled to ${nextVal ? 'Required' : 'Optional'}`
                                        });
                                        notify(`Two-Factor PIN policy ${nextVal ? 'enforced' : 'set to optional'}`);
                                    }}
                                    className={`w-12 h-6 rounded-full relative p-1 transition-colors ${
                                        systemSettings.requireTwoFactor ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                                        systemSettings.requireTwoFactor ? 'translate-x-6' : 'translate-x-0'
                                    }`} />
                                </button>
                            </div>

                            {/* Single Active Session */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div className="space-y-0.5 pr-4">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Single Active Session Lock</p>
                                    <p className="text-[11px] text-slate-500">Automatically logout earlier terminal sessions when a user signs in from a new device.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextVal = systemSettings.singleSessionPerUser === false ? true : false;
                                        store.updateSystemSettings({ singleSessionPerUser: nextVal });
                                        notify(`Single active session lock ${nextVal ? 'enabled' : 'disabled'}`);
                                    }}
                                    className={`w-12 h-6 rounded-full relative p-1 transition-colors ${
                                        systemSettings.singleSessionPerUser !== false ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                                        systemSettings.singleSessionPerUser !== false ? 'translate-x-6' : 'translate-x-0'
                                    }`} />
                                </button>
                            </div>

                            {/* IP Whitelist */}
                            <div className="space-y-2 pt-1">
                                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    Factory Plant Network IP Whitelist
                                </label>
                                <p className="text-[11px] text-slate-500">Comma-separated CIDR blocks or corporate IP addresses authorized for ERP logins.</p>
                                <input
                                    type="text"
                                    placeholder="192.168.1.0/24, 10.0.0.0/16"
                                    value={systemSettings.allowedIpRanges || ''}
                                    onChange={e => store.updateSystemSettings({ allowedIpRanges: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Section 2: Data Protection & Operational Controls */}
                        <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
                            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div className="p-2.5 bg-emerald-600/10 text-emerald-600 rounded-xl">
                                    <Database size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                        Data Protection & Operational Governance
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-medium">Prevent data exfiltration and unauthorized financial visibility</p>
                                </div>
                            </div>

                            {/* Price Masking Toggle */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div className="space-y-0.5 pr-4">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Mask Pricing & Margins from Standard Users</p>
                                    <p className="text-[11px] text-slate-500">Hide purchase unit rates, material valuations, and quotation profit margins from non-admin roles.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextVal = !systemSettings.maskPricingForStandardUsers;
                                        store.updateSystemSettings({ maskPricingForStandardUsers: nextVal });
                                        notify(`Pricing masking ${nextVal ? 'activated' : 'deactivated'}`);
                                    }}
                                    className={`w-12 h-6 rounded-full relative p-1 transition-colors ${
                                        systemSettings.maskPricingForStandardUsers ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                                        systemSettings.maskPricingForStandardUsers ? 'translate-x-6' : 'translate-x-0'
                                    }`} />
                                </button>
                            </div>

                            {/* Data Export Toggle */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div className="space-y-0.5 pr-4">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Allow Non-Admin Excel Data Export</p>
                                    <p className="text-[11px] text-slate-500">Permit supervisors and operators to download stock lists and transaction reports.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextVal = systemSettings.allowDataExport === false ? true : false;
                                        store.updateSystemSettings({ allowDataExport: nextVal });
                                        notify(`Data export permission ${nextVal ? 'enabled' : 'restricted to Admins only'}`);
                                    }}
                                    className={`w-12 h-6 rounded-full relative p-1 transition-colors ${
                                        systemSettings.allowDataExport !== false ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                                        systemSettings.allowDataExport !== false ? 'translate-x-6' : 'translate-x-0'
                                    }`} />
                                </button>
                            </div>

                            {/* Backdated Entries Lock */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                                    <span>Backdated Inventory Entries Lock</span>
                                    <span className="text-[10px] font-mono text-emerald-600 font-bold">
                                        Max {systemSettings.lockBackdatedEntriesDays || 3} Days Past
                                    </span>
                                </label>
                                <p className="text-[11px] text-slate-500">Prevent operators from logging historical stock receipts older than this threshold.</p>
                                <div className="grid grid-cols-4 gap-2 pt-1">
                                    {[1, 3, 7, 30].map(days => {
                                        const isSelected = (systemSettings.lockBackdatedEntriesDays || 3) === days;
                                        return (
                                            <button
                                                key={days}
                                                type="button"
                                                onClick={() => {
                                                    store.updateSystemSettings({ lockBackdatedEntriesDays: days });
                                                    notify(`Backdated entry lock set to ${days} days`);
                                                }}
                                                className={`py-2 rounded-xl text-xs font-black uppercase transition-all ${
                                                    isSelected
                                                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                                }`}
                                            >
                                                {days} {days === 1 ? 'Day' : 'Days'}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Emergency Lockdown & System Reset */}
                    <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
                                <ShieldAlert size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                    System Emergency Controls & Factory Defaults
                                </h3>
                                <p className="text-[11px] text-slate-500 font-medium">Critical administrative overrides and plant maintenance modes</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Emergency Read-Only Mode */}
                            <div className={`p-5 rounded-2xl border transition-all ${
                                systemSettings.emergencyReadOnlyMode
                                    ? 'bg-amber-500/10 border-amber-500/30'
                                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-100 dark:border-slate-800'
                            }`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                                Emergency Read-Only Lock
                                            </p>
                                            {systemSettings.emergencyReadOnlyMode && (
                                                <span className="px-2 py-0.5 bg-amber-500 text-white rounded text-[8px] font-black uppercase">
                                                    ACTIVE
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                            Immediately freezes all write transactions (inflows, dies, consumption) across the ERP during stock takes or physical audits.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nextVal = !systemSettings.emergencyReadOnlyMode;
                                            store.updateSystemSettings({ emergencyReadOnlyMode: nextVal });
                                            store.addSecurityAuditLog({
                                                userName: store.currentUser?.name || 'Administrator',
                                                action: nextVal ? 'EMERGENCY_LOCK_ENGAGED' : 'EMERGENCY_LOCK_RELEASED',
                                                category: 'SECURITY',
                                                details: `Emergency Read-Only Mode ${nextVal ? 'engaged' : 'released'}`
                                            });
                                            notify(
                                                nextVal ? 'Emergency Read-Only mode engaged plant-wide.' : 'Emergency Read-Only released.',
                                                nextVal ? 'warning' : 'success'
                                            );
                                        }}
                                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                            systemSettings.emergencyReadOnlyMode
                                                ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-md shadow-amber-600/20'
                                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                                        }`}
                                    >
                                        {systemSettings.emergencyReadOnlyMode ? 'Release Freeze' : 'Engage Lock'}
                                    </button>
                                </div>
                            </div>

                            {/* Reset to Factory Defaults */}
                            <div className="p-5 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                            Reset Role & Access Defaults
                                        </p>
                                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                            Realign all registered users and their page permissions back to the initial standard factory template.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (confirm('Reset all users and role permissions back to default factory settings?')) {
                                                handleSeedDefaults();
                                            }
                                        }}
                                        className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                                    >
                                        <RotateCcw size={13} /> Reset
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: SECURITY AUDIT LOG TRAIL */}
            {activeTab === 'AUDIT_LOGS' && (
                <div className="space-y-4">
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                type="text"
                                placeholder="Search audit logs by administrator name, action, or details..."
                                value={auditSearch}
                                onChange={e => setAuditSearch(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Category:</span>
                                <select
                                    value={auditCategoryFilter}
                                    onChange={e => setAuditCategoryFilter(e.target.value)}
                                    className="bg-transparent text-xs font-bold outline-none cursor-pointer text-slate-700 dark:text-slate-300"
                                >
                                    <option value="ALL">All Categories</option>
                                    <option value="AUTH">Authentication</option>
                                    <option value="PERMISSION">Permissions</option>
                                    <option value="SECURITY">Security Policies</option>
                                    <option value="USER_MANAGEMENT">User Management</option>
                                </select>
                            </div>

                            <button
                                onClick={handleExportAuditLogsCsv}
                                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                            >
                                <Download size={13} /> Export Logs
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                        <th className="px-5 py-4">Timestamp</th>
                                        <th className="px-4 py-4">Actor / Admin</th>
                                        <th className="px-4 py-4">Category</th>
                                        <th className="px-4 py-4">Action</th>
                                        <th className="px-5 py-4">Event Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium">
                                    {filteredAuditLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                                            <td className="px-5 py-3.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                                                {log.userName}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                    log.category === 'SECURITY' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                                                    log.category === 'PERMISSION' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                                                    log.category === 'AUTH' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                                                    'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                }`}>
                                                    {log.category}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                {log.action}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                                                {log.details}
                                            </td>
                                        </tr>
                                    ))}

                                    {filteredAuditLogs.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-5 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                                                No security audit entries recorded.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            <CreateUserModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onAddUser={(newUser) => {
                    store.addAppUser(newUser);
                    notify(`User ${newUser.name} created successfully!`);
                }}
            />

            <EditUserModal
                isOpen={Boolean(editingUser)}
                user={editingUser}
                onClose={() => setEditingUser(null)}
                onUpdateUser={(updatedUser) => {
                    store.updateAppUser(updatedUser);
                    notify(`Updated ${updatedUser.name}'s profile.`);
                }}
                onDeleteUser={(id) => {
                    store.deleteAppUser(id);
                    setEditingUser(null);
                    notify('User account deleted.');
                }}
            />
        </div>
    );
};

export default Users;
