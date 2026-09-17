export interface DataPlanColumn {
    id: string;
    label: string;
    type: 'text' | 'number' | 'brand';
    brandName?: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
    isCalculated?: boolean;
    isSystem?: boolean;
}

export interface DataPlanRow {
    id: string;
    slNo: string;
    product: string;
    scraftTotal: string | number;
    smartTotal: string | number;
    twoBrandsTotal: string | number;
    eachPacket: string | number;
    totalPackets: string | number;
    avrPacket: string | number;
    qtyFactor: string | number;
    packetWeight: string | number;
    totalWeight: string | number;
    m1: string;
    m2: string;
    m3: string;
    [extraColKey: string]: string | number;
}

export interface DataPlanSheetState {
    columns: DataPlanColumn[];
    rows: DataPlanRow[];
    selectedBrandFilter: string;
    lastSaved?: string;
}

export const INITIAL_DATA_PLAN_COLUMNS: DataPlanColumn[] = [
    { id: 'slNo', label: 'Sl No', type: 'text', width: '70px', align: 'center' },
    { id: 'scraftTotal', label: 'SCRAFT TOTAL (L)', type: 'brand', brandName: 'Scraft', width: '150px', align: 'right' },
    { id: 'product', label: 'Products', type: 'text', width: '220px', align: 'left' },
    { id: 'smartTotal', label: 'TOTAL SMART (L)', type: 'brand', brandName: 'Smart', width: '150px', align: 'right' },
    { id: 'twoBrandsTotal', label: '2 BRANDS (L)', type: 'number', width: '140px', align: 'right', isCalculated: true },
    { id: 'eachPacket', label: 'EACH PACKET', type: 'number', width: '120px', align: 'center' },
    { id: 'totalPackets', label: 'TOTAL PACKETS', type: 'number', width: '130px', align: 'right', isCalculated: true },
    { id: 'avrPacket', label: 'AVR PACKET', type: 'number', width: '120px', align: 'right', isCalculated: true },
    { id: 'qtyFactor', label: 'QTY / FACTOR', type: 'number', width: '110px', align: 'right' },
    { id: 'packetWeight', label: 'Packet Weight', type: 'number', width: '130px', align: 'right' },
    { id: 'totalWeight', label: 'Total Weight', type: 'number', width: '130px', align: 'right', isCalculated: true },
    { id: 'm1', label: 'M 1', type: 'text', width: '90px', align: 'center' },
    { id: 'm2', label: 'M 2', type: 'text', width: '90px', align: 'center' },
    { id: 'm3', label: 'M 3', type: 'text', width: '90px', align: 'center' }
];

export const INITIAL_DATA_PLAN_ROWS: DataPlanRow[] = [];
