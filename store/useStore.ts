
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Item, InflowTransaction, ConsumptionTransaction, Formula, User, ReportCorrection, Profile, ProfileTransaction, CompanySettings, Customer, Die, ProductionPlan, Mail, Supplier, PurchaseOrder, DataPlanSheetState, DataPlanColumn, DataPlanRow, AppUser, SystemSettings, ProtectiveFilmItem, ProtectiveFilmInwardTransaction, ProtectiveFilmOutwardAdjustment, SecurityAuditLog } from '../types';
import { INITIAL_DATA_PLAN_COLUMNS, INITIAL_DATA_PLAN_ROWS } from '../data/defaultDataPlan';
import { DEFAULT_PROTECTIVE_FILM_ITEMS } from '../data/defaultProtectiveFilms';
import { isReinforcementProfile } from '../utils';

const pastDate = new Date();
pastDate.setDate(pastDate.getDate() - 5);
const pastDateISO = pastDate.toISOString();

const MOCK_ITEMS: Item[] = [];
const MOCK_INFLOW_TRANSACTIONS: InflowTransaction[] = [];
const MOCK_CONSUMPTION_TRANSACTIONS: ConsumptionTransaction[] = [];
const MOCK_FORMULAS: Formula[] = [];
const MOCK_REPORT_CORRECTIONS: ReportCorrection[] = [];

const MOCK_PROFILES: Profile[] = [];

const MOCK_PROFILE_TRANSACTIONS: ProfileTransaction[] = [];


const MOCK_CUSTOMERS: Customer[] = [];

const MOCK_DIES: Die[] = [];

const MOCK_PRODUCTION_PLANS: ProductionPlan[] = [];

const MOCK_SUPPLIERS: Supplier[] = [];

const MOCK_PURCHASE_ORDERS: PurchaseOrder[] = [];

export const ALL_SYSTEM_PAGES = [
    'Dashboard', 
    'RM Section', 
    'Profiles & Stock', 
    'Dies & Planning', 
    'Production', 
    'Quotations & Sales', 
    'Shipments', 
    'Scrap', 
    'Protective Films', 
    'Reports & History', 
    'Users', 
    'Trash', 
    'Import Excel', 
    'Settings'
];

export const MOCK_APP_USERS: AppUser[] = [
    {
        id: 'u1',
        name: 'Nagarjuna Reddy',
        email: 'reddynagarjuna16@gmail.com',
        role: 'ADMIN',
        status: 'ACTIVE',
        department: 'Plant Operations & Executive',
        phone: '+91 98480 12345',
        lastLogin: new Date().toISOString(),
        createdAt: '2025-01-01T08:00:00.000Z',
        twoFactorEnabled: true,
        canExport: true,
        canDelete: true,
        canEditPricing: true,
        allowedPages: [...ALL_SYSTEM_PAGES]
    },
    {
        id: 'u2',
        name: 'Rajesh Sharma',
        email: 'rajesh.store@upvc.com',
        role: 'STORE_MANAGER',
        status: 'ACTIVE',
        department: 'RM Section & Warehouse',
        phone: '+91 98480 23456',
        lastLogin: new Date(Date.now() - 3600000 * 2).toISOString(),
        createdAt: '2025-01-05T09:30:00.000Z',
        twoFactorEnabled: false,
        canExport: true,
        canDelete: false,
        canEditPricing: false,
        allowedPages: ['Dashboard', 'RM Section', 'Profiles & Stock', 'Protective Films', 'Reports & History', 'Import Excel']
    },
    {
        id: 'u3',
        name: 'Anita Verma',
        email: 'anita.purchase@upvc.com',
        role: 'PURCHASE',
        status: 'ACTIVE',
        department: 'Procurement & Vendor Relations',
        phone: '+91 98480 34567',
        lastLogin: new Date(Date.now() - 3600000 * 5).toISOString(),
        createdAt: '2025-01-10T11:00:00.000Z',
        twoFactorEnabled: true,
        canExport: true,
        canDelete: false,
        canEditPricing: true,
        allowedPages: ['Dashboard', 'RM Section', 'Quotations & Sales', 'Reports & History']
    },
    {
        id: 'u4',
        name: 'Suresh Kumar',
        email: 'suresh.prod@upvc.com',
        role: 'MANAGEMENT',
        status: 'ACTIVE',
        department: 'Extrusion & Tooling Division',
        phone: '+91 98480 45678',
        lastLogin: new Date(Date.now() - 3600000 * 24).toISOString(),
        createdAt: '2025-01-15T07:15:00.000Z',
        twoFactorEnabled: false,
        canExport: true,
        canDelete: true,
        canEditPricing: true,
        allowedPages: ['Dashboard', 'Profiles & Stock', 'Dies & Planning', 'Production', 'Protective Films', 'Reports & History']
    },
    {
        id: 'u5',
        name: 'Vikas Patel',
        email: 'vikas.sales@upvc.com',
        role: 'SALES',
        status: 'ACTIVE',
        department: 'Domestic & Regional Sales',
        phone: '+91 98480 56789',
        lastLogin: new Date(Date.now() - 3600000 * 8).toISOString(),
        createdAt: '2025-01-20T10:45:00.000Z',
        twoFactorEnabled: false,
        canExport: false,
        canDelete: false,
        canEditPricing: true,
        allowedPages: ['Dashboard', 'Profiles & Stock', 'Quotations & Sales', 'Shipments', 'Reports & History']
    },
    {
        id: 'u6',
        name: 'Kavita Iyer',
        email: 'kavita.qa@upvc.com',
        role: 'VIEWER',
        status: 'ACTIVE',
        department: 'Quality Assurance & Audit',
        phone: '+91 98480 67890',
        lastLogin: new Date(Date.now() - 3600000 * 48).toISOString(),
        createdAt: '2025-02-01T14:20:00.000Z',
        twoFactorEnabled: false,
        canExport: true,
        canDelete: false,
        canEditPricing: false,
        allowedPages: ['Dashboard', 'Reports & History', 'Profiles & Stock', 'RM Section']
    }
];

export const MOCK_SECURITY_AUDIT_LOGS: SecurityAuditLog[] = [
    {
        id: 'log-1',
        timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
        userName: 'Nagarjuna Reddy',
        action: 'POLICY_UPDATE',
        category: 'SECURITY',
        details: 'Updated global session inactivity timeout to 60 minutes.',
        ipAddress: '192.168.1.10'
    },
    {
        id: 'log-2',
        timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
        userName: 'Nagarjuna Reddy',
        action: 'PERMISSION_GRANTED',
        category: 'PERMISSION',
        details: 'Granted "Protective Films" and "Dies & Planning" access to Suresh Kumar.',
        ipAddress: '192.168.1.10'
    },
    {
        id: 'log-3',
        timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
        userName: 'Rajesh Sharma',
        action: 'LOGIN_SUCCESS',
        category: 'AUTH',
        details: 'Authenticated via Plant Workstation #2.',
        ipAddress: '192.168.1.45'
    },
    {
        id: 'log-4',
        timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
        userName: 'Anita Verma',
        action: 'USER_MFA_ENABLED',
        category: 'SECURITY',
        details: 'Enabled Two-Factor Security Passcode verification.',
        ipAddress: '192.168.1.52'
    },
    {
        id: 'log-5',
        timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
        userName: 'System Security',
        action: 'AUDIT_VERIFIED',
        category: 'SECURITY',
        details: 'Automated AES-256 cloud encryption consistency check passed.',
        ipAddress: '127.0.0.1'
    }
];


const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
    name: 'RAVIRAJA',
    addressLine1: 'Plot No 123, Industrial Area',
    addressLine2: 'Near City Center',
    cityStateZip: 'Hyderabad, Telangana - 500001',
    gstin: '36AAAAA0000A1Z5',
    phone: '+91 98765 43210',
    email: 'info@mycompany.com',
    bankName: 'HDFC BANK',
    accountNo: '50200001234567',
    ifsc: 'HDFC0001234',
    branch: 'Main Branch',
    terms: '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if not paid within 30 days.',
    cgstRate: 9,
    sgstRate: 9,
    igstRate: 18,
    brandLogos: [], 
};

interface FilterPreset {
    id: string;
    name: string;
    searchTerm: string;
    brand: string;
}

const defaultUiState = {
    inflowFilters: { dateFrom: '', dateTo: '', itemId: '', supplier: '', quantity: '', unitCost: '' } as Record<string, string>,
    consumptionFilters: { dateFrom: '', dateTo: '', itemId: '', batchNo: '', quantity: '' } as Record<string, string>,
    profileFilters: { searchTerm: '', brand: 'All' } as Record<string, string>,
    profileFilterPresets: [] as FilterPreset[],
    lastSync: null as string | null,
};

// --- ZUSTAND STORE DEFINITION ---

interface AppState {
    // State
    currentUser: User | null;
    appUsers: AppUser[];
    securityAuditLogs: SecurityAuditLog[];
    systemSettings: SystemSettings;
    updateSystemSettings: (settings: Partial<SystemSettings>) => void;
    addAppUser: (user: Omit<AppUser, 'id' | 'createdAt'>) => void;
    updateAppUser: (user: AppUser) => void;
    deleteAppUser: (id: string) => void;
    addSecurityAuditLog: (log: Omit<SecurityAuditLog, 'id' | 'timestamp'>) => void;
    resetAppUsersToDefaults: () => void;
    items: Item[];
    inflowTransactions: InflowTransaction[];
    consumptionTransactions: ConsumptionTransaction[];
    formulas: Formula[];
    reportCorrections: ReportCorrection[];
    profiles: Profile[];
    profileTransactions: ProfileTransaction[];
    brands: string[];
    customers: Customer[];
    dies: Die[];
    productionPlans: ProductionPlan[];
    machines: string[];
    suppliers: Supplier[];
    purchaseOrders: PurchaseOrder[];
    companySettings: CompanySettings;
    mails: Mail[];
    dataPlanSheet: DataPlanSheetState;
    protectiveFilmItems: ProtectiveFilmItem[];
    protectiveFilmInwardTransactions: ProtectiveFilmInwardTransaction[];
    protectiveFilmOutwardAdjustments: ProtectiveFilmOutwardAdjustment[];
    uiState: typeof defaultUiState;
    offlinePendingCount: number;
    lastCloudSyncTimestamp: string | null;

    // General Actions
    login: (user: User) => void;
    logout: () => void;
    resetData: () => void;
    loadData: (data: any) => void;
    setLastSync: (time: string | null) => void;
    setMails: (mails: Mail[]) => void;
    syncOfflineDataToCloud: () => void;
    recordOfflineActivity: () => void;

    // Protective Films
    addProtectiveFilmItem: (item: Omit<ProtectiveFilmItem, 'id'>) => ProtectiveFilmItem;
    updateProtectiveFilmItem: (item: ProtectiveFilmItem) => void;
    deleteProtectiveFilmItem: (id: string) => void;
    resetProtectiveFilmItems: () => void;
    addProtectiveFilmInward: (tx: Omit<ProtectiveFilmInwardTransaction, 'id' | 'createdAt'>) => void;
    updateProtectiveFilmInward: (tx: ProtectiveFilmInwardTransaction) => void;
    deleteProtectiveFilmInward: (id: string) => void;
    addProtectiveFilmOutwardAdjustment: (adj: Omit<ProtectiveFilmOutwardAdjustment, 'id' | 'createdAt'>) => void;
    updateProtectiveFilmOutwardAdjustment: (adj: ProtectiveFilmOutwardAdjustment) => void;
    deleteProtectiveFilmOutwardAdjustment: (id: string) => void;
    importProtectiveFilmBatch: (newItems: Partial<ProtectiveFilmItem>[], inwardTxs?: Omit<ProtectiveFilmInwardTransaction, 'id' | 'createdAt'>[]) => void;

    // RM Items
    addItem: (item: Omit<Item, 'id' | 'createdAt'>) => Item;
    updateItem: (item: Item) => void;
    deleteItem: (itemId: string) => void;
    restoreItem: (itemId: string) => void;
    permanentlyDeleteItem: (itemId: string) => void;

    // Inflow
    addInflowTransaction: (tx: Omit<InflowTransaction, 'id' | 'createdAt' | 'totalCost'>) => void;
    addMultipleInflowTransactions: (txs: (Omit<InflowTransaction, 'id' | 'createdAt' | 'totalCost' | 'itemId'> & { sku: string, name?: string })[]) => void;
    createItemAndInflow: (itemData: Omit<Item, 'id' | 'createdAt'>, txData: Omit<InflowTransaction, 'id' | 'createdAt' | 'totalCost' | 'itemId'>) => void;
    updateInflowTransaction: (tx: InflowTransaction) => void;
    deleteInflowTransaction: (transactionId: string) => void;

    // Consumption
    addMultipleConsumptionTransactions: (txs: Omit<ConsumptionTransaction, 'id' | 'createdAt'>[]) => void;
    updateConsumptionTransaction: (tx: ConsumptionTransaction) => void;
    deleteConsumptionTransaction: (txId: string) => void;

    // Transaction Management (Generic)
    restoreTransaction: (id: string, type: 'inflow' | 'consumption') => void;
    permanentlyDeleteTransaction: (id: string, type: 'inflow' | 'consumption') => void;

    // Formulas
    addFormula: (formula: Omit<Formula, 'id' | 'createdAt'>) => void;
    updateFormula: (formula: Formula) => void;
    deleteFormula: (formulaId: string) => void;
    restoreFormula: (formulaId: string) => void;
    permanentlyDeleteFormula: (formulaId: string) => void;

    // Profile Actions
    addProfile: (profile: Omit<Profile, 'id' | 'createdAt'>) => Profile;
    addProfiles: (profiles: Omit<Profile, 'id' | 'createdAt'>[]) => Profile[];
    insertProfileAt: (profile: Omit<Profile, 'id' | 'createdAt'>, relativeId?: string | null, position?: 'above' | 'below') => Profile;
    syncProfilesToStock: () => void;
    syncProfileSpecsBySku: (sourceProfileId: string) => void;
    pushStandardCatalogueToAll: (sourceBrand?: string) => { syncedProfiles: number; syncedFilms: number; syncedBrands: number };
    syncBrandDataToAllTabs: (targetBrand?: string) => { profilesCount: number; filmsCount: number; diesCount: number; brand: string };
    deduplicateProfiles: () => number;
    updateProfile: (profile: Profile) => void;
    deleteProfile: (id: string) => void;
    restoreProfile: (id: string) => void;
    permanentlyDeleteProfile: (id: string) => void;

    addProfileTransaction: (tx: Omit<ProfileTransaction, 'id' | 'createdAt'>) => void;
    updateProfileTransaction: (tx: ProfileTransaction) => void;
    deleteProfileTransaction: (id: string) => void;
    restoreProfileTransaction: (id: string) => void;
    permanentlyDeleteProfileTransaction: (id: string) => void;
    resolveQuotation: (id: string, action: 'CONFIRM_DISPATCH' | 'CONFIRM_RETURN' | 'CANCEL') => void;
    resetCatalogueAndQuotations: () => void;

    // Customers
    addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'deletedAt'>) => void;
    updateCustomer: (customer: Customer) => void;
    deleteCustomer: (id: string) => void;

    // Brands
    addBrand: (brand: string) => void;
    updateBrand: (oldB: string, newB: string) => void;
    deleteBrand: (brand: string, options?: { reassignTo?: string; deleteItems?: boolean }) => void;

    // Dies & Plans
    addDie: (die: Omit<Die, 'id' | 'createdAt'>) => void;
    updateDie: (die: Die) => void;
    deleteDie: (id: string) => void;
    restoreDie: (id: string) => void;
    permanentlyDeleteDie: (id: string) => void;

    addProductionPlan: (plan: Omit<ProductionPlan, 'id' | 'createdAt'>) => void;
    updateProductionPlan: (plan: ProductionPlan) => void;
    deleteProductionPlan: (id: string) => void;
    restoreProductionPlan: (id: string) => void;
    permanentlyDeleteProductionPlan: (id: string) => void;

    // Machines
    addMachine: (machine: string) => void;
    deleteMachine: (machine: string) => void;

    // Suppliers
    addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void;
    updateSupplier: (supplier: Supplier) => void;
    deleteSupplier: (id: string) => void;

    // Purchase Orders
    addPurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updatePurchaseOrder: (po: PurchaseOrder) => void;
    deletePurchaseOrder: (id: string) => void;
    updatePOStatus: (id: string, status: PurchaseOrder['status']) => void;

    // Other actions
    addOrUpdateReportCorrection: (correction: Omit<ReportCorrection, 'updatedAt'>) => void;
    updateCompanySettings: (settings: CompanySettings) => void;
    setInflowFilters: (filters: Record<string, string>) => void;
    setConsumptionFilters: (filters: Record<string, string>) => void;
    setProfileFilters: (filters: Record<string, string>) => void;
    saveProfileFilterPreset: (name: string, filters: { searchTerm: string, brand: string }) => void;
    deleteProfileFilterPreset: (id: string) => void;
    setDataPlanSheet: (sheet: DataPlanSheetState) => void;
    updateDataPlanSheet: (updater: (prev: DataPlanSheetState) => DataPlanSheetState) => void;
    resetDataPlanSheet: () => void;
}

const safeLocalStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name);
    } catch (e) {
      console.warn('Failed to read from localStorage:', e);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      console.warn('localStorage setItem quota exceeded, pruning history to prevent crash...', e);
      try {
        const parsed = JSON.parse(value);
        if (parsed && parsed.state) {
          if (Array.isArray(parsed.state.securityAuditLogs)) {
            parsed.state.securityAuditLogs = parsed.state.securityAuditLogs.slice(-10);
          }
          if (Array.isArray(parsed.state.profileTransactions)) {
            parsed.state.profileTransactions = parsed.state.profileTransactions.slice(-150);
          }
          if (Array.isArray(parsed.state.protectiveFilmInwardTransactions)) {
            parsed.state.protectiveFilmInwardTransactions = parsed.state.protectiveFilmInwardTransactions.slice(-150);
          }
          if (Array.isArray(parsed.state.protectiveFilmOutwardAdjustments)) {
            parsed.state.protectiveFilmOutwardAdjustments = parsed.state.protectiveFilmOutwardAdjustments.slice(-150);
          }
          if (Array.isArray(parsed.state.inflowTransactions)) {
            parsed.state.inflowTransactions = parsed.state.inflowTransactions.slice(-150);
          }
          if (Array.isArray(parsed.state.consumptionTransactions)) {
            parsed.state.consumptionTransactions = parsed.state.consumptionTransactions.slice(-150);
          }
          const prunedValue = JSON.stringify(parsed);
          localStorage.setItem(name, prunedValue);
        }
      } catch (innerErr) {
        console.warn('Pruned setItem retry failed, using sessionStorage fallback:', innerErr);
        try {
          sessionStorage.setItem(name, value);
        } catch (sErr) {
          // Swallow exception to prevent component crash during state updates
        }
      }
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.warn('Failed to remove item from localStorage:', e);
    }
  }
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      appUsers: MOCK_APP_USERS,
      securityAuditLogs: MOCK_SECURITY_AUDIT_LOGS,
      systemSettings: {
        gmailAccessLevel: 'Basic',
        syncEnabled: true,
        sessionTimeoutMinutes: 60,
        requireTwoFactor: false,
        singleSessionPerUser: true,
        maskPricingForStandardUsers: false,
        allowDataExport: true,
        emergencyReadOnlyMode: false,
        lockBackdatedEntriesDays: 3,
        auditLoggingEnabled: true,
        allowedIpRanges: '192.168.1.0/24, 10.0.0.0/16',
      },
      updateSystemSettings: (settings) => set(state => ({ 
        systemSettings: { ...state.systemSettings, ...settings } 
      })),
      items: MOCK_ITEMS,
      inflowTransactions: MOCK_INFLOW_TRANSACTIONS,
      consumptionTransactions: MOCK_CONSUMPTION_TRANSACTIONS,
      formulas: MOCK_FORMULAS,
      reportCorrections: MOCK_REPORT_CORRECTIONS,
      profiles: [],
      profileTransactions: [],
      brands: [],
      customers: MOCK_CUSTOMERS,
      dies: MOCK_DIES,
      productionPlans: MOCK_PRODUCTION_PLANS,
      machines: ['Machine 1', 'Machine 2', 'Machine 3', 'Machine 4', 'Machine 5', 'Machine 6', 'Line 1 (Twin Screw)', 'Line 2 (Single Screw)'],
      suppliers: MOCK_SUPPLIERS,
      purchaseOrders: MOCK_PURCHASE_ORDERS,
      companySettings: DEFAULT_COMPANY_SETTINGS,
      mails: [],
      dataPlanSheet: {
        columns: INITIAL_DATA_PLAN_COLUMNS,
        rows: INITIAL_DATA_PLAN_ROWS,
        selectedBrandFilter: 'ALL',
        lastSaved: new Date().toISOString()
      },
      protectiveFilmItems: DEFAULT_PROTECTIVE_FILM_ITEMS,
      protectiveFilmInwardTransactions: [],
      protectiveFilmOutwardAdjustments: [],
      uiState: defaultUiState,
      offlinePendingCount: 0,
      lastCloudSyncTimestamp: new Date().toISOString(),

      recordOfflineActivity: () => set(state => ({ offlinePendingCount: (state.offlinePendingCount || 0) + 1 })),
      syncOfflineDataToCloud: () => set(state => {
        const count = state.offlinePendingCount || 0;
        const providerName = state.currentUser?.provider ? state.currentUser.provider.toUpperCase() : 'CLOUD';
        const log: SecurityAuditLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userName: state.currentUser?.name || 'Local User',
          action: 'CLOUD_SYNC',
          category: 'AUTH',
          details: `Synchronized ${count} offline record(s) from this PC to ${providerName} Cloud Storage.`
        };
        return {
          offlinePendingCount: 0,
          lastCloudSyncTimestamp: new Date().toISOString(),
          securityAuditLogs: [log, ...(state.securityAuditLogs || [])].slice(0, 100)
        };
      }),

      addProtectiveFilmItem: (item) => {
          const newItem: ProtectiveFilmItem = { ...item, id: `pf_${Date.now()}` };
          set(state => ({ protectiveFilmItems: [...state.protectiveFilmItems, newItem] }));
          return newItem;
      },
      updateProtectiveFilmItem: (item) => set(state => ({
          protectiveFilmItems: state.protectiveFilmItems.map(p => p.id === item.id ? item : p)
      })),
      deleteProtectiveFilmItem: (id) => set(state => ({
          protectiveFilmItems: state.protectiveFilmItems.filter(p => p.id !== id)
      })),
      resetProtectiveFilmItems: () => set({ protectiveFilmItems: DEFAULT_PROTECTIVE_FILM_ITEMS }),
      addProtectiveFilmInward: (tx) => set(state => ({
          protectiveFilmInwardTransactions: [...state.protectiveFilmInwardTransactions, { ...tx, id: `pfin_${Date.now()}`, createdAt: new Date().toISOString() }]
      })),
      updateProtectiveFilmInward: (tx) => set(state => ({
          protectiveFilmInwardTransactions: state.protectiveFilmInwardTransactions.map(t => t.id === tx.id ? tx : t)
      })),
      deleteProtectiveFilmInward: (id) => set(state => ({
          protectiveFilmInwardTransactions: state.protectiveFilmInwardTransactions.filter(t => t.id !== id)
      })),
      addProtectiveFilmOutwardAdjustment: (adj) => set(state => ({
          protectiveFilmOutwardAdjustments: [...state.protectiveFilmOutwardAdjustments, { ...adj, id: `pfadj_${Date.now()}`, createdAt: new Date().toISOString() }]
      })),
      updateProtectiveFilmOutwardAdjustment: (adj) => set(state => ({
          protectiveFilmOutwardAdjustments: state.protectiveFilmOutwardAdjustments.map(a => a.id === adj.id ? adj : a)
      })),
      deleteProtectiveFilmOutwardAdjustment: (id) => set(state => ({
          protectiveFilmOutwardAdjustments: state.protectiveFilmOutwardAdjustments.filter(a => a.id !== id)
      })),
      importProtectiveFilmBatch: (newItems, inwardTxs = []) => set(state => {
          let updatedItems = [...state.protectiveFilmItems];
          let updatedBrands = [...state.brands];

          newItems.forEach(item => {
              if (!item.profileCode) return;
              const brandName = (item.brand || 'Scraft').trim();
              if (!updatedBrands.some(b => b.toLowerCase() === brandName.toLowerCase())) {
                  updatedBrands.push(brandName);
              }

              // Try exact match on profileCode + brand
              let existingIdx = updatedItems.findIndex(p => 
                  p.profileCode.toLowerCase() === item.profileCode!.toLowerCase() &&
                  (p.brand || 'General').toLowerCase() === brandName.toLowerCase()
              );

              // Fallback match on profileCode + General / unassigned brand
              if (existingIdx < 0) {
                  existingIdx = updatedItems.findIndex(p => 
                      p.profileCode.toLowerCase() === item.profileCode!.toLowerCase() &&
                      (!p.brand || p.brand === 'General' || p.brand === 'Scraft')
                  );
              }

              // Fallback match on profileCode alone
              if (existingIdx < 0) {
                  existingIdx = updatedItems.findIndex(p => 
                      p.profileCode.toLowerCase() === item.profileCode!.toLowerCase()
                  );
              }

              if (existingIdx >= 0) {
                  const existing = updatedItems[existingIdx];
                  updatedItems[existingIdx] = {
                      ...existing,
                      ...item,
                      brand: brandName,
                      topFilmWidth: item.topFilmWidth !== undefined && item.topFilmWidth !== '' ? item.topFilmWidth : existing.topFilmWidth,
                      topStickerName: item.topStickerName !== undefined ? item.topStickerName : existing.topStickerName,
                      bottomFilmWidth: item.bottomFilmWidth !== undefined && item.bottomFilmWidth !== '' ? item.bottomFilmWidth : existing.bottomFilmWidth,
                      bottomStickerName: item.bottomStickerName !== undefined ? item.bottomStickerName : existing.bottomStickerName,
                      description: item.description || existing.description,
                      series: item.series || existing.series,
                      topInwardMeters: item.topInwardMeters !== undefined ? item.topInwardMeters : existing.topInwardMeters,
                      bottomInwardMeters: item.bottomInwardMeters !== undefined ? item.bottomInwardMeters : existing.bottomInwardMeters,
                  };
              } else {
                  updatedItems.push({
                      id: `pf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                      sNo: updatedItems.length + 1,
                      series: item.series || '80.5 SERIES',
                      description: item.description || item.profileCode!,
                      profileCode: item.profileCode!,
                      topFilmWidth: item.topFilmWidth || '38',
                      topStickerName: item.topStickerName || '',
                      bottomFilmWidth: item.bottomFilmWidth || '38',
                      bottomStickerName: item.bottomStickerName || '',
                      topInwardMeters: item.topInwardMeters || 0,
                      bottomInwardMeters: item.bottomInwardMeters || 0,
                      eachLengthMtrs: item.eachLengthMtrs || 5.9,
                      topMtrPerLength: item.topMtrPerLength || 5.9,
                      bottomMtrPerLength: item.bottomMtrPerLength || 5.9,
                      brand: brandName,
                      ...item
                  });
              }
          });

          const newInwards: ProtectiveFilmInwardTransaction[] = inwardTxs.map((tx, idx) => ({
              ...tx,
              id: `pfin_${Date.now()}_${idx}`,
              createdAt: new Date().toISOString()
          }));

          return {
              brands: updatedBrands,
              protectiveFilmItems: updatedItems,
              protectiveFilmInwardTransactions: [...state.protectiveFilmInwardTransactions, ...newInwards]
          };
      }),

      
      addAppUser: (user) => set(state => {
        const newUser: AppUser = { ...user, id: `u${Date.now()}`, createdAt: new Date().toISOString() };
        const updatedUsers = [...state.appUsers, newUser];
        const newLog: SecurityAuditLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userName: state.currentUser?.name || 'System Administrator',
          action: 'USER_CREATED',
          category: 'USER_MANAGEMENT',
          details: `Created new user account: ${user.name} (${user.role})`
        };
        return {
          appUsers: updatedUsers,
          securityAuditLogs: [newLog, ...(state.securityAuditLogs || [])].slice(0, 100)
        };
      }),
      updateAppUser: (user) => set(state => {
        const updatedUsers = state.appUsers.map(u => u.id === user.id ? user : u);
        const newLog: SecurityAuditLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userName: state.currentUser?.name || 'System Administrator',
          action: 'USER_UPDATED',
          category: 'USER_MANAGEMENT',
          details: `Updated user profile/permissions for: ${user.name} (${user.role})`
        };
        return {
          appUsers: updatedUsers,
          securityAuditLogs: [newLog, ...(state.securityAuditLogs || [])].slice(0, 100)
        };
      }),
      deleteAppUser: (id) => set(state => {
        const target = state.appUsers.find(u => u.id === id);
        const newLog: SecurityAuditLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userName: state.currentUser?.name || 'System Administrator',
          action: 'USER_DELETED',
          category: 'USER_MANAGEMENT',
          details: `Removed user account: ${target?.name || id}`
        };
        return {
          appUsers: state.appUsers.filter(u => u.id !== id),
          securityAuditLogs: [newLog, ...(state.securityAuditLogs || [])].slice(0, 100)
        };
      }),
      addSecurityAuditLog: (log) => set(state => ({
        securityAuditLogs: [
          {
            ...log,
            id: `log-${Date.now()}`,
            timestamp: new Date().toISOString()
          },
          ...(state.securityAuditLogs || [])
        ].slice(0, 100)
      })),
      resetAppUsersToDefaults: () => set(state => {
        const resetLog: SecurityAuditLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          userName: state.currentUser?.name || 'System Administrator',
          action: 'RESET_DEFAULTS',
          category: 'SECURITY',
          details: 'Reset system team directory and role permissions to standard templates.'
        };
        return {
          appUsers: MOCK_APP_USERS,
          securityAuditLogs: [resetLog, ...(state.securityAuditLogs || [])].slice(0, 100)
        };
      }),

      login: (user) => set(state => {
        const isOnline = user.provider && user.provider !== 'offline';
        const pendingCount = state.offlinePendingCount || 0;
        const now = new Date().toISOString();
        let auditLogs = state.securityAuditLogs || [];

        if (isOnline && pendingCount > 0) {
          const syncLog: SecurityAuditLog = {
            id: `log-${Date.now()}`,
            timestamp: now,
            userName: user.name,
            action: 'OFFLINE_AUTO_SYNC',
            category: 'AUTH',
            details: `Auto-synchronized ${pendingCount} local PC offline record(s) into ${user.provider.toUpperCase()} Cloud Storage upon user authentication.`
          };
          auditLogs = [syncLog, ...auditLogs].slice(0, 100);
        }

        const loginLog: SecurityAuditLog = {
          id: `log-${Date.now() + 1}`,
          timestamp: now,
          userName: user.name,
          action: 'USER_LOGIN',
          category: 'AUTH',
          details: `Logged in via ${user.provider ? user.provider.toUpperCase() : 'STANDARD'} OAuth mode as ${user.role}.`
        };

        return {
          currentUser: user,
          offlinePendingCount: isOnline ? 0 : state.offlinePendingCount,
          lastCloudSyncTimestamp: isOnline ? now : state.lastCloudSyncTimestamp,
          securityAuditLogs: [loginLog, ...auditLogs].slice(0, 100)
        };
      }),
      logout: () => set({ currentUser: null, mails: [] }),
      resetData: () => set({ items: [], inflowTransactions: [], consumptionTransactions: [], formulas: [], reportCorrections: [], profiles: [], profileTransactions: [], brands: [], customers: [], dies: [], productionPlans: [], suppliers: [], purchaseOrders: [], mails: [] }),
      loadData: (data) => set(state => ({ ...state, ...data })),
      setLastSync: (time) => set(state => ({ uiState: { ...state.uiState, lastSync: time } })),
      setMails: (mails) => set({ mails }),

      addItem: (item) => {
          const newItem = { ...item, id: `i${Date.now()}`, createdAt: new Date().toISOString() };
          set(state => ({ items: [...state.items, newItem] }));
          return newItem;
      },
      updateItem: (item) => set(state => ({ items: state.items.map(i => i.id === item.id ? item : i) })),
      deleteItem: (id) => set(state => ({ items: state.items.map(i => i.id === id ? { ...i, deletedAt: new Date().toISOString() } : i) })),
      restoreItem: (id) => set(state => ({ items: state.items.map(i => i.id === id ? { ...i, deletedAt: null } : i) })),
      permanentlyDeleteItem: (id) => set(state => ({ items: state.items.filter(i => i.id !== id) })),

      addInflowTransaction: (tx) => set(state => ({ inflowTransactions: [...state.inflowTransactions, { ...tx, id: `t${Date.now()}`, totalCost: tx.quantity * tx.unitCost, createdAt: new Date().toISOString() }] })),
      addMultipleInflowTransactions: (txs) => set(state => {
          const updatedItems = [...state.items];
          const newTxs: InflowTransaction[] = [];
          txs.forEach(tx => {
              let itemIndex = updatedItems.findIndex(i => i.sku.toLowerCase() === tx.sku.toLowerCase());
              let itemId = '';
              if (itemIndex >= 0) {
                  const existing = updatedItems[itemIndex];
                  updatedItems[itemIndex] = {
                      ...existing,
                      name: tx.name || existing.name,
                      costPrice: tx.unitCost !== undefined ? tx.unitCost : existing.costPrice
                  };
                  itemId = existing.id;
              } else {
                  const newItem: Item = {
                      id: `i${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                      sku: tx.sku,
                      name: tx.name || tx.sku,
                      category: 'Raw Material',
                      uom: 'kg',
                      reorderPoint: 0,
                      costPrice: tx.unitCost,
                      createdAt: new Date().toISOString()
                  };
                  updatedItems.push(newItem);
                  itemId = newItem.id;
              }
              newTxs.push({
                  ...tx,
                  id: `t${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  itemId,
                  totalCost: tx.quantity * tx.unitCost,
                  warehouseId: 'wh1',
                  createdAt: new Date().toISOString()
              });
          });
          return { items: updatedItems, inflowTransactions: [...state.inflowTransactions, ...newTxs] };
      }),
      createItemAndInflow: (itemData, txData) => set(state => {
          const existingIndex = state.items.findIndex(i => i.sku.toLowerCase() === itemData.sku.toLowerCase());
          let items = [...state.items];
          let itemId = '';
          if (existingIndex >= 0) {
              items[existingIndex] = { ...items[existingIndex], ...itemData };
              itemId = items[existingIndex].id;
          } else {
              const newItem = { ...itemData, id: `i${Date.now()}`, createdAt: new Date().toISOString() };
              items.push(newItem);
              itemId = newItem.id;
          }
          const newTx = { ...txData, id: `t${Date.now()}`, itemId, totalCost: txData.quantity * txData.unitCost, createdAt: new Date().toISOString() };
          return { items, inflowTransactions: [...state.inflowTransactions, newTx] };
      }),
      updateInflowTransaction: (tx) => set(state => ({ inflowTransactions: state.inflowTransactions.map(t => t.id === tx.id ? tx : t) })),
      deleteInflowTransaction: (id) => set(state => ({ inflowTransactions: state.inflowTransactions.map(t => t.id === id ? { ...t, deletedAt: new Date().toISOString() } : t) })),

      addMultipleConsumptionTransactions: (txs) => set(state => ({ consumptionTransactions: [...state.consumptionTransactions, ...txs.map(tx => ({ ...tx, id: `c${Date.now()}_${Math.random()}`, createdAt: new Date().toISOString() }))] })),
      updateConsumptionTransaction: (tx) => set(state => ({ consumptionTransactions: state.consumptionTransactions.map(t => t.id === tx.id ? tx : t) })),
      deleteConsumptionTransaction: (id) => set(state => ({ consumptionTransactions: state.consumptionTransactions.map(t => t.id === id ? { ...t, deletedAt: new Date().toISOString() } : t) })),

      restoreTransaction: (id, type) => set(state => {
          if (type === 'inflow') return { inflowTransactions: state.inflowTransactions.map(t => t.id === id ? { ...t, deletedAt: null } : t) };
          return { consumptionTransactions: state.consumptionTransactions.map(t => t.id === id ? { ...t, deletedAt: null } : t) };
      }),
      permanentlyDeleteTransaction: (id, type) => set(state => {
          if (type === 'inflow') return { inflowTransactions: state.inflowTransactions.filter(t => t.id !== id) };
          return { consumptionTransactions: state.consumptionTransactions.filter(t => t.id !== id) };
      }),

      addFormula: (formula) => set(state => ({ formulas: [...state.formulas, { ...formula, id: `f${Date.now()}`, createdAt: new Date().toISOString() }] })),
      updateFormula: (formula) => set(state => ({ formulas: state.formulas.map(f => f.id === formula.id ? formula : f) })),
      deleteFormula: (id) => set(state => ({ formulas: state.formulas.map(f => f.id === id ? { ...f, deletedAt: new Date().toISOString() } : f) })),
      restoreFormula: (id) => set(state => ({ formulas: state.formulas.map(f => f.id === id ? { ...f, deletedAt: null } : f) })),
      permanentlyDeleteFormula: (id) => set(state => ({ formulas: state.formulas.filter(f => f.id !== id) })),

      // Profile Actions
      addProfile: (profile) => {
          const profBrand = (profile.brand || 'General').trim();

          // Auto-register brand if not present in brands list
          const currentBrands = get().brands || [];
          if (profBrand && !currentBrands.some(b => b.toLowerCase() === profBrand.toLowerCase())) {
              set({ brands: [...currentBrands, profBrand] });
          }

          const isMerged = !!profile.isMerged;
          const hasSku = !isMerged && !!profile.sku?.trim();
          const isReinforcement = profile.profileType === 'REINFORCEMENT' || 
              profBrand.toLowerCase() === 'reinforcement' ||
              (profile.category && (
                  profile.category.toLowerCase().includes('reinforc') || 
                  profile.category.toLowerCase().includes('steel') || 
                  profile.category.toLowerCase().includes('gi') || 
                  profile.category.toLowerCase().includes('galvanis') || 
                  profile.category.toLowerCase().includes('galvaniz')
              )) ||
              (profile.name && (
                  profile.name.toLowerCase().includes('reinforc') || 
                  profile.name.toLowerCase().includes('galvanis') || 
                  profile.name.toLowerCase().includes('galvaniz') || 
                  profile.name.toLowerCase().includes('steel') || 
                  profile.name.toLowerCase().includes('gi ') || 
                  profile.name.toLowerCase().includes('gi-') || 
                  profile.name.toLowerCase().includes('gi reinf')
              )) ||
              (profile.sku && (
                  profile.sku.toLowerCase().startsWith('reinf') || 
                  profile.sku.toLowerCase().startsWith('gi-') || 
                  profile.sku.toLowerCase().startsWith('steel-') || 
                  /\b\d+x\d+(?:x\d+)?\b/i.test(profile.sku)
              )) ||
              (profile.hsnCode && (profile.hsnCode.startsWith('7216') || profile.hsnCode === '72169910'));

          const resolvedType = isReinforcement ? 'REINFORCEMENT' : (profile.profileType || 'WINDOW');
          const resolvedCategory = isReinforcement 
              ? (profile.category || 'GI Reinforcement') 
              : (profile.category || '80.5 SERIES');
          const resolvedHsn = isReinforcement ? (profile.hsnCode || '72169910') : (profile.hsnCode || '39162099');

          const profileWithResolvedType = {
              ...profile,
              profileType: resolvedType,
              category: resolvedCategory,
              hsnCode: resolvedHsn,
              brand: profBrand
          };

          const state = get();
          let updatedProfiles = [...state.profiles];
          let updatedFilms = [...state.protectiveFilmItems];

          const existingIdx = hasSku ? updatedProfiles.findIndex(p => 
              !p.isMerged &&
              p.sku.toLowerCase() === profile.sku.toLowerCase() && 
              (
                  (p.brand || 'General').toLowerCase() === profBrand.toLowerCase() ||
                  (isReinforcement && (
                      p.profileType === 'REINFORCEMENT' || 
                      (p.brand || '').toLowerCase() === 'reinforcement' ||
                      (p.category || '').toLowerCase().includes('reinforce') ||
                      (p.category || '').toLowerCase().includes('steel') ||
                      (p.category || '').toLowerCase().includes('gi')
                  ))
              )
          ) : -1;
          
          let resolvedProfile: Profile;

          if (existingIdx >= 0) {
              const existing = updatedProfiles[existingIdx];
              const updated: Profile = { 
                  ...existing, 
                  ...profileWithResolvedType, 
                  id: existing.id, 
                  brand: profBrand,
                  meterWeight: profile.meterWeight !== undefined ? profile.meterWeight : (existing as any).meterWeight
              };
              updatedProfiles[existingIdx] = updated;

              // Also sync corresponding protective film / stock item if present (skip for reinforcements)
              if (!isReinforcement) {
                  const filmIdx = updatedFilms.findIndex(f => 
                      f.profileCode.toLowerCase() === profile.sku.toLowerCase() && 
                      (f.brand || 'General').toLowerCase() === profBrand.toLowerCase()
                  );
                  if (filmIdx >= 0) {
                      updatedFilms[filmIdx] = {
                          ...updatedFilms[filmIdx],
                          description: profile.name || updatedFilms[filmIdx].description,
                          series: resolvedCategory || updatedFilms[filmIdx].series,
                          lengthsPerPacket: profile.piecesPerPacket || updatedFilms[filmIdx].lengthsPerPacket,
                          eachLengthMtrs: profile.length || updatedFilms[filmIdx].eachLengthMtrs,
                          meterWeight: profile.weight || updatedFilms[filmIdx].meterWeight,
                          lengthWeightWithGasket: profile.weight || updatedFilms[filmIdx].lengthWeightWithGasket,
                          topFilmWidth: profile.topFilmWidth !== undefined ? profile.topFilmWidth : updatedFilms[filmIdx].topFilmWidth,
                          topStickerName: profile.topStickerName !== undefined ? profile.topStickerName : updatedFilms[filmIdx].topStickerName,
                          bottomFilmWidth: profile.bottomFilmWidth !== undefined ? profile.bottomFilmWidth : updatedFilms[filmIdx].bottomFilmWidth,
                          bottomStickerName: profile.bottomStickerName !== undefined ? profile.bottomStickerName : updatedFilms[filmIdx].bottomStickerName,
                      };
                  }
              }
              set({ profiles: updatedProfiles, protectiveFilmItems: updatedFilms });
              resolvedProfile = updated;
          } else {
              const newProfile: Profile = { 
                  ...profileWithResolvedType, 
                  id: `p${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, 
                  createdAt: new Date().toISOString(), 
                  brand: profBrand 
              };
              const newFilmItem: ProtectiveFilmItem = {
                  id: `pf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  sNo: 0,
                  series: resolvedCategory || '80.5 SERIES',
                  description: profile.name,
                  profileCode: profile.sku,
                  packets: '',
                  lengthsPerPacket: profile.piecesPerPacket || 6,
                  eachLengthMtrs: profile.length || 5.9,
                  meterWeight: profile.weight || 0,
                  lengthWeightWithGasket: profile.weight || 0,
                  topFilmWidth: profile.topFilmWidth || '38',
                  topInwardMeters: 0,
                  topMtrPerLength: profile.length || 5.9,
                  topStickerName: profile.topStickerName || '',
                  bottomFilmWidth: profile.bottomFilmWidth || '38',
                  bottomInwardMeters: 0,
                  bottomMtrPerLength: profile.length || 5.9,
                  bottomStickerName: profile.bottomStickerName || '',
                  brand: profBrand
              };
              set(state => ({ 
                  profiles: [...state.profiles, newProfile],
                  protectiveFilmItems: (isMerged || isReinforcement) ? state.protectiveFilmItems : [...state.protectiveFilmItems, newFilmItem]
              }));
              resolvedProfile = newProfile;
          }

          // Check if initial opening stock was provided (> 0)
          const openingStock = Number(
              profile.openingStock || 
              (profile as any).currentStock || 
              (profile as any).initialStock || 
              (profile as any).stock || 
              0
          );
          if (openingStock > 0 && !isMerged) {
              const existingTx = get().profileTransactions.find(t => 
                  t.profileId === resolvedProfile.id && 
                  t.refNo === `INIT-${resolvedProfile.sku}`
              );
              if (!existingTx) {
                  const initTx: ProfileTransaction = {
                      id: `pt_init_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                      profileId: resolvedProfile.id,
                      brand: profBrand,
                      type: 'PRODUCTION',
                      quantity: openingStock,
                      piecesPerPacket: resolvedProfile.piecesPerPacket || 1,
                      weight: resolvedProfile.weight || 0,
                      unitPrice: resolvedProfile.price || 0,
                      date: new Date().toISOString(),
                      status: 'COMPLETED',
                      refNo: `INIT-${resolvedProfile.sku}`,
                      notes: 'Initial opening stock balance',
                      createdAt: new Date().toISOString()
                  };
                  set(state => ({ profileTransactions: [...state.profileTransactions, initTx] }));
              }
          }

          // Auto-provision corresponding Extrusion Die if not existing (only for PVC window profiles)
          if (!isMerged && resolvedProfile.sku?.trim() && !isReinforcement) {
              const existingDie = get().dies.find(d => 
                  !d.deletedAt && 
                  (d.profileId === resolvedProfile.id || d.dieNo.toLowerCase() === `die-${resolvedProfile.sku}`.toLowerCase())
              );
              if (!existingDie) {
                  const autoDie: Die = {
                      id: `die_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                      dieNo: `DIE-${resolvedProfile.sku}`,
                      profileId: resolvedProfile.id,
                      brand: profBrand,
                      cavities: resolvedProfile.piecesPerPacket && resolvedProfile.piecesPerPacket <= 4 ? 2 : 1,
                      expectedOutputKgHr: 120,
                      lifespanMeters: 50000,
                      status: 'ACTIVE',
                      createdAt: new Date().toISOString()
                  };
                  set(state => ({ dies: [...state.dies, autoDie] }));
              }
          }

          get().pushStandardCatalogueToAll();
          return resolvedProfile;
      },
      addProfiles: (profilesList) => {
          const state = get();
          const currentBrands = [...(state.brands || [])];
          let updatedProfiles = [...state.profiles];
          let updatedFilms = [...state.protectiveFilmItems];
          const newTransactions: ProfileTransaction[] = [];
          const resolvedList: Profile[] = [];

          profilesList.forEach((profile, idx) => {
              const profBrand = (profile.brand || 'General').trim();
              if (profBrand && !currentBrands.some(b => b.toLowerCase() === profBrand.toLowerCase())) {
                  currentBrands.push(profBrand);
              }

              const isMerged = !!profile.isMerged;
              const hasSku = !isMerged && !!profile.sku?.trim();
              const isReinforcement = isReinforcementProfile(profile);

              const resolvedType = isReinforcement ? 'REINFORCEMENT' : (profile.profileType || 'WINDOW');
              const resolvedCategory = isReinforcement 
                  ? (profile.category || 'GI Reinforcement') 
                  : (profile.category || '80.5 SERIES');
              const resolvedHsn = isReinforcement ? (profile.hsnCode || '72169910') : (profile.hsnCode || '39162099');

              const profileWithResolvedType = {
                  ...profile,
                  profileType: resolvedType,
                  category: resolvedCategory,
                  hsnCode: resolvedHsn,
                  brand: profBrand
              };

              const existingIdx = hasSku ? updatedProfiles.findIndex(p => 
                  !p.isMerged &&
                  p.sku.toLowerCase() === profile.sku.toLowerCase() && 
                  (
                      (p.brand || 'General').toLowerCase() === profBrand.toLowerCase() ||
                      (isReinforcement && (
                          p.profileType === 'REINFORCEMENT' || 
                          (p.brand || '').toLowerCase() === 'reinforcement' ||
                          (p.category || '').toLowerCase().includes('reinforce') ||
                          (p.category || '').toLowerCase().includes('steel') ||
                          (p.category || '').toLowerCase().includes('gi')
                      ))
                  )
              ) : -1;

              if (existingIdx >= 0) {
                  const existing = updatedProfiles[existingIdx];
                  const updated: Profile = {
                      ...existing,
                      ...profileWithResolvedType,
                      id: existing.id,
                      brand: profBrand,
                      meterWeight: profile.meterWeight !== undefined ? profile.meterWeight : (existing as any).meterWeight
                  };
                  updatedProfiles[existingIdx] = updated;
                  resolvedList.push(updated);
              } else {
                  const newProfile: Profile = {
                      ...profileWithResolvedType,
                      id: `p${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
                      createdAt: new Date().toISOString(),
                      brand: profBrand
                  };
                  updatedProfiles.push(newProfile);
                  resolvedList.push(newProfile);

                  if (!isMerged && !isReinforcement && newProfile.sku?.trim()) {
                      updatedFilms.push({
                          id: `pf_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
                          sNo: updatedFilms.length + 1,
                          series: resolvedCategory,
                          description: profile.name,
                          profileCode: profile.sku,
                          packets: '',
                          lengthsPerPacket: profile.piecesPerPacket || 6,
                          eachLengthMtrs: profile.length || 5.9,
                          meterWeight: profile.weight || 0,
                          lengthWeightWithGasket: profile.weight || 0,
                          topFilmWidth: profile.topFilmWidth || '38',
                          topInwardMeters: 0,
                          topMtrPerLength: profile.length || 5.9,
                          topStickerName: profile.topStickerName || '',
                          bottomFilmWidth: profile.bottomFilmWidth || '38',
                          bottomInwardMeters: 0,
                          bottomMtrPerLength: profile.length || 5.9,
                          bottomStickerName: profile.bottomStickerName || '',
                          brand: profBrand
                      });
                  }
              }

              const openingStock = Number(
                  profile.openingStock || 
                  (profile as any).currentStock || 
                  (profile as any).initialStock || 
                  (profile as any).stock || 
                  0
              );
              if (openingStock > 0 && !isMerged && profile.sku?.trim()) {
                  const targetId = resolvedList[resolvedList.length - 1].id;
                  
                  // Fix: Check if this profile already has an INIT transaction to prevent double data
                  const hasInit = state.profileTransactions.some(t => 
                      t.profileId === targetId && 
                      (t.refNo === `INIT-${profile.sku}` || t.notes?.toLowerCase().includes('initial'))
                  );

                  if (!hasInit) {
                      newTransactions.push({
                          id: `pt_init_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
                          profileId: targetId,
                          brand: profBrand,
                          type: 'PRODUCTION',
                          quantity: openingStock,
                          piecesPerPacket: profile.piecesPerPacket || 1,
                          weight: profile.weight || 0,
                          unitPrice: profile.price || 0,
                          date: new Date().toISOString(),
                          status: 'COMPLETED',
                          refNo: `INIT-${profile.sku}`,
                          notes: 'Initial opening stock balance',
                          createdAt: new Date().toISOString()
                      });
                  }
              }
          });

          set(state => ({
              brands: currentBrands,
              profiles: updatedProfiles,
              protectiveFilmItems: updatedFilms,
              profileTransactions: newTransactions.length > 0 
                  ? [...state.profileTransactions, ...newTransactions] 
                  : state.profileTransactions
          }));

          get().pushStandardCatalogueToAll();
          return resolvedList;
      },
      insertProfileAt: (profile, relativeId, position = 'below') => {
          let updatedProfiles = [...get().profiles];
          const isReinfItem = isReinforcementProfile(profile);
          const profBrand = (profile.brand || 'General').trim();

          // Auto-register brand if not present in brands list
          const currentBrands = get().brands || [];
          if (profBrand && profBrand !== 'All' && !currentBrands.some(b => b.toLowerCase() === profBrand.toLowerCase())) {
              set({ brands: [...currentBrands, profBrand] });
          }

          const isMerged = !!profile.isMerged;
          const hasSku = !isMerged && !!profile.sku?.trim();

          const finalProfileType = isReinfItem ? 'REINFORCEMENT' : (profile.profileType || 'WINDOW');
          const finalCategory = isReinfItem ? (profile.category || 'GI Reinforcement') : (profile.category || '80.5 SERIES');
          const finalHsn = isReinfItem ? (profile.hsnCode || '72169910') : (profile.hsnCode || '39162099');

          const existingIdx = hasSku ? updatedProfiles.findIndex(p => 
              !p.isMerged &&
              p.sku.toLowerCase() === profile.sku.toLowerCase() && 
              (p.brand || 'General').toLowerCase() === profBrand.toLowerCase()
          ) : -1;

          let resolvedProfile: Profile;

          if (existingIdx >= 0) {
              const existing = updatedProfiles[existingIdx];
              const updated = { 
                  ...existing, 
                  ...profile, 
                  profileType: finalProfileType,
                  category: finalCategory,
                  hsnCode: finalHsn,
                  id: existing.id, 
                  brand: profBrand 
              };
              updatedProfiles[existingIdx] = updated;
              
              // Handle opening stock for existing profile if needed
              const openingStock = Number((profile as any).openingStock || 0);
              if (openingStock > 0 && !isMerged && profile.sku?.trim()) {
                  const hasInit = get().profileTransactions.some(t => 
                      t.profileId === existing.id && 
                      (t.refNo === `INIT-${profile.sku}` || t.notes?.toLowerCase().includes('initial'))
                  );
                  if (!hasInit) {
                      const newTx: ProfileTransaction = {
                          id: `pt_init_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                          profileId: existing.id,
                          brand: profBrand,
                          type: 'PRODUCTION',
                          quantity: openingStock,
                          piecesPerPacket: profile.piecesPerPacket || existing.piecesPerPacket || 1,
                          weight: profile.weight || existing.weight || 0,
                          unitPrice: profile.price || existing.price || 0,
                          date: new Date().toISOString(),
                          status: 'COMPLETED',
                          refNo: `INIT-${profile.sku}`,
                          notes: 'Initial opening stock balance',
                          createdAt: new Date().toISOString()
                      };
                      set(state => ({ 
                          profiles: updatedProfiles,
                          profileTransactions: [...state.profileTransactions, newTx]
                      }));
                  } else {
                      set({ profiles: updatedProfiles });
                  }
              } else {
                  set({ profiles: updatedProfiles });
              }
              
              resolvedProfile = updated;
          } else {
              const newProfile: Profile = { 
                  ...profile, 
                  profileType: finalProfileType,
                  category: finalCategory,
                  hsnCode: finalHsn,
                  id: `p${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, 
                  createdAt: new Date().toISOString(), 
                  brand: profBrand 
              };

              let insertIdx = updatedProfiles.length;
              if (relativeId) {
                  const targetIdx = updatedProfiles.findIndex(p => p.id === relativeId);
                  if (targetIdx >= 0) {
                      insertIdx = position === 'above' ? targetIdx : targetIdx + 1;
                  }
              } else if (position === 'above') {
                  insertIdx = 0;
              }
              updatedProfiles.splice(insertIdx, 0, newProfile);

              // Handle opening stock for new profile
              const openingStock = Number((profile as any).openingStock || 0);
              const newTransactions: ProfileTransaction[] = [];
              if (openingStock > 0 && !isMerged && newProfile.sku?.trim()) {
                  newTransactions.push({
                      id: `pt_init_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                      profileId: newProfile.id,
                      brand: profBrand,
                      type: 'PRODUCTION',
                      quantity: openingStock,
                      piecesPerPacket: newProfile.piecesPerPacket || 1,
                      weight: newProfile.weight || 0,
                      unitPrice: newProfile.price || 0,
                      date: new Date().toISOString(),
                      status: 'COMPLETED',
                      refNo: `INIT-${newProfile.sku}`,
                      notes: 'Initial opening stock balance',
                      createdAt: new Date().toISOString()
                  });
              }

              if (!isMerged && newProfile.sku?.trim() && !isReinfItem) {
                  const newFilmItem: ProtectiveFilmItem = {
                      id: `pf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                      sNo: 0,
                      series: newProfile.category || '80.5 SERIES',
                      description: newProfile.name,
                      profileCode: newProfile.sku,
                      packets: '',
                      lengthsPerPacket: newProfile.piecesPerPacket || 6,
                      eachLengthMtrs: newProfile.length || 5.9,
                      meterWeight: newProfile.weight || 0,
                      lengthWeightWithGasket: newProfile.weight || 0,
                      topFilmWidth: newProfile.topFilmWidth || '38',
                      topInwardMeters: 0,
                      topMtrPerLength: newProfile.length || 5.9,
                      topStickerName: newProfile.topStickerName || '',
                      bottomFilmWidth: newProfile.bottomFilmWidth || '38',
                      bottomInwardMeters: 0,
                      bottomMtrPerLength: newProfile.length || 5.9,
                      bottomStickerName: newProfile.bottomStickerName || '',
                      brand: profBrand
                  };
                  set(state => ({ 
                      profiles: updatedProfiles,
                      protectiveFilmItems: [...state.protectiveFilmItems, newFilmItem],
                      profileTransactions: newTransactions.length > 0 ? [...state.profileTransactions, ...newTransactions] : state.profileTransactions
                  }));
              } else {
                  set(state => ({ 
                      profiles: updatedProfiles,
                      profileTransactions: newTransactions.length > 0 ? [...state.profileTransactions, ...newTransactions] : state.profileTransactions
                  }));
              }

              resolvedProfile = newProfile;
          }

          get().pushStandardCatalogueToAll();
          return resolvedProfile;
      },
      syncProfilesToStock: () => set(state => {
          const newItems: ProtectiveFilmItem[] = [];
          const normBrand = (b?: string | null) => (b || 'General').trim().toLowerCase().replace(/[\s_-]/g, '');
          const normSku = (s?: string | null) => (s || '').trim().toLowerCase();

          // Active profiles map
          const activeProfiles = state.profiles.filter(p => !p.deletedAt);
          const nonMergedActiveProfiles = activeProfiles.filter(p => !p.isMerged && p.sku);

          // Synchronize stock items (state.items) with active profiles
          const seenItemSkus = new Set<string>();
          const updatedStockItems: Item[] = (state.items || [])
              .filter(item => {
                  const skuNorm = normSku(item.sku);
                  if (seenItemSkus.has(skuNorm)) return false;
                  seenItemSkus.add(skuNorm);
                  const matchingProfile = nonMergedActiveProfiles.find(p => normSku(p.sku) === skuNorm);
                  const isDeletedProfile = state.profiles.some(p => p.deletedAt && normSku(p.sku) === skuNorm);
                  return !isDeletedProfile || !!matchingProfile;
              })
              .map(item => {
                  const skuNorm = normSku(item.sku);
                  const matchingProfile = nonMergedActiveProfiles.find(p => normSku(p.sku) === skuNorm);
                  if (matchingProfile) {
                      return {
                          ...item,
                          sku: matchingProfile.sku,
                          name: matchingProfile.name,
                          category: matchingProfile.category || item.category || 'Windows & Doors',
                          uom: matchingProfile.uom || item.uom || 'Pcs',
                          reorderPoint: matchingProfile.reorderPoint !== undefined ? matchingProfile.reorderPoint : (item.reorderPoint || 50),
                          costPrice: matchingProfile.price !== undefined ? matchingProfile.price : (item.costPrice || 150)
                      };
                  }
                  return item;
              });

          const newStockItems: Item[] = [];
          nonMergedActiveProfiles.forEach(p => {
              const skuNorm = normSku(p.sku);
              const exists = [...updatedStockItems, ...newStockItems].some(item => normSku(item.sku) === skuNorm);
              if (!exists) {
                  newStockItems.push({
                      id: `i_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                      sku: p.sku,
                      name: p.name,
                      category: p.category || 'Windows & Doors',
                      uom: p.uom || 'Pcs',
                      reorderPoint: p.reorderPoint || 50,
                      openingStock: 0,
                      costPrice: p.price || 150,
                      gstPercent: 18,
                      createdAt: new Date().toISOString()
                  });
              }
          });

          // 1. Update existing protective film items, deduplicating them and removing items for deleted profiles
          const seenFilmKeys = new Set<string>();
          const updatedItems: ProtectiveFilmItem[] = state.protectiveFilmItems
              .filter(item => {
                  const itemSkuNorm = normSku(item.profileCode);
                  const itemBrandNorm = normBrand(item.brand);
                  const key = `${itemSkuNorm}::${itemBrandNorm}`;
                  // Deduplicate: only take first occurrence of each SKU+Brand in protective films
                  if (seenFilmKeys.has(key)) return false;
                  seenFilmKeys.add(key);

                  // Keep item if it matches an active profile, or if it has no profile linked but is general
                  const hasMatchingProfile = activeProfiles.some(p => 
                      normSku(p.sku) === itemSkuNorm && 
                      (normBrand(p.brand) === itemBrandNorm || !item.brand || item.brand === 'General')
                  );
                  const isDeletedProfile = state.profiles.some(p => 
                      p.deletedAt && 
                      normSku(p.sku) === itemSkuNorm && 
                      normBrand(p.brand) === itemBrandNorm
                  );
                  return !isDeletedProfile || hasMatchingProfile;
              })
              .map(item => {
                  const itemBrandNorm = normBrand(item.brand);
                  const itemSkuNorm = normSku(item.profileCode);

                  // Find matching active profile by SKU and Brand, or fallback by SKU
                  const profile = activeProfiles.find(p => 
                      normSku(p.sku) === itemSkuNorm && 
                      normBrand(p.brand) === itemBrandNorm
                  ) || activeProfiles.find(p => normSku(p.sku) === itemSkuNorm);

                  if (profile) {
                      const resolvedBrand = (profile.brand && profile.brand !== 'General') ? profile.brand : (item.brand || 'General');
                      return { 
                          ...item, 
                          brand: resolvedBrand,
                          profileCode: profile.sku,
                          series: profile.category || item.series || '80.5 SERIES',
                          description: profile.name || item.description,
                          lengthsPerPacket: profile.piecesPerPacket || item.lengthsPerPacket,
                          eachLengthMtrs: profile.length || item.eachLengthMtrs,
                          meterWeight: profile.weight || item.meterWeight,
                          lengthWeightWithGasket: profile.weight || item.lengthWeightWithGasket,
                          topFilmWidth: profile.topFilmWidth !== undefined ? profile.topFilmWidth : item.topFilmWidth,
                          topStickerName: profile.topStickerName !== undefined ? profile.topStickerName : (item.topStickerName || `${resolvedBrand} Top Film`),
                          bottomFilmWidth: profile.bottomFilmWidth !== undefined ? profile.bottomFilmWidth : item.bottomFilmWidth,
                          bottomStickerName: profile.bottomStickerName !== undefined ? profile.bottomStickerName : (item.bottomStickerName || `${resolvedBrand} Bottom Film`),
                      };
                  }
                  return item;
              });

          // 2. Ensure all active profiles have protective film items
          activeProfiles.forEach(profile => {
              const profBrand = profile.brand || 'General';
              const profBrandNorm = normBrand(profBrand);
              const profSkuNorm = normSku(profile.sku);

              const exists = [...updatedItems, ...newItems].some(item => 
                  normSku(item.profileCode) === profSkuNorm && 
                  normBrand(item.brand) === profBrandNorm
              );

              if (!exists) {
                  newItems.push({
                      id: `pf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                      sNo: updatedItems.length + newItems.length + 1,
                      series: profile.category || '80.5 SERIES',
                      description: profile.name,
                      profileCode: profile.sku,
                      packets: '',
                      lengthsPerPacket: profile.piecesPerPacket || 6,
                      eachLengthMtrs: profile.length || 5.9,
                      meterWeight: profile.weight || 0,
                      lengthWeightWithGasket: profile.weight || 0,
                      topFilmWidth: profile.topFilmWidth || '38',
                      topInwardMeters: 5000,
                      topMtrPerLength: profile.length || 5.9,
                      topStickerName: profile.topStickerName || `${profBrand} Top Film`,
                      bottomFilmWidth: profile.bottomFilmWidth || '38',
                      bottomInwardMeters: 5000,
                      bottomMtrPerLength: profile.length || 5.9,
                      bottomStickerName: profile.bottomStickerName || `${profBrand} Bottom Film`,
                      brand: profBrand
                  });
              }
          });

          // 3. Ensure all active profiles have extrusion dies, deduplicating existing dies
          const seenDieKeys = new Set<string>();
          const deduplicatedDies = state.dies.filter(d => {
              if (d.deletedAt) return false;
              const key = `${normSku(d.dieNo)}::${normBrand(d.brand)}`;
              if (seenDieKeys.has(key)) return false;
              seenDieKeys.add(key);
              return true;
          });

          const newDies: Die[] = [];
          activeProfiles.forEach(p => {
              const pBrand = p.brand || 'General';
              const pSkuNorm = normSku(p.sku);
              const hasDie = deduplicatedDies.some(d => 
                  (d.profileId === p.id || normSku(d.dieNo) === normSku(`DIE-${p.sku}`) || normSku(d.dieNo) === pSkuNorm)
              );
              if (!hasDie) {
                  newDies.push({
                      id: `die_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                      dieNo: `DIE-${p.sku}`,
                      profileId: p.id,
                      brand: pBrand,
                      cavities: p.piecesPerPacket && p.piecesPerPacket <= 4 ? 2 : 1,
                      expectedOutputKgHr: 120,
                      lifespanMeters: 50000,
                      status: 'ACTIVE',
                      createdAt: new Date().toISOString()
                  });
              }
          });

          // 4. Ensure all brands from profiles, films, and dies are registered in brands list
          const currentBrands = state.brands || [];
          const allExtractedBrands = Array.from(new Set([
              ...activeProfiles.map(p => p.brand).filter(Boolean),
              ...updatedItems.map(f => f.brand).filter(Boolean),
              ...newItems.map(f => f.brand).filter(Boolean),
              ...deduplicatedDies.map(d => d.brand).filter(Boolean),
              
          ] as string[]));

          const missingBrands = allExtractedBrands.filter(b => 
              b && b !== 'General' && !currentBrands.some(cb => normBrand(cb) === normBrand(b))
          );

          return { 
              items: [...updatedStockItems, ...newStockItems],
              protectiveFilmItems: [...updatedItems, ...newItems],
              dies: newDies.length > 0 ? [...deduplicatedDies, ...newDies] : deduplicatedDies,
              brands: missingBrands.length > 0 ? [...currentBrands, ...missingBrands] : currentBrands
          };
      }),
      syncProfileSpecsBySku: (sourceProfileId: string) => {
          const state = get();
          const source = state.profiles.find(p => p.id === sourceProfileId);
          if (!source) return;

          set(state => ({
              profiles: state.profiles.map(p => {
                  // Only sync profiles that have the same SKU and are NOT deleted, and NOT the source itself
                  if (!p.deletedAt && p.sku === source.sku && p.id !== source.id) {
                      return {
                          ...p,
                          name: source.name,
                          category: source.category,
                          profileType: source.profileType,
                          length: source.length,
                          weight: source.weight,
                          piecesPerPacket: source.piecesPerPacket,
                          price: source.price,
                          reorderPoint: source.reorderPoint,
                          size: source.size,
                          color: source.color,
                          hsnCode: source.hsnCode,
                          topFilmWidth: source.topFilmWidth,
                          bottomFilmWidth: source.bottomFilmWidth
                      };
                  }
                  return p;
              })
          }));
          
          // After syncing profiles, ensure film items are also updated to match
          get().syncProfilesToStock();
      },
      deduplicateProfiles: () => {
          let removedCount = 0;
          set(state => {
              const seen = new Set<string>();
              const cleanedProfiles: Profile[] = [];
              const duplicateIds = new Set<string>();

              state.profiles.forEach(p => {
                  if (p.isMerged) {
                      cleanedProfiles.push(p);
                      return;
                  }
                  const skuNorm = (p.sku || '').trim().toLowerCase();
                  const brandNorm = (p.brand || 'General').trim().toLowerCase().replace(/[\s_-]/g, '');
                  const key = `${skuNorm}::${brandNorm}`;

                  if (!skuNorm || p.deletedAt) {
                      cleanedProfiles.push(p);
                      return;
                  }

                  if (seen.has(key)) {
                      duplicateIds.add(p.id);
                  } else {
                      seen.add(key);
                      cleanedProfiles.push(p);
                  }
              });

              removedCount = duplicateIds.size;
              if (removedCount === 0) return state;

              // Re-point transactions of duplicates to primary profile
              const updatedTransactions = state.profileTransactions.map(t => {
                  if (duplicateIds.has(t.profileId)) {
                      const primary = cleanedProfiles.find(cp => 
                          (cp.sku || '').trim().toLowerCase() === (t.profileSkuOverride || '').trim().toLowerCase()
                      );
                      if (primary) {
                          return { ...t, profileId: primary.id };
                      }
                  }
                  return t;
              });

              return {
                  profiles: cleanedProfiles,
                  dies: state.dies.filter(d => !duplicateIds.has(d.profileId || '')),
                  profileTransactions: updatedTransactions
              };
          });
          return removedCount;
      },
      syncBrandDataToAllTabs: (targetBrand?: string) => {
          get().syncProfilesToStock();
          const state = get();
          const normBrand = (b?: string | null) => (b || 'General').trim().toLowerCase().replace(/[\s_-]/g, '');
          const target = targetBrand && targetBrand !== 'All' ? targetBrand : undefined;
          const filteredProfiles = target 
              ? state.profiles.filter(p => !p.deletedAt && normBrand(p.brand) === normBrand(target))
              : state.profiles.filter(p => !p.deletedAt);
          const filteredFilms = target 
              ? state.protectiveFilmItems.filter(f => normBrand(f.brand) === normBrand(target))
              : state.protectiveFilmItems;
          const filteredDies = target 
              ? state.dies.filter(d => !d.deletedAt && normBrand(d.brand) === normBrand(target))
              : state.dies.filter(d => !d.deletedAt);

          return {
              profilesCount: filteredProfiles.length,
              filmsCount: filteredFilms.length,
              diesCount: filteredDies.length,
              brand: target || 'All'
          };
      },
      pushStandardCatalogueToAll: (sourceBrand?: string) => {
          const state = get();
          const normBrand = (b?: string | null) => (b || 'General').trim().toLowerCase().replace(/[\s_-]/g, '');
          const normSku = (s?: string | null) => (s || '').trim().toLowerCase();

          // 1. Identify all active profiles and master specifications, including merged rows
          const activeProfiles = state.profiles.filter(p => !p.deletedAt);
          const skuSpecMap = new Map<string, Profile>();
          const mergedSpecMap = new Map<string, Profile>();
          
          // First fill with all active profiles
          activeProfiles.forEach(p => {
              if (p.isMerged && p.mergedText?.trim()) {
                  const key = p.mergedText.trim().toLowerCase();
                  if (!mergedSpecMap.has(key)) mergedSpecMap.set(key, p);
              } else if (p.sku?.trim()) {
                  const sku = normSku(p.sku);
                  if (!skuSpecMap.has(sku)) skuSpecMap.set(sku, p);
              }
          });
          
          // If sourceBrand specified, override with sourceBrand specs
          if (sourceBrand && sourceBrand !== 'All') {
              activeProfiles.forEach(p => {
                  if (normBrand(p.brand) === normBrand(sourceBrand)) {
                      if (p.isMerged && p.mergedText?.trim()) {
                          mergedSpecMap.set(p.mergedText.trim().toLowerCase(), p);
                      } else if (p.sku?.trim()) {
                          skuSpecMap.set(normSku(p.sku), p);
                      }
                  }
              });
          }

          // 2. Determine all registered brands
          const allBrands = Array.from(new Set([
              ...(state.brands || []),
              ...activeProfiles.map(p => p.brand).filter(Boolean)
          ])).filter(b => b && b !== 'All');

          let syncedProfilesCount = 0;
          let newProfilesAdded = 0;

          // 3. Update existing profiles with matching SKU or Merged Text across all brands
          let updatedProfiles = state.profiles.map(p => {
              if (p.deletedAt) return p;
              
              let std: Profile | undefined;
              if (p.isMerged && p.mergedText?.trim()) {
                  std = mergedSpecMap.get(p.mergedText.trim().toLowerCase());
              } else if (p.sku?.trim()) {
                  std = skuSpecMap.get(normSku(p.sku));
              }
              
              if (!std) return p;

              syncedProfilesCount++;
              return {
                  ...p,
                  name: std.name || p.name,
                  category: std.category || p.category,
                  profileType: std.profileType || p.profileType,
                  length: std.length !== undefined ? std.length : p.length,
                  weight: std.weight !== undefined ? std.weight : p.weight,
                  meterWeight: std.meterWeight !== undefined ? std.meterWeight : p.meterWeight,
                  piecesPerPacket: std.piecesPerPacket !== undefined ? std.piecesPerPacket : p.piecesPerPacket,
                  price: std.price !== undefined ? std.price : p.price,
                  reorderPoint: std.reorderPoint !== undefined ? std.reorderPoint : p.reorderPoint,
                  size: std.size || p.size,
                  color: std.color || p.color,
                  hsnCode: std.hsnCode || p.hsnCode,
                  topFilmWidth: std.topFilmWidth !== undefined ? std.topFilmWidth : p.topFilmWidth,
                  bottomFilmWidth: std.bottomFilmWidth !== undefined ? std.bottomFilmWidth : p.bottomFilmWidth,
                  topStickerName: std.topStickerName !== undefined ? std.topStickerName : p.topStickerName,
                  bottomStickerName: std.bottomStickerName !== undefined ? std.bottomStickerName : p.bottomStickerName,
                  mergedAlign: std.mergedAlign || p.mergedAlign,
                  mergedBg: std.mergedBg || p.mergedBg,
                  isMerged: std.isMerged !== undefined ? std.isMerged : p.isMerged
              };
          });

          set({ profiles: updatedProfiles });

          // 5. Trigger full sync to stock, protective films and dies
          get().syncProfilesToStock();

          const finalFilmsCount = get().protectiveFilmItems.length;

          return {
              syncedProfiles: syncedProfilesCount + newProfilesAdded,
              syncedFilms: finalFilmsCount,
              syncedBrands: allBrands.length
          };
      },
      updateProfile: (profile) => {
          const oldProfile = get().profiles.find(p => p.id === profile.id);
          const oldSku = oldProfile?.sku?.trim().toLowerCase();
          const newSku = profile.sku?.trim().toLowerCase();
          const normBrand = (b?: string | null) => (b || 'General').trim().toLowerCase().replace(/[\s_-]/g, '');
          const oldBrandNorm = normBrand(oldProfile?.brand);
          const newBrandNorm = normBrand(profile.brand);

          set(state => {
              let matchedFilm = false;
              const updatedFilms = state.protectiveFilmItems.map(f => {
                  const fSku = (f.profileCode || '').trim().toLowerCase();
                  const fBrandNorm = normBrand(f.brand);
                  if ((fSku === oldSku || fSku === newSku) && (fBrandNorm === oldBrandNorm || fBrandNorm === newBrandNorm || !f.brand || f.brand === 'General')) {
                      matchedFilm = true;
                      return {
                          ...f,
                          profileCode: profile.sku,
                          brand: profile.brand,
                          description: profile.name || f.description,
                          series: profile.category || f.series,
                          lengthsPerPacket: profile.piecesPerPacket || f.lengthsPerPacket,
                          eachLengthMtrs: profile.length || f.eachLengthMtrs,
                          meterWeight: profile.weight || f.meterWeight,
                          topFilmWidth: profile.topFilmWidth !== undefined ? profile.topFilmWidth : f.topFilmWidth,
                          topStickerName: profile.topStickerName !== undefined ? profile.topStickerName : f.topStickerName,
                          bottomFilmWidth: profile.bottomFilmWidth !== undefined ? profile.bottomFilmWidth : f.bottomFilmWidth,
                          bottomStickerName: profile.bottomStickerName !== undefined ? profile.bottomStickerName : f.bottomStickerName,
                      };
                  }
                  return f;
              });

              if (!matchedFilm && !profile.isMerged && profile.sku?.trim()) {
                  updatedFilms.push({
                      id: `pf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                      sNo: updatedFilms.length + 1,
                      series: profile.category || '80.5 SERIES',
                      description: profile.name,
                      profileCode: profile.sku,
                      packets: '',
                      lengthsPerPacket: profile.piecesPerPacket || 6,
                      eachLengthMtrs: profile.length || 5.9,
                      meterWeight: profile.weight || 0,
                      lengthWeightWithGasket: profile.weight || 0,
                      topFilmWidth: profile.topFilmWidth || '38',
                      topInwardMeters: 5000,
                      topMtrPerLength: profile.length || 5.9,
                      topStickerName: profile.topStickerName || `${profile.brand || 'General'} Top Film`,
                      bottomFilmWidth: profile.bottomFilmWidth || '38',
                      bottomInwardMeters: 5000,
                      bottomMtrPerLength: profile.length || 5.9,
                      bottomStickerName: profile.bottomStickerName || `${profile.brand || 'General'} Bottom Film`,
                      brand: profile.brand || 'General'
                  });
              }

              // Update Data Plan rows if product name matches
              const oldName = (oldProfile?.name || '').trim().toLowerCase();
              const updatedDataPlanRows = (state.dataPlanSheet?.rows || []).map(r => {
                  const rProd = (r.product || '').trim().toLowerCase();
                  if (oldName && rProd === oldName) {
                      return { ...r, product: profile.name };
                  }
                  return r;
              });

              const innerNormSku = (s?: string | null) => (s || '').trim().toLowerCase().replace(/[\s_-]/g, '');

              return {
                  profiles: state.profiles.map(p => p.id === profile.id ? profile : p),
                  protectiveFilmItems: updatedFilms,
                  dies: state.dies.map(d => (d.profileId === profile.id || (oldSku && innerNormSku(d.dieNo) === `die-${oldSku}`)) ? { 
                      ...d, 
                      dieNo: `DIE-${profile.sku}`,
                      brand: profile.brand 
                  } : d),
                  profileTransactions: state.profileTransactions.map(t => t.profileId === profile.id ? { 
                      ...t, 
                      brand: profile.brand,
                      profileNameOverride: profile.name,
                      profileSkuOverride: profile.sku 
                  } : t),
                  dataPlanSheet: {
                      ...state.dataPlanSheet,
                      rows: updatedDataPlanRows
                  }
              };
          });
          get().pushStandardCatalogueToAll();
      },
      deleteProfile: (id) => set(state => {
          const target = state.profiles.find(p => p.id === id);
          const skuNorm = (target?.sku || '').trim().toLowerCase();
          const normB = (b?: string | null) => (b || 'General').trim().toLowerCase().replace(/[\s_-]/g, '');
          const brandNorm = normB(target?.brand);
          const targetNameNorm = (target?.name || '').trim().toLowerCase();
          const nowIso = new Date().toISOString();

          // Check if any OTHER active profile still has this SKU & Brand
          const hasOtherSameSku = state.profiles.some(p => 
              p.id !== id && !p.deletedAt && 
              (p.sku || '').trim().toLowerCase() === skuNorm && 
              normB(p.brand) === brandNorm
          );

          const hasOtherSameSkuActive = state.profiles.some(p => 
              p.id !== id && !p.deletedAt && 
              (p.sku || '').trim().toLowerCase() === skuNorm
          );

          const linkedDieIds = new Set(state.dies.filter(d => d.profileId === id).map(d => d.id));

          return {
              // 1. Mark profile deleted
              profiles: state.profiles.map(p => p.id === id ? { ...p, deletedAt: nowIso } : p),
              // 2. Remove protective film items if no other active profile shares this SKU+Brand
              protectiveFilmItems: hasOtherSameSku ? state.protectiveFilmItems : state.protectiveFilmItems.filter(f => {
                  const fSku = (f.profileCode || '').trim().toLowerCase();
                  const fBrand = normB(f.brand);
                  return !(skuNorm && fSku === skuNorm && fBrand === brandNorm);
              }),
              // 3. Mark stock items deleted if no other active profile shares this SKU
              items: hasOtherSameSkuActive ? state.items : state.items.map(i => (i.sku || '').trim().toLowerCase() === skuNorm ? { ...i, deletedAt: nowIso } : i),
              // 4. Mark dies deleted
              dies: state.dies.map(d => (d.profileId === id || (!hasOtherSameSku && skuNorm && (d.dieNo || '').trim().toLowerCase() === `die-${skuNorm}`)) ? { ...d, deletedAt: nowIso } : d),
              // 5. Mark profile transactions deleted (Stock, Quotations, Inflows, Scrap)
              profileTransactions: state.profileTransactions.map(t => t.profileId === id ? { ...t, deletedAt: nowIso } : t),
              // 6. Remove from Data Plan Sheet rows so it is immediately not seen
              dataPlanSheet: {
                  ...state.dataPlanSheet,
                  rows: (state.dataPlanSheet?.rows || []).filter(r => {
                      const rProd = (r.product || '').trim().toLowerCase();
                      if (r.id?.includes(id)) return false;
                      if (targetNameNorm && rProd === targetNameNorm) return false;
                      if (skuNorm && rProd === skuNorm) return false;
                      return true;
                  })
              },
              // 7. Mark production plans linked to this profile's dies deleted
              productionPlans: state.productionPlans.map(p => 
                  (p.dieId && linkedDieIds.has(p.dieId)) || (p.dieIds && p.dieIds.some(dId => linkedDieIds.has(dId)))
                      ? { ...p, deletedAt: nowIso }
                      : p
              )
          };
      }),
      restoreProfile: (id) => set(state => {
          const linkedDieIds = new Set(state.dies.filter(d => d.profileId === id).map(d => d.id));
          const target = state.profiles.find(p => p.id === id);
          const skuNorm = (target?.sku || '').trim().toLowerCase();
          return {
              profiles: state.profiles.map(p => p.id === id ? { ...p, deletedAt: null } : p),
              items: state.items.map(i => (skuNorm && (i.sku || '').trim().toLowerCase() === skuNorm) ? { ...i, deletedAt: null } : i),
              dies: state.dies.map(d => d.profileId === id ? { ...d, deletedAt: null } : d),
              profileTransactions: state.profileTransactions.map(t => t.profileId === id ? { ...t, deletedAt: null } : t),
              productionPlans: state.productionPlans.map(p => 
                  (p.dieId && linkedDieIds.has(p.dieId)) || (p.dieIds && p.dieIds.some(dId => linkedDieIds.has(dId)))
                      ? { ...p, deletedAt: null }
                      : p
              )
          };
      }),
      permanentlyDeleteProfile: (id) => set(state => {
          const target = state.profiles.find(p => p.id === id);
          const skuNorm = (target?.sku || '').trim().toLowerCase();
          const normB = (b?: string | null) => (b || 'General').trim().toLowerCase().replace(/[\s_-]/g, '');
          const brandNorm = normB(target?.brand);
          const targetNameNorm = (target?.name || '').trim().toLowerCase();

          // Check if any OTHER active profile still has this SKU & Brand
          const hasOtherSameSku = state.profiles.some(p => 
              p.id !== id && !p.deletedAt && 
              (p.sku || '').trim().toLowerCase() === skuNorm && 
              normB(p.brand) === brandNorm
          );

          const hasOtherSameSkuActive = state.profiles.some(p => 
              p.id !== id && !p.deletedAt && 
              (p.sku || '').trim().toLowerCase() === skuNorm
          );

          const linkedDieIds = new Set(state.dies.filter(d => d.profileId === id).map(d => d.id));

          return {
              // 1. Completely eradicate from profiles
              profiles: state.profiles.filter(p => p.id !== id),
              // 2. Completely eradicate protective films
              protectiveFilmItems: hasOtherSameSku ? state.protectiveFilmItems : state.protectiveFilmItems.filter(f => {
                  const fSku = (f.profileCode || '').trim().toLowerCase();
                  const fBrand = normB(f.brand);
                  return !(skuNorm && fSku === skuNorm && fBrand === brandNorm);
              }),
              // 3. Completely eradicate stock items if no other active profile shares this SKU
              items: hasOtherSameSkuActive ? state.items : state.items.filter(i => (i.sku || '').trim().toLowerCase() !== skuNorm),
              // 4. Completely eradicate dies
              dies: state.dies.filter(d => {
                  if (d.profileId === id) return false;
                  if (!hasOtherSameSku && skuNorm && (d.dieNo || '').trim().toLowerCase() === `die-${skuNorm}`) return false;
                  return true;
              }),
              // 5. Completely eradicate all transactions (Stock, Quotations, Inflows, Scrap)
              profileTransactions: state.profileTransactions.filter(t => t.profileId !== id),
              // 6. Completely eradicate from Data Plan Sheet rows
              dataPlanSheet: {
                  ...state.dataPlanSheet,
                  rows: (state.dataPlanSheet?.rows || []).filter(r => {
                      const rProd = (r.product || '').trim().toLowerCase();
                      if (r.id?.includes(id)) return false;
                      if (targetNameNorm && rProd === targetNameNorm) return false;
                      if (skuNorm && rProd === skuNorm) return false;
                      return true;
                  })
              },
              // 7. Completely eradicate from production plans
              productionPlans: state.productionPlans.filter(p => 
                  !( (p.dieId && linkedDieIds.has(p.dieId)) || (p.dieIds && p.dieIds.some(dId => linkedDieIds.has(dId))) )
              )
          };
      }),

      addProfileTransaction: (tx) => set(state => ({ profileTransactions: [...state.profileTransactions, { ...tx, id: `pt${Date.now()}`, createdAt: new Date().toISOString() }] })),
      updateProfileTransaction: (tx) => set(state => ({ profileTransactions: state.profileTransactions.map(t => t.id === tx.id ? tx : t) })),
      deleteProfileTransaction: (id) => set(state => ({ profileTransactions: state.profileTransactions.map(t => t.id === id ? { ...t, deletedAt: new Date().toISOString() } : t) })),
      restoreProfileTransaction: (id) => set(state => ({ profileTransactions: state.profileTransactions.map(t => t.id === id ? { ...t, deletedAt: null } : t) })),
      permanentlyDeleteProfileTransaction: (id) => set(state => ({ profileTransactions: state.profileTransactions.filter(t => t.id !== id) })),
      resolveQuotation: (id, action) => set(state => {
          const tx = state.profileTransactions.find(t => t.id === id);
          if (!tx) return state;
          
          if (action === 'CANCEL') {
              return { profileTransactions: state.profileTransactions.map(t => t.id === id ? { ...t, status: 'CANCELLED' } : t) };
          }
          
          const newType = action === 'CONFIRM_DISPATCH' ? 'DISPATCH' : 'RETURN';
          return { 
              profileTransactions: state.profileTransactions.map(t => 
                  t.id === id ? { ...t, status: 'COMPLETED', type: newType } : t
              ) 
          };
      }),

      addCustomer: (customer) => set(state => ({ customers: [...state.customers, { ...customer, id: `cust${Date.now()}`, createdAt: new Date().toISOString() }] })),
      updateCustomer: (customer) => set(state => ({ customers: state.customers.map(c => c.id === customer.id ? customer : c) })),
      deleteCustomer: (id) => set(state => ({ customers: state.customers.map(c => c.id === id ? { ...c, deletedAt: new Date().toISOString() } : c) })),

      addBrand: (brand) => set(state => {
          const trimmed = brand.trim();
          if (!trimmed || state.brands.some(b => b.toLowerCase() === trimmed.toLowerCase())) return state;
          return { brands: [...state.brands, trimmed] };
      }),
      updateBrand: (oldB, newB) => set(state => {
          const trimmedNew = newB.trim();
          if (!trimmedNew) return state;
          return { 
              brands: state.brands.map(b => b.toLowerCase() === oldB.toLowerCase() ? trimmedNew : b),
              profiles: state.profiles.map(p => (p.brand && p.brand.toLowerCase() === oldB.toLowerCase()) ? { ...p, brand: trimmedNew } : p),
              dies: state.dies.map(d => (d.brand && d.brand.toLowerCase() === oldB.toLowerCase()) ? { ...d, brand: trimmedNew } : d),
              profileTransactions: state.profileTransactions.map(t => {
                  const prof = state.profiles.find(p => p.id === t.profileId);
                  return ((prof?.brand && prof.brand.toLowerCase() === oldB.toLowerCase()) || (t.brand && t.brand.toLowerCase() === oldB.toLowerCase())) ? { ...t, brand: trimmedNew } : t;
              }),
              protectiveFilmItems: state.protectiveFilmItems.map(p => (p.brand && p.brand.toLowerCase() === oldB.toLowerCase()) ? { ...p, brand: trimmedNew } : p),
              protectiveFilmInwardTransactions: state.protectiveFilmInwardTransactions.map(t => (t.brand && t.brand.toLowerCase() === oldB.toLowerCase()) ? { ...t, brand: trimmedNew } : t),
              protectiveFilmOutwardAdjustments: state.protectiveFilmOutwardAdjustments.map(a => (a.brand && a.brand.toLowerCase() === oldB.toLowerCase()) ? { ...a, brand: trimmedNew } : a)
          };
      }),
      deleteBrand: (brand) => set(state => {
          return { 
              brands: state.brands.filter(b => b.toLowerCase() !== brand.toLowerCase()),
              profiles: state.profiles.map(p => (p.brand && p.brand.toLowerCase() === brand.toLowerCase()) ? { ...p, brand: 'General' } : p),
              protectiveFilmItems: state.protectiveFilmItems.filter(p => p.brand?.toLowerCase() !== brand.toLowerCase()),
              protectiveFilmInwardTransactions: state.protectiveFilmInwardTransactions.filter(t => t.brand?.toLowerCase() !== brand.toLowerCase()),
              protectiveFilmOutwardAdjustments: state.protectiveFilmOutwardAdjustments.filter(a => a.brand?.toLowerCase() !== brand.toLowerCase())
          };
      }),

      addDie: (die) => {
          const profile = get().profiles.find(p => p.id === die.profileId);
          set(state => ({ dies: [...state.dies, { ...die, id: `d${Date.now()}`, brand: die.brand || profile?.brand || 'General', createdAt: new Date().toISOString() }] }));
      },
      updateDie: (die) => set(state => {
          const profile = state.profiles.find(p => p.id === die.profileId);
          return { dies: state.dies.map(d => d.id === die.id ? { ...die, brand: die.brand || profile?.brand || 'General' } : d) };
      }),
      deleteDie: (id) => set(state => ({ dies: state.dies.map(d => d.id === id ? { ...d, deletedAt: new Date().toISOString() } : d) })),
      restoreDie: (id) => set(state => ({ dies: state.dies.map(d => d.id === id ? { ...d, deletedAt: null } : d) })),
      permanentlyDeleteDie: (id) => set(state => ({ dies: state.dies.filter(d => d.id !== id) })),

      addProductionPlan: (plan) => set(state => ({ productionPlans: [...state.productionPlans, { ...plan, id: `pp${Date.now()}`, createdAt: new Date().toISOString() }] })),
      updateProductionPlan: (plan) => set(state => ({ productionPlans: state.productionPlans.map(p => p.id === plan.id ? plan : p) })),
      deleteProductionPlan: (id) => set(state => ({ productionPlans: state.productionPlans.map(p => p.id === id ? { ...p, deletedAt: new Date().toISOString() } : p) })),
      restoreProductionPlan: (id) => set(state => ({ productionPlans: state.productionPlans.map(p => p.id === id ? { ...p, deletedAt: null } : p) })),
      permanentlyDeleteProductionPlan: (id) => set(state => ({ productionPlans: state.productionPlans.filter(p => p.id !== id) })),

      addMachine: (machine) => set(state => {
          const trimmed = machine.trim();
          if (!trimmed || (state.machines || []).includes(trimmed)) return state;
          return { machines: [...(state.machines || ['Machine 1', 'Machine 2', 'Machine 3', 'Machine 4', 'Machine 5']), trimmed] };
      }),
      deleteMachine: (machine) => set(state => ({
          machines: (state.machines || ['Machine 1', 'Machine 2', 'Machine 3', 'Machine 4', 'Machine 5']).filter(m => m !== machine)
      })),

      addSupplier: (supplier) => set(state => ({ suppliers: [...state.suppliers, { ...supplier, id: `s${Date.now()}`, createdAt: new Date().toISOString() }] })),
      updateSupplier: (supplier) => set(state => ({ suppliers: state.suppliers.map(s => s.id === supplier.id ? supplier : s) })),
      deleteSupplier: (id) => set(state => ({ suppliers: state.suppliers.map(s => s.id === id ? { ...s, deletedAt: new Date().toISOString() } : s) })),

      addPurchaseOrder: (po) => set(state => ({ purchaseOrders: [...state.purchaseOrders, { ...po, id: `po${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] })),
      updatePurchaseOrder: (po) => set(state => ({ purchaseOrders: state.purchaseOrders.map(p => p.id === po.id ? { ...po, updatedAt: new Date().toISOString() } : p) })),
      deletePurchaseOrder: (id) => set(state => ({ purchaseOrders: state.purchaseOrders.map(p => p.id === id ? { ...p, deletedAt: new Date().toISOString() } : p) })),
      updatePOStatus: (id, status) => set(state => ({ purchaseOrders: state.purchaseOrders.map(p => p.id === id ? { ...p, status, updatedAt: new Date().toISOString() } : p) })),

      addOrUpdateReportCorrection: (correction) => set(state => {
          const existingIdx = state.reportCorrections.findIndex(c => c.itemId === correction.itemId && c.date === correction.date);
          const newCorrection = { ...correction, updatedAt: new Date().toISOString() };
          if(existingIdx > -1) {
              const updated = [...state.reportCorrections];
              updated[existingIdx] = newCorrection;
              return { reportCorrections: updated };
          }
          return { reportCorrections: [...state.reportCorrections, newCorrection] };
      }),
      updateCompanySettings: (settings) => set({ companySettings: settings }),
      setInflowFilters: (filters) => set(state => ({ uiState: { ...state.uiState, inflowFilters: filters } })),
      setConsumptionFilters: (filters) => set(state => ({ uiState: { ...state.uiState, consumptionFilters: filters } })),
      resetCatalogueAndQuotations: () => set({
        profiles: [],
        profileTransactions: [],
        brands: [],
        dies: [],
        productionPlans: [],
        protectiveFilmItems: DEFAULT_PROTECTIVE_FILM_ITEMS,
        protectiveFilmInwardTransactions: [],
        protectiveFilmOutwardAdjustments: [],
        dataPlanSheet: {
          columns: INITIAL_DATA_PLAN_COLUMNS,
          rows: INITIAL_DATA_PLAN_ROWS,
          selectedBrandFilter: 'ALL',
          lastSaved: new Date().toISOString()
        }
      }),
      setProfileFilters: (filters) => set(state => ({ uiState: { ...state.uiState, profileFilters: filters } })),
      saveProfileFilterPreset: (name, filters) => set(state => ({
          uiState: {
              ...state.uiState,
              profileFilterPresets: [...state.uiState.profileFilterPresets, { id: Date.now().toString(), name, ...filters }]
          }
      })),
      deleteProfileFilterPreset: (id) => set(state => ({
          uiState: {
              ...state.uiState,
              profileFilterPresets: state.uiState.profileFilterPresets.filter(p => p.id !== id)
          }
      })),
      setDataPlanSheet: (sheet) => set({ dataPlanSheet: { ...sheet, lastSaved: new Date().toISOString() } }),
      updateDataPlanSheet: (updater) => set(state => {
          const prev = state.dataPlanSheet || {
              columns: INITIAL_DATA_PLAN_COLUMNS,
              rows: INITIAL_DATA_PLAN_ROWS,
              selectedBrandFilter: 'ALL'
          };
          const next = updater(prev);
          return { dataPlanSheet: { ...next, lastSaved: new Date().toISOString() } };
      }),
      resetDataPlanSheet: () => set({
          dataPlanSheet: {
              columns: INITIAL_DATA_PLAN_COLUMNS,
              rows: INITIAL_DATA_PLAN_ROWS,
              selectedBrandFilter: 'ALL',
              lastSaved: new Date().toISOString()
          }
      }),
    }),
    {
      name: 'erp-inventory-hub-storage',
      version: 3,
      migrate: (persistedState: any, version: number) => {
        if (version < 3) {
          return {
            ...persistedState,
            profiles: [],
            profileTransactions: [],
            dies: [],
            productionPlans: [],
            protectiveFilmItems: [],
          };
        }
        return persistedState;
      },
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => {
        const { uiState, securityAuditLogs, ...rest } = state;
        return {
          ...rest,
          securityAuditLogs: (securityAuditLogs || []).slice(-30),
        };
      },
    }
  )
);
