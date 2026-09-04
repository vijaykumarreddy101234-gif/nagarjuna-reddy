import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from './store/useStore';
import { ToastContainer } from './components/Notifications';
import LoginPage from './pages/Login';
import type { User, Role, ToastMessage } from './types';
import { 
    Menu, 
    X, 
    ChevronLeft, 
    ChevronRight, 
    LayoutDashboard, 
    Boxes, 
    Layers, 
    Hammer, 
    History as HistoryIcon, 
    HardDrive, 
    FileSpreadsheet, 
    Users as UsersIcon, 
    Trash2, 
    UploadCloud, 
    Settings as SettingsIcon, 
    LogOut, 
    RefreshCw, 
    Building2,
    Cloud,
    Laptop,
    Check,
    Download
} from 'lucide-react';

import Dashboard, { type ReorderSuggestion } from './pages/Dashboard';
import StoreSection from './pages/StoreSection';
import ProfileSection from './pages/ProfileSection';
import DiesAndPlanning from './pages/DiesAndPlanning';
import Settings from './pages/Settings';
import Users from './pages/Users';
import History from './pages/History';
import Trash from './pages/Trash';
import ImportExcel from './pages/ImportExcel';
import Storage from './pages/Storage';
import ExcelSheets from './pages/ExcelSheets';
import ExportHub from './pages/ExportHub';

type NavTab = 
    | 'Dashboard' 
    | 'Store Management' 
    | 'Profiles & Stock' 
    | 'Dies & Planning' 
    | 'Reports & History' 
    | 'Central Export Hub'
    | 'Storage'
    | 'Excel & Sheets'
    | 'Users' 
    | 'Trash' 
    | 'Import Excel' 
    | 'Settings';

const App: React.FC = () => {
    const store = useStore();
    const [currentTab, setCurrentTab] = useState<NavTab>('Dashboard');
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

    const [profileNavState, setProfileNavState] = useState<{
        tab?: any;
        subTab?: string;
        action?: string | null;
        timestamp?: number;
    } | null>(null);

    const [storeNavState, setStoreNavState] = useState<{
        tab?: any;
        timestamp?: number;
    } | null>(null);

    const addToast = (message: string, type: ToastMessage['type'] = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const dismissToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // Close mobile nav when switching tabs or resizing
    const handleSelectTab = (tab: NavTab) => {
        setCurrentTab(tab);
        setIsMobileNavOpen(false);
    };

    // Calculate stock levels map
    const stockLevels = useMemo(() => {
        const levels: Record<string, number> = {};
        store.items.forEach(item => {
            const inward = store.inflowTransactions
                .filter(tx => tx.itemId === item.id && !tx.deletedAt)
                .reduce((sum, tx) => sum + tx.quantity, 0);
            const consumption = store.consumptionTransactions
                .filter(tx => tx.itemId === item.id && !tx.deletedAt)
                .reduce((sum, tx) => sum + tx.quantity, 0);
            levels[item.id] = (item.openingStock || 0) + inward - consumption;
        });
        return levels;
    }, [store.items, store.inflowTransactions, store.consumptionTransactions]);

    // Dashboard stats calculation
    const dashboardStats = useMemo(() => {
        const activeItems = store.items.filter(i => !i.deletedAt);
        const totalItems = activeItems.length;
        const lowStockItems = activeItems
            .filter(i => (stockLevels[i.id] || 0) <= (i.reorderPoint || 0))
            .map(i => ({ ...i, currentStock: stockLevels[i.id] || 0 }));
        
        const totalInventoryValue = activeItems.reduce((sum, i) => sum + ((stockLevels[i.id] || 0) * (i.costPrice || 0)), 0);

        // Inventory Value Distribution by Item
        const inventoryValueDistribution = activeItems
            .map(i => ({
                name: i.name,
                value: (stockLevels[i.id] || 0) * (i.costPrice || 0)
            }))
            .filter(i => i.value > 0)
            .sort((a, b) => b.value - a.value);

        // Category Statistics Breakdown
        const categoryStats: Record<string, { count: number; value: number }> = {};
        activeItems.forEach(i => {
            const cat = i.category || 'General';
            if (!categoryStats[cat]) {
                categoryStats[cat] = { count: 0, value: 0 };
            }
            categoryStats[cat].count += 1;
            categoryStats[cat].value += (stockLevels[i.id] || 0) * (i.costPrice || 0);
        });

        // Monthly Operations Velocity
        const monthlyOperations: { [key: string]: { inflow: number; consumption: number } } = {};
        
        store.inflowTransactions.filter(tx => !tx.deletedAt).forEach(tx => {
            const dateStr = tx.txnDate || tx.createdAt;
            if (!dateStr) return;
            const monthKey = dateStr.slice(0, 7); // YYYY-MM
            if (!monthlyOperations[monthKey]) {
                monthlyOperations[monthKey] = { inflow: 0, consumption: 0 };
            }
            monthlyOperations[monthKey].inflow += tx.totalCost || (tx.quantity * (tx.unitCost || 0));
        });

        store.consumptionTransactions.filter(tx => !tx.deletedAt).forEach(tx => {
            const dateStr = tx.txnDate || tx.createdAt;
            if (!dateStr) return;
            const monthKey = dateStr.slice(0, 7); // YYYY-MM
            if (!monthlyOperations[monthKey]) {
                monthlyOperations[monthKey] = { inflow: 0, consumption: 0 };
            }
            const item = store.items.find(i => i.id === tx.itemId);
            const cost = tx.quantity * (item?.costPrice || 50);
            monthlyOperations[monthKey].consumption += cost;
        });

        // Smart Reorder Suggestions
        const smartReorderSuggestions: ReorderSuggestion[] = lowStockItems.map(item => {
            const reorderPoint = item.reorderPoint || 100;
            const currentStock = item.currentStock;
            const suggestedReorder = Math.max(reorderPoint * 2 - currentStock, reorderPoint);
            return {
                itemId: item.id,
                name: item.name,
                sku: item.sku,
                currentStock,
                suggestedReorder,
                uom: item.uom || 'kg',
                reason: currentStock <= 0 ? 'Out of stock - Immediate purchase needed' : 'Below safety reorder threshold'
            };
        });

        return {
            totalItems,
            lowStockItems,
            totalInventoryValue,
            inventoryValueDistribution,
            monthlyOperations,
            totalBatches: new Set(store.consumptionTransactions.filter(tx => !tx.deletedAt && tx.refNo).map(tx => tx.refNo)).size,
            smartReorderSuggestions,
            categoryStats
        };
    }, [store.items, stockLevels, store.inflowTransactions, store.consumptionTransactions]);

    if (!store.currentUser) {
        return (
            <LoginPage 
                onLogin={(user) => {
                    store.login(user);
                    addToast(`Signed in successfully via ${user.provider ? user.provider.toUpperCase() : 'Local PC'} mode`, 'success');
                }}
                offlinePendingCount={store.offlinePendingCount}
                lastSyncTime={store.lastCloudSyncTimestamp}
            />
        );
    }

    const navItems: { name: NavTab; roles: Role[]; icon: React.FC<{ className?: string }> }[] = [
        { name: 'Dashboard', roles: ['ADMIN', 'STORE_MANAGER', 'PURCHASE', 'SALES', 'SECURITY', 'MANAGEMENT'], icon: LayoutDashboard },
        { name: 'Store Management', roles: ['ADMIN', 'STORE_MANAGER', 'PURCHASE'], icon: Boxes },
        { name: 'Profiles & Stock', roles: ['ADMIN', 'STORE_MANAGER', 'SALES'], icon: Layers },
        { name: 'Dies & Planning', roles: ['ADMIN', 'STORE_MANAGER', 'MANAGEMENT'], icon: Hammer },
        { name: 'Reports & History', roles: ['ADMIN', 'MANAGEMENT', 'STORE_MANAGER'], icon: HistoryIcon },
        { name: 'Central Export Hub', roles: ['ADMIN', 'STORE_MANAGER', 'PURCHASE', 'SALES', 'SECURITY', 'MANAGEMENT'], icon: Download },
        { name: 'Storage', roles: ['ADMIN', 'STORE_MANAGER', 'PURCHASE', 'SALES', 'SECURITY', 'MANAGEMENT'], icon: HardDrive },
        { name: 'Excel & Sheets', roles: ['ADMIN', 'STORE_MANAGER', 'PURCHASE', 'SALES', 'SECURITY', 'MANAGEMENT'], icon: FileSpreadsheet },
        { name: 'Users', roles: ['ADMIN'], icon: UsersIcon },
        { name: 'Trash', roles: ['ADMIN'], icon: Trash2 },
        { name: 'Import Excel', roles: ['ADMIN', 'STORE_MANAGER'], icon: UploadCloud },
        { name: 'Settings', roles: ['ADMIN', 'MANAGEMENT'], icon: SettingsIcon },
    ];

    const allowedNav = navItems.filter(item => item.roles.includes(store.currentUser!.role));

    const handleNavigate = (page: string, initialTab?: string, initialSubTab?: string, openModal?: string) => {
        const p = String(page || '').trim();
        const tabLower = (initialTab || '').toLowerCase();
        
        // Handle navigation to Profiles & Stock ecosystem
        if (
            p === 'Profiles' || 
            p === 'Profiles & Stock' || 
            p === 'Production' || 
            p === 'Dispatch' || 
            p === 'Shipments' || 
            p === 'Quotations' || 
            p === 'Quotations & Sales' ||
            tabLower.includes('product') ||
            tabLower.includes('dispatch') ||
            tabLower.includes('quotat') ||
            tabLower.includes('stock')
        ) {
            let targetInitialTab: any = initialTab || 'Profiles';
            let targetSubTab: string | undefined = initialSubTab;
            let action: string | null = openModal || null;

            if (p === 'Production' || tabLower.includes('product')) {
                targetInitialTab = 'Production';
                targetSubTab = targetSubTab || 'Inflow';
                if (!action || openModal === 'ADD_PRODUCTION') action = 'ADD_PRODUCTION';
            } else if (p === 'Dispatch' || p === 'Shipments' || tabLower.includes('dispatch')) {
                targetInitialTab = 'Production';
                targetSubTab = targetSubTab || 'Outflow';
                if (!action || openModal === 'DISPATCH_ORDER') action = 'DISPATCH_ORDER';
            } else if (p === 'Quotations' || p === 'Quotations & Sales' || tabLower.includes('quotat')) {
                targetInitialTab = 'Quotations';
                if (!action || openModal === 'NEW_QUOTATION') action = 'NEW_QUOTATION';
            } else if (tabLower.includes('stock')) {
                targetInitialTab = 'Stock';
            }

            setProfileNavState({
                tab: targetInitialTab,
                subTab: targetSubTab,
                action: action,
                timestamp: Date.now()
            });
            setCurrentTab('Profiles & Stock');
            setIsMobileNavOpen(false);
            return;
        }

        // Handle navigation to RM Section / Store Management
        if (p === 'RM Section' || p === 'Store Management' || p === 'Store') {
            if (initialTab) {
                setStoreNavState({
                    tab: initialTab,
                    timestamp: Date.now()
                });
            }
            setCurrentTab('Store Management');
            setIsMobileNavOpen(false);
            return;
        }

        const matched = navItems.find(item => item.name.toLowerCase() === p.toLowerCase());
        if (matched) {
            setCurrentTab(matched.name);
        } else {
            setCurrentTab('Dashboard');
        }
        setIsMobileNavOpen(false);
    };

    return (
        <div className="flex h-screen bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden relative">
            {/* Mobile / Tablet Backdrop Overlay */}
            {isMobileNavOpen && (
                <div 
                    onClick={() => setIsMobileNavOpen(false)}
                    className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden transition-opacity duration-300"
                    aria-hidden="true"
                />
            )}

            {/* Sidebar (Responsive: Drawer on mobile/tablet, Collapsible on PC/desktop) */}
            <aside 
                className={`
                    fixed lg:static inset-y-0 left-0 z-50 
                    ${isDesktopCollapsed ? 'lg:w-20' : 'lg:w-72'} 
                    w-72 sm:w-80
                    bg-slate-900 text-white flex flex-col border-r border-slate-800 shadow-2xl shrink-0
                    transition-all duration-300 ease-in-out
                    ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                {/* Brand Header */}
                <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30">
                            <Boxes className="w-5 h-5 text-white" />
                        </div>
                        {(!isDesktopCollapsed || isMobileNavOpen) && (
                            <div className="truncate">
                                <h1 className="text-base font-black tracking-tight uppercase text-blue-400 truncate">uPVC ERP Hub</h1>
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest truncate">Manufacturing & Store</p>
                            </div>
                        )}
                    </div>
                    {/* Mobile close button */}
                    <button 
                        onClick={() => setIsMobileNavOpen(false)}
                        className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        aria-label="Close navigation"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    {/* PC Desktop Collapse Toggle Button */}
                    <button
                        onClick={() => setIsDesktopCollapsed(prev => !prev)}
                        className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title={isDesktopCollapsed ? "Expand sidebar (PC)" : "Collapse sidebar (PC)"}
                        aria-label="Toggle sidebar collapse"
                    >
                        {isDesktopCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                </div>
                
                {/* User Info Bar */}
                <div className="px-4 sm:px-5 py-3.5 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between">
                    {(!isDesktopCollapsed || isMobileNavOpen) ? (
                        <div className="truncate mr-2">
                            <p className="text-xs font-bold text-slate-200 truncate">{store.currentUser.name}</p>
                            <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider truncate">{store.currentUser.role}</p>
                        </div>
                    ) : (
                        <div className="w-full flex justify-center">
                            <span className="w-3 h-3 rounded-full bg-emerald-500" title={`${store.currentUser.name} (${store.currentUser.role})`} />
                        </div>
                    )}
                    {(!isDesktopCollapsed || isMobileNavOpen) && (
                        <button 
                            onClick={store.logout} 
                            className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 transition-colors flex items-center gap-1 shrink-0"
                            title="Sign out of ERP system"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    )}
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700">
                    {allowedNav.map(item => {
                        const Icon = item.icon;
                        const isActive = currentTab === item.name;
                        return (
                            <button
                                key={item.name}
                                onClick={() => handleSelectTab(item.name)}
                                title={item.name}
                                className={`
                                    w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3
                                    ${isActive 
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }
                                    ${isDesktopCollapsed && !isMobileNavOpen ? 'justify-center px-0' : 'justify-start'}
                                `}
                            >
                                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                {(!isDesktopCollapsed || isMobileNavOpen) && (
                                    <span className="truncate">{item.name}</span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Bottom Company & Sync Info in sidebar */}
                {(!isDesktopCollapsed || isMobileNavOpen) && (
                    <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400">
                        <div className="flex items-center gap-2 truncate">
                            <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="truncate font-medium">{store.companySettings.name}</span>
                        </div>
                    </div>
                )}
            </aside>

            {/* Main Application Content Container */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Responsive Header Bar */}
                <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 md:px-8 flex items-center justify-between shrink-0 gap-2 z-10">
                    {/* Left: Mobile Hamburger Menu & Active Page Title */}
                    <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
                        <button
                            onClick={() => setIsMobileNavOpen(true)}
                            className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
                            aria-label="Open navigation menu"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <h2 className="text-base sm:text-lg md:text-xl font-display font-black uppercase tracking-tight text-slate-900 dark:text-white truncate">
                            {currentTab}
                        </h2>
                    </div>

                    {/* Right: Cloud / Offline Badges & Company / Sync Controls */}
                    <div className="flex items-center gap-2 sm:gap-3 text-xs font-bold shrink-0">
                        {/* Auth Provider Connection Badge */}
                        <div className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px]">
                            {store.currentUser.provider === 'google' && (
                                <span className="text-blue-500 font-bold flex items-center gap-1">
                                    <Cloud className="w-3 h-3" /> <span className="hidden md:inline">Google OAuth</span><span className="md:hidden">Google</span>
                                </span>
                            )}
                            {store.currentUser.provider === 'microsoft' && (
                                <span className="text-sky-400 font-bold flex items-center gap-1">
                                    <Cloud className="w-3 h-3" /> <span className="hidden md:inline">Microsoft OAuth</span><span className="md:hidden">MS</span>
                                </span>
                            )}
                            {store.currentUser.provider === 'yahoo' && (
                                <span className="text-purple-400 font-bold flex items-center gap-1">
                                    <Cloud className="w-3 h-3" /> <span className="hidden md:inline">Yahoo OAuth</span><span className="md:hidden">Yahoo</span>
                                </span>
                            )}
                            {(!store.currentUser.provider || store.currentUser.provider === 'offline') && (
                                <span className="text-amber-500 font-bold flex items-center gap-1">
                                    <Laptop className="w-3 h-3" /> <span className="hidden md:inline">Offline (Saved on PC)</span><span className="md:hidden">PC Mode</span>
                                </span>
                            )}
                        </div>

                        {/* Offline Sync Action Button */}
                        {store.offlinePendingCount > 0 ? (
                            <button
                                type="button"
                                onClick={() => {
                                    store.syncOfflineDataToCloud();
                                    addToast(`Synchronized ${store.offlinePendingCount} offline record(s) to Cloud storage!`, 'success');
                                }}
                                className="px-2.5 sm:px-3.5 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black flex items-center gap-1.5 transition-all shadow-md animate-pulse text-[11px] cursor-pointer"
                                title="Click to upload offline PC records to online cloud storage"
                            >
                                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                                <span>Sync <span className="underline">{store.offlinePendingCount}</span></span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    store.syncOfflineDataToCloud();
                                    addToast('Cloud database synchronized with local PC state!', 'info');
                                }}
                                className="px-2.5 sm:px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Force cloud sync"
                            >
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span className="hidden sm:inline">Synced</span>
                            </button>
                        )}

                        {/* Company Name Badge on larger screens */}
                        <span className="hidden xl:inline-block text-slate-400 dark:text-slate-600">|</span>
                        <span className="hidden xl:inline-block text-slate-500 text-[11px] truncate max-w-[160px]">
                            {store.companySettings.name}
                        </span>
                    </div>
                </header>

                {/* Main Scrollable View Area with responsive padding */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-6 lg:p-8 min-w-0">
                    {currentTab === 'Dashboard' && (
                        <Dashboard 
                            items={store.items} 
                            stockLevels={stockLevels} 
                            stats={dashboardStats} 
                            formulas={store.formulas} 
                            addToast={addToast} 
                            navigate={handleNavigate} 
                        />
                    )}

                    {currentTab === 'Store Management' && (
                        <StoreSection 
                            items={store.items}
                            stockLevels={stockLevels}
                            inflowTransactions={store.inflowTransactions}
                            consumptionTransactions={store.consumptionTransactions}
                            formulas={store.formulas}
                            suppliers={store.suppliers}
                            purchaseOrders={store.purchaseOrders}
                            addToast={addToast}
                            totalBatches={dashboardStats.totalBatches}
                            addItem={store.addItem}
                            updateItem={store.updateItem}
                            deleteItem={store.deleteItem}
                            addInflowTransaction={store.addInflowTransaction}
                            createItemAndInflow={store.createItemAndInflow}
                            updateInflowTransaction={store.updateInflowTransaction}
                            deleteInflowTransaction={store.deleteInflowTransaction}
                            addMultipleConsumptionTransactions={store.addMultipleConsumptionTransactions}
                            updateConsumptionTransaction={store.updateConsumptionTransaction}
                            deleteConsumptionTransaction={store.deleteConsumptionTransaction}
                            addFormula={store.addFormula}
                            updateFormula={store.updateFormula}
                            deleteFormula={store.deleteFormula}
                            addSupplier={store.addSupplier}
                            updateSupplier={store.updateSupplier}
                            deleteSupplier={store.deleteSupplier}
                            addPurchaseOrder={store.addPurchaseOrder}
                            updatePurchaseOrder={store.updatePurchaseOrder}
                            deletePurchaseOrder={store.deletePurchaseOrder}
                            updatePOStatus={store.updatePOStatus}
                            initialTab={storeNavState?.tab}
                        />
                    )}

                    {currentTab === 'Profiles & Stock' && (
                        <ProfileSection 
                            addToast={addToast}
                            initialTab={profileNavState?.tab}
                            initialSubTab={profileNavState?.subTab}
                            initialAction={profileNavState?.action}
                            onResetInitialAction={() => setProfileNavState(prev => prev ? { ...prev, action: null } : null)}
                        />
                    )}
                    {currentTab === 'Dies & Planning' && <DiesAndPlanning {...(store as any)} addToast={addToast} />}
                    {currentTab === 'Reports & History' && <History {...(store as any)} addToast={addToast} />}
                    {currentTab === 'Central Export Hub' && <ExportHub addToast={addToast} />}
                    {currentTab === 'Storage' && <Storage addToast={addToast} />}
                    {currentTab === 'Excel & Sheets' && <ExcelSheets addToast={addToast} />}
                    {currentTab === 'Users' && <Users addToast={addToast} />}
                    {currentTab === 'Trash' && <Trash {...(store as any)} addToast={addToast} />}
                    {currentTab === 'Import Excel' && <ImportExcel addToast={addToast} addMultipleInflowTransactions={store.addMultipleInflowTransactions} />}
                    {currentTab === 'Settings' && <Settings addToast={addToast} />}
                </div>
            </main>

            <ToastContainer toasts={toasts} dismissToast={dismissToast} />
        </div>
    );
};

export default App;
