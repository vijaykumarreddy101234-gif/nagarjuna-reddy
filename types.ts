export type ID = string;

export type Role = 'ADMIN' | 'STORE_MANAGER' | 'PURCHASE' | 'SALES' | 'SECURITY' | 'MANAGEMENT' | 'VIEWER';

export type Page = 
    | 'Dashboard' 
    | 'Store Management' 
    | 'Profiles & Stock' 
    | 'Dies & Planning' 
    | 'Production' 
    | 'Quotations & Sales' 
    | 'Shipments' 
    | 'Scrap' 
    | 'Protective Films' 
    | 'Reports & History' 
    | 'Users' 
    | 'Trash' 
    | 'Import Excel' 
    | 'Settings'
    | 'RM Section'
    | 'Profiles'
    | 'History'
    | 'Storage'
    | 'Excel & Sheets'
    | 'Import'
    | 'Workspace AI';

export interface User {
    id: ID;
    email: string;
    name: string;
    role: Role;
    picture?: string;
    isGuest?: boolean;
    provider?: 'google' | 'microsoft' | 'yahoo' | 'offline';
    createdAt: string;
}

export interface AppUser {
    id: ID;
    name: string;
    email: string;
    role: Role;
    allowedPages?: string[];
    createdAt: string;
    status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
    department?: string;
    phone?: string;
    lastLogin?: string;
    avatarUrl?: string;
    twoFactorEnabled?: boolean;
    canExport?: boolean;
    canDelete?: boolean;
    canEditPricing?: boolean;
    notes?: string;
}

export interface SecurityAuditLog {
    id: string;
    timestamp: string;
    userId?: string;
    userName: string;
    action: string;
    category: 'AUTH' | 'PERMISSION' | 'SECURITY' | 'USER_MANAGEMENT';
    details: string;
    ipAddress?: string;
}

export interface SystemSettings {
    companyName?: string;
    currency?: string;
    gmailAccessLevel?: string;
    syncEnabled?: boolean;
    hostingerUrl?: string;
    hostingerApiKey?: string;
    // Advanced Security & User Management Options
    sessionTimeoutMinutes?: number;
    requireTwoFactor?: boolean;
    singleSessionPerUser?: boolean;
    maskPricingForStandardUsers?: boolean;
    allowDataExport?: boolean;
    emergencyReadOnlyMode?: boolean;
    lockBackdatedEntriesDays?: number;
    auditLoggingEnabled?: boolean;
    allowedIpRanges?: string;
}

export interface Item {
    id: ID;
    sku: string;
    name: string;
    category: string;
    uom: string;
    reorderPoint: number;
    openingStock?: number;
    costPrice?: number;
    gstPercent?: number;
    createdAt: string;
    deletedAt?: string | null;
}

export interface InflowTransaction {
    id: ID;
    refNo: string;
    itemId: ID;
    quantity: number;
    unitCost: number;
    totalCost: number;
    warehouseId: string;
    supplier: string;
    createdAt: string;
    txnDate: string;
    deletedAt?: string | null;
}

export interface ConsumptionTransaction {
    id: ID;
    refNo: string;
    itemId: ID;
    quantity: number;
    warehouseId: string;
    createdAt: string;
    txnDate: string;
    type: 'PROD' | 'MANUAL' | 'SCRAP';
    batchNo?: string;
    deletedAt?: string | null;
}

export interface FormulaIngredient {
    itemId: ID;
    quantity: number;
    costPrice?: number;
    gstPercent?: number;
}

export interface Formula {
    id: ID;
    name: string;
    outputProduct: string;
    outputQuantity: number;
    outputUom: string;
    ingredients: FormulaIngredient[];
    createdAt: string;
    deletedAt?: string | null;
}

export interface ReportCorrection {
    itemId: ID;
    date: string;
    correctedInflow: number;
    correctedConsumption: number;
    reason: string;
    updatedAt: string;
}

export interface Profile {
    id: ID;
    sku: string;
    name: string;
    category: string;
    profileType: 'WINDOW' | 'DOOR' | 'REINFORCEMENT' | 'OTHER';
    uom: string;
    length: number;
    piecesPerPacket: number;
    weight: number;
    meterWeight?: number;
    price: number;
    brand: string;
    hsnCode?: string;
    reorderPoint?: number;
    size?: string;
    color?: string;
    topFilmWidth?: string;
    topStickerName?: string;
    bottomFilmWidth?: string;
    bottomStickerName?: string;
    openingStock?: number;
    createdAt: string;
    deletedAt?: string | null;
}

export interface InvoiceDetails {
    category: string;
    reverseCharge: string;
    documentType: string;
    documentNo: string;
    documentDate: string;
    legalName: string;
    address1: string;
    address2?: string;
    location?: string;
    pincode?: string;
    phone?: string;
    gstin?: string;
    state: string;
    email?: string;
    placeOfSupply: string;
    igstOnIntra: string;
    transactionType: string;
    totalTaxable: number;
    igstValue: number;
    sgstValue: number;
    cgstValue: number;
    cessAdvolValue: number;
    cessNonAdValue: number;
    stateCessValue: number;
    totalAmount: number;
}

export interface ProfileTransaction {
    id: ID;
    profileId: ID;
    type: 'PRODUCTION' | 'DISPATCH' | 'QUOTATION' | 'SCRAP' | 'RETURN';
    quantity: number;
    date: string;
    refNo: string;
    status?: 'PENDING' | 'COMPLETED' | 'CANCELLED';
    customer?: string;
    unitPrice?: number;
    brand?: string;
    invoiceDetails?: InvoiceDetails;
    machine?: string;
    die?: string;
    uom?: string;
    profileNameOverride?: string;
    profileSkuOverride?: string;
    packets?: number;
    piecesPerPacket?: number;
    weight?: number;
    hsnCode?: string;
    notes?: string;
    remarks?: string;
    createdAt: string;
    deletedAt?: string | null;
}

export interface Customer {
    id: ID;
    name: string;
    address?: string;
    gstin?: string;
    phone?: string;
    state?: string;
    stateCode?: string;
    createdAt: string;
    deletedAt?: string | null;
}

export interface Die {
    id: ID;
    dieNo: string;
    profileId: ID;
    brand?: string;
    cavities: number;
    expectedOutputKgHr: number;
    lifespanMeters: number;
    status: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
    processLog?: Record<string, any>;
    createdAt: string;
    deletedAt?: string | null;
}

export interface ProductionPlan {
    id: ID;
    date: string;
    shift: string;
    machineNo: string;
    machine?: string;
    dieIds: ID[];
    dieId?: ID;
    targetLengths: number;
    targetLength?: number;
    targetMeters?: number;
    notes?: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    createdAt: string;
    deletedAt?: string | null;
}

export interface Supplier {
    id: ID;
    name: string;
    contactPerson: string;
    email?: string;
    phone: string;
    address?: string;
    gstin?: string;
    rating?: number;
    leadTimeDays?: number;
    createdAt: string;
    deletedAt?: string | null;
}

export interface PurchaseOrderItem {
    itemId: ID;
    quantity: number;
    unitCost: number;
    totalCost: number;
}

export interface PurchaseOrder {
    id: ID;
    poNumber: string;
    supplierId: ID;
    items: PurchaseOrderItem[];
    status: 'DRAFT' | 'SENT' | 'APPROVED' | 'RECEIVED' | 'CANCELLED';
    totalAmount: number;
    expectedDate: string;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
}

export interface Mail {
    id: ID;
    sender: string;
    subject: string;
    body: string;
    date: string;
    unread: boolean;
}

export interface DataPlanColumn {
    id: string;
    label: string;
    type: 'text' | 'number' | 'brand';
    brandName?: string;
    width?: string;
    align?: string;
}

export interface DataPlanRow {
    id: string;
    [key: string]: any;
}

export interface DataPlanSheetState {
    columns: DataPlanColumn[];
    rows: DataPlanRow[];
    selectedBrandFilter: string;
    lastSaved?: string;
}

export interface ProtectiveFilmItem {
    id: ID;
    sNo?: number;
    filmWidth?: string;
    topFilmWidth?: string;
    bottomFilmWidth?: string;
    color?: string;
    micron?: number;
    brand?: string;
    minStockMeters?: number;
    openingStockMeters?: number;
    currentStockMeters?: number;
    profileCode?: string;
    series?: string;
    description?: string;
    notes?: string;
    lengthsPerPacket?: number | string;
    eachLengthMtrs?: number;
    lengthWeightWithGasket?: number | string;
    meterWeight?: number | string;
    topInwardMeters?: number;
    topMtrPerLength?: number;
    topStickerName?: string;
    topCustomLengths?: number;
    bottomInwardMeters?: number;
    bottomMtrPerLength?: number;
    bottomStickerName?: string;
    bottomCustomLengths?: number;
    packets?: number | string;
    status?: 'ACTIVE' | 'INACTIVE';
}

export interface ProtectiveFilmInwardTransaction {
    id: ID;
    filmWidth: string;
    meters: number;
    supplier?: string;
    invoiceNo?: string;
    date: string;
    brand: string;
    notes?: string;
    refNo?: string;
    rollCount?: number;
    totalCost?: number;
    side?: 'TOP' | 'BOTTOM' | 'BOTH' | 'GENERAL' | string;
    costPerMeter?: number;
    createdAt: string;
    deletedAt?: string | null;
}

export interface ProtectiveFilmOutwardAdjustment {
    id: ID;
    filmWidth: string;
    type?: 'TOP' | 'BOTTOM' | 'BOTH' | 'GENERAL' | string;
    meters: number;
    reason: 'SCRAP' | 'DAMAGE' | 'MANUAL_DISPATCH' | 'ADJUSTMENT' | 'SAMPLING';
    refNo: string;
    date: string;
    brand: string;
    notes?: string;
    createdAt: string;
    deletedAt?: string | null;
}

export interface BrandLogo {
    brand: string;
    logoUrl: string;
    logoRightUrl?: string;
    logoScale?: number;
    brandTheme?: string;
}

export interface CompanySettings {
    name: string;
    addressLine1: string;
    addressLine2: string;
    cityStateZip: string;
    gstin: string;
    phone: string;
    email: string;
    bankName: string;
    accountNo: string;
    ifsc: string;
    branch: string;
    terms: string;
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
    logoUrl?: string;
    logoRightUrl?: string;
    state?: string;
    stateCode?: string;
    pan?: string;
    factoryAddress?: string;
    brandLogos?: BrandLogo[];
}

export interface ToastMessage {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

export interface BatchForecastResult {
    maxBatches: number;
    limitingIngredientId?: string;
    limitingIngredientName?: string;
    formula?: any;
    ingredientDetails: {
        itemId: ID;
        name: string;
        uom?: string;
        required?: number;
        requiredQty?: number;
        available?: number;
        availableStock?: number;
        possibleBatches: number;
    }[];
}

export interface ProcessLogSheetData {
    [key: string]: any;
}

export interface TempParam {
    [key: string]: any;
}

export interface GateEntry {
    id: ID;
    gatePassNo: string;
    date: string;
    inTime: string;
    vehicleNo: string;
    driverName: string;
    driverMobile: string;
    company: string;
    personName: string;
    purpose: string;
    materialDetails: string;
    expectedPerson: string;
    securityGuard: string;
    idProofNumber: string;
    status: 'INSIDE' | 'EXITED' | 'PENDING';
}

export interface GateExit {
    id: ID;
    gateEntryId: ID;
    outTime: string;
    securityCheckedBy: string;
    remarks: string;
}

export interface Visitor {
    id: ID;
    name: string;
    mobile: string;
    company: string;
    personToMeet: string;
    department: string;
    purpose: string;
    inTime: string;
    outTime?: string;
    status: 'INSIDE' | 'EXITED';
}

export interface Approval {
    id: ID;
    outwardId: ID;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    approvedBy?: ID;
    remarks: string;
    createdAt: string;
}

export interface AuditLog {
    id: ID;
    user: string;
    action: string;
    module: string;
    recordId: ID;
    date: string;
    oldValue?: any;
    newValue?: any;
}
