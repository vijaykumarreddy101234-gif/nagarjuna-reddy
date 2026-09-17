export interface ProtectiveFilmItem {
    id: string;
    sNo: number;
    series: string;
    description: string;
    profileCode: string;
    packets?: number | string;
    lengthsPerPacket?: number | string;
    eachLengthMtrs: number;
    meterWeight?: number | string;
    lengthWeightWithGasket?: number | string;
    
    // Top / Right film
    topFilmWidth: string; // e.g. '38', '52', 'NILL'
    topInwardMeters: number; // e.g. 5000
    topMtrPerLength: number; // e.g. 5.9
    topCustomLengths?: number; // Override lengths if custom
    
    // Bottom / Left film
    bottomFilmWidth: string; // e.g. '38', '34', 'NILL'
    bottomInwardMeters: number; // e.g. 5000
    bottomMtrPerLength: number; // e.g. 5.9
    bottomCustomLengths?: number; // Override lengths if custom

    brand?: string;
    notes?: string;
}

export interface ProtectiveFilmInwardTransaction {
    id: string;
    date: string; // ISO
    refNo: string; // Roll / Invoice No
    brand: string; // 'S CRAFT', 'SMART', etc.
    filmWidth: string; // '38', '42', '52' mm
    side?: 'TOP' | 'BOTTOM' | 'BOTH' | 'GENERAL';
    meters: number; // Meters received
    rollCount?: number;
    supplier?: string;
    costPerMeter?: number;
    totalCost?: number;
    notes?: string;
    createdAt: string;
    deletedAt?: string | null;
}

export interface ProtectiveFilmOutwardAdjustment {
    id: string;
    date: string;
    refNo: string;
    brand: string;
    filmWidth: string;
    meters: number;
    reason: 'SCRAP' | 'DAMAGE' | 'MANUAL_DISPATCH' | 'ADJUSTMENT' | 'SAMPLING';
    notes?: string;
    createdAt: string;
    deletedAt?: string | null;
}

export const DEFAULT_PROTECTIVE_FILM_ITEMS: ProtectiveFilmItem[] = [];
