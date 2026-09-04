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
    { id: 'scraftTotal', label: 'S CRAFT TOTAL (L)', type: 'brand', brandName: 'S CRAFT', width: '150px', align: 'right' },
    { id: 'product', label: 'Products', type: 'text', width: '220px', align: 'left' },
    { id: 'smartTotal', label: 'TOTAL SMART (L)', type: 'brand', brandName: 'SMART', width: '150px', align: 'right' },
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

export const INITIAL_DATA_PLAN_ROWS: DataPlanRow[] = [
    { id: 'r1', slNo: '1', scraftTotal: '516', product: '2 TRACK', smartTotal: '758', twoBrandsTotal: '1274', eachPacket: '6', totalPackets: '212', avrPacket: '101', qtyFactor: '50', packetWeight: '33.552', totalWeight: '1677.6', m1: '', m2: '', m3: '' },
    { id: 'r2', slNo: '2', scraftTotal: '872', product: '2.5 TRACK', smartTotal: '1354', twoBrandsTotal: '2226', eachPacket: '4', totalPackets: '557', avrPacket: '265', qtyFactor: '50', packetWeight: '30.384', totalWeight: '1519.2', m1: '', m2: '', m3: '' },
    { id: 'r3', slNo: '3', scraftTotal: '461', product: '3 TRACK', smartTotal: '1244', twoBrandsTotal: '1705', eachPacket: '4', totalPackets: '426', avrPacket: '203', qtyFactor: '50', packetWeight: '39.14', totalWeight: '1957', m1: '', m2: '', m3: '' },
    { id: 'r4', slNo: '4', scraftTotal: '1994', product: 'S.SASH ', smartTotal: '2688', twoBrandsTotal: '4682', eachPacket: '6', totalPackets: '780', avrPacket: '372', qtyFactor: '50', packetWeight: '30.9', totalWeight: '1545', m1: '', m2: '', m3: '' },
    { id: 'r5', slNo: '5', scraftTotal: '600', product: 'MID SASH', smartTotal: '568', twoBrandsTotal: '1168', eachPacket: '6', totalPackets: '195', avrPacket: '93', qtyFactor: '50', packetWeight: '33.798', totalWeight: '1689.9', m1: '', m2: '', m3: '' },
    { id: 'r6', slNo: '6', scraftTotal: '267', product: 'BIG SASH', smartTotal: '367', twoBrandsTotal: '634', eachPacket: '6', totalPackets: '106', avrPacket: '50', qtyFactor: '66', packetWeight: '42.924', totalWeight: '2832.984', m1: '', m2: '', m3: '' },
    { id: 'r7', slNo: '7', scraftTotal: '748', product: 'MESH', smartTotal: '1560', twoBrandsTotal: '2308', eachPacket: '12', totalPackets: '192', avrPacket: '92', qtyFactor: '50', packetWeight: '34.2', totalWeight: '1710', m1: '', m2: '', m3: '' },
    { id: 'r8', slNo: '8', scraftTotal: '204', product: 'Mesh+mulion', smartTotal: '216', twoBrandsTotal: '420', eachPacket: '12', totalPackets: '35', avrPacket: '17', qtyFactor: '20', packetWeight: '43.224', totalWeight: '864.48', m1: '', m2: '', m3: '' },
    { id: 'r9', slNo: '', scraftTotal: '80', product: '11.5 BEAD', smartTotal: '0', twoBrandsTotal: '80', eachPacket: '20', totalPackets: '4', avrPacket: '2', qtyFactor: '', packetWeight: '23.6', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r10', slNo: '9', scraftTotal: '2530', product: 'S.BEAD', smartTotal: '5650', twoBrandsTotal: '8180', eachPacket: '20', totalPackets: '409', avrPacket: '195', qtyFactor: '50', packetWeight: '30.7', totalWeight: '1535', m1: '', m2: '', m3: '' },
    { id: 'r11', slNo: '10', scraftTotal: '1044', product: 'B.BEAD', smartTotal: '1696', twoBrandsTotal: '2740', eachPacket: '20', totalPackets: '137', avrPacket: '65', qtyFactor: '71', packetWeight: '41', totalWeight: '2911', m1: '', m2: '', m3: '' },
    { id: 'r12', slNo: '11', scraftTotal: '920', product: 'INTER.LOC', smartTotal: '1300', twoBrandsTotal: '2220', eachPacket: '20', totalPackets: '111', avrPacket: '53', qtyFactor: '52', packetWeight: '24.3', totalWeight: '1263.6', m1: '', m2: '', m3: '' },
    { id: 'r13', slNo: '12', scraftTotal: '231', product: 'S.C.OUTER', smartTotal: '762', twoBrandsTotal: '993', eachPacket: '6', totalPackets: '166', avrPacket: '79', qtyFactor: '36', packetWeight: '20.7', totalWeight: '745.2', m1: '', m2: '', m3: '' },
    { id: 'r14', slNo: '13', scraftTotal: '961', product: 'C.FRAME', smartTotal: '1404', twoBrandsTotal: '2365', eachPacket: '6', totalPackets: '394', avrPacket: '188', qtyFactor: '50', packetWeight: '36.45', totalWeight: '1822.5', m1: '', m2: '', m3: '' },
    { id: 'r15', slNo: '14', scraftTotal: '212', product: 'C.OUT  W SASH', smartTotal: '481', twoBrandsTotal: '693', eachPacket: '6', totalPackets: '116', avrPacket: '55', qtyFactor: '67', packetWeight: '44.1', totalWeight: '2954.7', m1: '', m2: '', m3: '' },
    { id: 'r16', slNo: '15', scraftTotal: '74', product: 'outward sash 104', smartTotal: '188', twoBrandsTotal: '262', eachPacket: '4', totalPackets: '66', avrPacket: '31', qtyFactor: '15', packetWeight: '44.1', totalWeight: '661.5', m1: '', m2: '', m3: '' },
    { id: 'r17', slNo: '', scraftTotal: '84', product: '104 IN WARD', smartTotal: '60', twoBrandsTotal: '144', eachPacket: '6', totalPackets: '24', avrPacket: '11', qtyFactor: '', packetWeight: '38.256', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r18', slNo: '16', scraftTotal: '72', product: 'Sash Mulion', smartTotal: '278', twoBrandsTotal: '350', eachPacket: '6', totalPackets: '58', avrPacket: '28', qtyFactor: '15', packetWeight: '26.334', totalWeight: '395.01', m1: '', m2: '', m3: '' },
    { id: 'r19', slNo: '17', scraftTotal: '211', product: 'T.MULION', smartTotal: '426', twoBrandsTotal: '637', eachPacket: '6', totalPackets: '106', avrPacket: '51', qtyFactor: '50', packetWeight: '34.848', totalWeight: '1742.4', m1: '', m2: '', m3: '' },
    { id: 'r20', slNo: '18', scraftTotal: '12', product: 'Z MULION', smartTotal: '0', twoBrandsTotal: '12', eachPacket: '6', totalPackets: '2', avrPacket: '1', qtyFactor: '', packetWeight: '39.27', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r21', slNo: '19', scraftTotal: '12', product: 'FLY MULION', smartTotal: '0', twoBrandsTotal: '12', eachPacket: '6', totalPackets: '2', avrPacket: '1', qtyFactor: '', packetWeight: '31.698', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r22', slNo: '', scraftTotal: '40', product: '60 SASH ( MG)', smartTotal: '1448', twoBrandsTotal: '1488', eachPacket: '8', totalPackets: '186', avrPacket: '89', qtyFactor: '', packetWeight: '36.624', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r23', slNo: '', scraftTotal: '126', product: '59 SASH (MG)', smartTotal: '774', twoBrandsTotal: '900', eachPacket: '6', totalPackets: '150', avrPacket: '71', qtyFactor: '', packetWeight: '30.9', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r24', slNo: '', scraftTotal: '126', product: '67 SASH (MG)', smartTotal: '1002', twoBrandsTotal: '1128', eachPacket: '6', totalPackets: '188', avrPacket: '90', qtyFactor: '', packetWeight: '33.798', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r25', slNo: '', scraftTotal: '84', product: '84 SASH (MG)', smartTotal: '204', twoBrandsTotal: '288', eachPacket: '6', totalPackets: '48', avrPacket: '23', qtyFactor: '', packetWeight: '42.924', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r26', slNo: '', scraftTotal: '56', product: '60 SASH ( WITH OUT G)', smartTotal: '75', twoBrandsTotal: '131', eachPacket: '8', totalPackets: '16.375', avrPacket: '8', qtyFactor: '', packetWeight: '36.624', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r27', slNo: '', scraftTotal: '6', product: '59 SASH ( WITH OUT G)', smartTotal: '48', twoBrandsTotal: '54', eachPacket: '6', totalPackets: '9', avrPacket: '4', qtyFactor: '', packetWeight: '30.9', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r28', slNo: '', scraftTotal: '6', product: '67 SASH (WITH OUT G)', smartTotal: '12', twoBrandsTotal: '18', eachPacket: '6', totalPackets: '3', avrPacket: '1', qtyFactor: '', packetWeight: '33.798', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r29', slNo: '', scraftTotal: '0', product: '84 SASH WITH OUT G)', smartTotal: '0', twoBrandsTotal: '0', eachPacket: '6', totalPackets: '0', avrPacket: '0', qtyFactor: '', packetWeight: '42.924', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r30', slNo: '20', scraftTotal: '158', product: '2 TRACK', smartTotal: '972', twoBrandsTotal: '1130', eachPacket: '6', totalPackets: '188', avrPacket: '90', qtyFactor: '50', packetWeight: '29.202', totalWeight: '1460.1', m1: '', m2: '', m3: '' },
    { id: 'r31', slNo: '21', scraftTotal: '363', product: '2.5 TRACK', smartTotal: '1444', twoBrandsTotal: '1807', eachPacket: '6', totalPackets: '301', avrPacket: '143', qtyFactor: '50', packetWeight: '41.802', totalWeight: '2090.1', m1: '', m2: '', m3: '' },
    { id: 'r32', slNo: '22', scraftTotal: '360', product: '95MM TRACK', smartTotal: '2002', twoBrandsTotal: '2362', eachPacket: '4', totalPackets: '591', avrPacket: '281', qtyFactor: '50', packetWeight: '31.764', totalWeight: '1588.2', m1: '', m2: '', m3: '' },
    { id: 'r33', slNo: '23', scraftTotal: '1098', product: 'S.SASH ', smartTotal: '5674', twoBrandsTotal: '6772', eachPacket: '8', totalPackets: '847', avrPacket: '403', qtyFactor: '50', packetWeight: '36.624', totalWeight: '1831.2', m1: '', m2: '', m3: '' },
    { id: 'r34', slNo: '24', scraftTotal: '977', product: 'S.BEAD', smartTotal: '7969', twoBrandsTotal: '8946', eachPacket: '25', totalPackets: '358', avrPacket: '170', qtyFactor: '50', packetWeight: '27.285', totalWeight: '1364.25', m1: '', m2: '', m3: '' },
    { id: 'r35', slNo: '25', scraftTotal: '140', product: 'INTER.LOC', smartTotal: '2602', twoBrandsTotal: '2742', eachPacket: '20', totalPackets: '137', avrPacket: '65', qtyFactor: '35', packetWeight: '22.64', totalWeight: '792.4', m1: '', m2: '', m3: '' },
    { id: 'r36', slNo: '27', scraftTotal: '50', product: 'CJC ( 60-112)', smartTotal: '0', twoBrandsTotal: '50', eachPacket: '4', totalPackets: '13', avrPacket: '6', qtyFactor: '20', packetWeight: '10.448', totalWeight: '208.96', m1: '', m2: '', m3: '' },
    { id: 'r37', slNo: '28', scraftTotal: '18', product: 'CJC (60-92)', smartTotal: '0', twoBrandsTotal: '18', eachPacket: '4', totalPackets: '5', avrPacket: '2', qtyFactor: '10', packetWeight: '12.276', totalWeight: '122.76', m1: '', m2: '', m3: '' },
    { id: 'r38', slNo: '29', scraftTotal: '298', product: 'GORGIAB BAR', smartTotal: '0', twoBrandsTotal: '298', eachPacket: '12', totalPackets: '25', avrPacket: '12', qtyFactor: '15', packetWeight: '16.16', totalWeight: '242.4', m1: '', m2: '', m3: '' },
    { id: 'r39', slNo: '30', scraftTotal: '296', product: 'DOOR PANEL', smartTotal: '272', twoBrandsTotal: '568', eachPacket: '8', totalPackets: '71', avrPacket: '34', qtyFactor: '50', packetWeight: '24.848', totalWeight: '1242.4', m1: '', m2: '', m3: '' },
    { id: 'r40', slNo: '31', scraftTotal: '28', product: 'OPENBLE MESH', smartTotal: '0', twoBrandsTotal: '28', eachPacket: '6', totalPackets: '5', avrPacket: '2', qtyFactor: '10', packetWeight: '30.666', totalWeight: '306.66', m1: '', m2: '', m3: '' },
    { id: 'r41', slNo: '32', scraftTotal: '18', product: 'BYPOLE (60-60)', smartTotal: '9', twoBrandsTotal: '27', eachPacket: '4', totalPackets: '7', avrPacket: '3', qtyFactor: '10', packetWeight: '16.66', totalWeight: '166.6', m1: '', m2: '', m3: '' },
    { id: 'r42', slNo: '33', scraftTotal: '12', product: 'BYPOLE (60-92)', smartTotal: '0', twoBrandsTotal: '12', eachPacket: '4', totalPackets: '3', avrPacket: '1', qtyFactor: '10', packetWeight: '21.328', totalWeight: '213.28', m1: '', m2: '', m3: '' },
    { id: 'r43', slNo: '34', scraftTotal: '0', product: 'TRACK CONNECTOR', smartTotal: '0', twoBrandsTotal: '0', eachPacket: '12', totalPackets: '0', avrPacket: '0', qtyFactor: '10', packetWeight: '27.54', totalWeight: '275.4', m1: '', m2: '', m3: '' },
    { id: 'r44', slNo: '35', scraftTotal: '57', product: 'A02', smartTotal: '48', twoBrandsTotal: '105', eachPacket: '16', totalPackets: '7', avrPacket: '3', qtyFactor: '25', packetWeight: '46.4', totalWeight: '1160', m1: '', m2: '', m3: '' },
    { id: 'r45', slNo: '36', scraftTotal: '124', product: 'MESH CONNECTOR', smartTotal: '670', twoBrandsTotal: '794', eachPacket: '20', totalPackets: '40', avrPacket: '19', qtyFactor: '15', packetWeight: '15.82', totalWeight: '237.3', m1: '', m2: '', m3: '' },
    { id: 'r46', slNo: '37', scraftTotal: '60', product: 'SASH CONNECTOR', smartTotal: '62', twoBrandsTotal: '122', eachPacket: '20', totalPackets: '6', avrPacket: '3', qtyFactor: '15', packetWeight: '43', totalWeight: '645', m1: '', m2: '', m3: '' },
    { id: 'r47', slNo: '38', scraftTotal: '316', product: 'H-COUPLER', smartTotal: '163', twoBrandsTotal: '479', eachPacket: '50', totalPackets: '10', avrPacket: '5', qtyFactor: '25', packetWeight: '35', totalWeight: '875', m1: '', m2: '', m3: '' },
    { id: 'r48', slNo: '', scraftTotal: '69', product: '2 TRACK', smartTotal: '0', twoBrandsTotal: '69', eachPacket: '6', totalPackets: '12', avrPacket: '5', qtyFactor: '', packetWeight: '33.552', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r49', slNo: '', scraftTotal: '77', product: '2.5 TRACK', smartTotal: '0', twoBrandsTotal: '77', eachPacket: '4', totalPackets: '19', avrPacket: '9', qtyFactor: '', packetWeight: '30.384', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r50', slNo: '', scraftTotal: '99', product: '3 TRACK', smartTotal: '0', twoBrandsTotal: '99', eachPacket: '4', totalPackets: '25', avrPacket: '12', qtyFactor: '', packetWeight: '39.14', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r51', slNo: '', scraftTotal: '129', product: '59  SMALL SASH', smartTotal: '0', twoBrandsTotal: '129', eachPacket: '6', totalPackets: '22', avrPacket: '10', qtyFactor: '', packetWeight: '30.9', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r52', slNo: '', scraftTotal: '218', product: '67 MID  SASH', smartTotal: '0', twoBrandsTotal: '218', eachPacket: '6', totalPackets: '36', avrPacket: '17', qtyFactor: '', packetWeight: '33.798', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r53', slNo: '', scraftTotal: '36', product: '84 BIGG SASH', smartTotal: '0', twoBrandsTotal: '36', eachPacket: '6', totalPackets: '6', avrPacket: '3', qtyFactor: '', packetWeight: '42.924', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r54', slNo: '', scraftTotal: '69', product: '53 MESH', smartTotal: '0', twoBrandsTotal: '69', eachPacket: '12', totalPackets: '6', avrPacket: '3', qtyFactor: '', packetWeight: '34.2', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r55', slNo: '', scraftTotal: '24', product: '61 MESH', smartTotal: '0', twoBrandsTotal: '24', eachPacket: '12', totalPackets: '2', avrPacket: '1', qtyFactor: '', packetWeight: '43.224', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r56', slNo: '', scraftTotal: '362', product: '24.5 SMALL BEAD', smartTotal: '0', twoBrandsTotal: '362', eachPacket: '20', totalPackets: '18', avrPacket: '9', qtyFactor: '', packetWeight: '30.7', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r57', slNo: '', scraftTotal: '244', product: '35 BIGG BEAD', smartTotal: '0', twoBrandsTotal: '244', eachPacket: '20', totalPackets: '12', avrPacket: '6', qtyFactor: '', packetWeight: '41', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r58', slNo: '', scraftTotal: '151', product: '44 INTERLOCK', smartTotal: '0', twoBrandsTotal: '151', eachPacket: '20', totalPackets: '8', avrPacket: '4', qtyFactor: '', packetWeight: '24.3', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r59', slNo: '', scraftTotal: '182', product: 'C.FRAME', smartTotal: '0', twoBrandsTotal: '182', eachPacket: '6', totalPackets: '30', avrPacket: '14', qtyFactor: '', packetWeight: '36.45', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r60', slNo: '', scraftTotal: '95', product: 'C.OUT DOOR', smartTotal: '0', twoBrandsTotal: '95', eachPacket: '6', totalPackets: '16', avrPacket: '8', qtyFactor: '', packetWeight: '44.1', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r61', slNo: '', scraftTotal: '62', product: 'T.MULION', smartTotal: '0', twoBrandsTotal: '62', eachPacket: '6', totalPackets: '10', avrPacket: '5', qtyFactor: '', packetWeight: '34.848', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r62', slNo: '', scraftTotal: '20', product: '104', smartTotal: '0', twoBrandsTotal: '20', eachPacket: '4', totalPackets: '5', avrPacket: '2', qtyFactor: '', packetWeight: '44.1', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r63', slNo: '', scraftTotal: '50', product: '104 IN WARD ', smartTotal: '0', twoBrandsTotal: '50', eachPacket: '4', totalPackets: '13', avrPacket: '6', qtyFactor: '', packetWeight: '38.256', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r64', slNo: '', scraftTotal: '50', product: 'H COUPLER', smartTotal: '0', twoBrandsTotal: '50', eachPacket: '50', totalPackets: '1', avrPacket: '0', qtyFactor: '', packetWeight: '35', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r65', slNo: '', scraftTotal: '4', product: 'SASH MULION', smartTotal: '0', twoBrandsTotal: '4', eachPacket: '6', totalPackets: '1', avrPacket: '0', qtyFactor: '', packetWeight: '26.334', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r66', slNo: '', scraftTotal: '12', product: 'Z MULION', smartTotal: '0', twoBrandsTotal: '12', eachPacket: '6', totalPackets: '2', avrPacket: '1', qtyFactor: '', packetWeight: '39.27', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r67', slNo: '', scraftTotal: '12', product: 'FLY MULION', smartTotal: '0', twoBrandsTotal: '12', eachPacket: '6', totalPackets: '2', avrPacket: '1', qtyFactor: '', packetWeight: '31.698', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r68', slNo: '', scraftTotal: '8', product: 'MESH CONNECTOR', smartTotal: '0', twoBrandsTotal: '8', eachPacket: '20', totalPackets: '0', avrPacket: '0', qtyFactor: '', packetWeight: '15.82', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r69', slNo: '', scraftTotal: '120', product: 'DOOR PANEL', smartTotal: '0', twoBrandsTotal: '120', eachPacket: '8', totalPackets: '15', avrPacket: '7', qtyFactor: '', packetWeight: '24.848', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r70', slNo: '', scraftTotal: '20', product: 'SASH CONNECTOR', smartTotal: '0', twoBrandsTotal: '20', eachPacket: '20', totalPackets: '1', avrPacket: '0', qtyFactor: '', packetWeight: '43', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r71', slNo: '', scraftTotal: '25', product: 'CJC ( 60-112)', smartTotal: '0', twoBrandsTotal: '25', eachPacket: '4', totalPackets: '6', avrPacket: '3', qtyFactor: '', packetWeight: '10.448', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r72', slNo: '', scraftTotal: '10', product: 'CJC (60-92)', smartTotal: '0', twoBrandsTotal: '10', eachPacket: '4', totalPackets: '3', avrPacket: '1', qtyFactor: '', packetWeight: '12.276', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r73', slNo: '', scraftTotal: '10', product: 'BYPOLE (60-60)', smartTotal: '0', twoBrandsTotal: '10', eachPacket: '4', totalPackets: '3', avrPacket: '1', qtyFactor: '', packetWeight: '16.66', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r74', slNo: '', scraftTotal: '10', product: 'BYPOLE (60-92)', smartTotal: '0', twoBrandsTotal: '10', eachPacket: '4', totalPackets: '3', avrPacket: '1', qtyFactor: '', packetWeight: '21.328', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r75', slNo: '', scraftTotal: '30', product: 'GORGIAB BAR', smartTotal: '0', twoBrandsTotal: '30', eachPacket: '12', totalPackets: '3', avrPacket: '1', qtyFactor: '', packetWeight: '16.16', totalWeight: '0', m1: '', m2: '', m3: '' },
    { id: 'r76', slNo: '', scraftTotal: '20', product: '11.5 BEAD', smartTotal: '0', twoBrandsTotal: '20', eachPacket: '20', totalPackets: '1', avrPacket: '0', qtyFactor: '', packetWeight: '23.6', totalWeight: '0', m1: '', m2: '', m3: '' }
];
