import React from 'react';
import { PlusIcon, TrashIcon, EyeIcon, EyeOffIcon } from './Icon';
import type { QuotationItem, CustomColumn } from '../pages/Quotation';

interface QuotationSpreadsheetGridProps {
  items: QuotationItem[];
  reinforcements: QuotationItem[];
  hiddenCols: Set<string>;
  customColumns: CustomColumn[];
  selectedBrand: string;
  availableBrands: string[];
  builderTab: 'profiles' | 'reinforcements';
  selectedRowId: string | null;
  selectedRowType: 'items' | 'reinforcements' | null;
  showGroupedHeaders: boolean;
  totalVisibleCols: number;
  getGroupColSpan: (group: 'basic' | 'length' | 'weight' | 'rate') => number;
  calculateRowTotal: (item: QuotationItem) => { totalLength: number; totalWeight: number; ratePerMeter: number; amount: number };
  updateItemValue: (type: 'items' | 'reinforcements', idx: number, field: string, value: any) => void;
  updateCustomField: (type: 'items' | 'reinforcements', idx: number, colId: string, value: string) => void;
  setSelectedRowId: (id: string | null) => void;
  setSelectedRowType: (type: 'items' | 'reinforcements' | null) => void;
  insertRow: (type: 'items' | 'reinforcements', targetIndex: number, position: 'above' | 'below', isMerged?: boolean) => void;
  toggleMergeCenter: (type: 'items' | 'reinforcements', id: string) => void;
  deleteRow: (type: 'items' | 'reinforcements', id: string) => void;
  toggleRowVisibility: (type: 'items' | 'reinforcements', id: string) => void;
  deleteCustomColumn: (id: string) => void;
  addProfileRow: () => void;
  addReinforcementRow: () => void;
}

export const QuotationSpreadsheetGrid = ({
  items,
  reinforcements,
  hiddenCols,
  customColumns,
  selectedBrand,
  availableBrands,
  builderTab,
  selectedRowId,
  selectedRowType,
  showGroupedHeaders,
  totalVisibleCols,
  getGroupColSpan,
  calculateRowTotal,
  updateItemValue,
  updateCustomField,
  setSelectedRowId,
  setSelectedRowType,
  insertRow,
  toggleMergeCenter,
  deleteRow,
  toggleRowVisibility,
  deleteCustomColumn,
  addProfileRow,
  addReinforcementRow,
}) => {
  let slNoCounter = 0;

  // Helper to render custom column headers inserted after a given standard column
  const renderCustomHeader = (afterCol: string) => {
    return customColumns
      .filter(c => c.insertAfter === afterCol && !hiddenCols.has(c.id))
      .map(c => (
        <th key={c.id} className="border-r border-black p-2 min-w-[110px] bg-sky-100 text-sky-950 group/th">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate">{c.name}</span>
            <button
              onClick={() => deleteCustomColumn(c.id)}
              className="no-print text-red-500 hover:text-red-700 opacity-0 group-hover/th:opacity-100 transition-opacity font-bold"
              title="Delete this custom column"
            >
              ✕
            </button>
          </div>
        </th>
      ));
  };

  // Helper to render custom column data cells
  const renderCustomDataCells = (type: 'items' | 'reinforcements', item: QuotationItem, idx: number, afterCol: string) => {
    return customColumns
      .filter(c => c.insertAfter === afterCol && !hiddenCols.has(c.id))
      .map(c => (
        <td key={c.id} className="border-r border-slate-300 p-0.5 bg-sky-50/30">
          <input
            type="text"
            value={item.customFields?.[c.id] || ''}
            onChange={e => updateCustomField(type, idx, c.id, e.target.value)}
            placeholder="..."
            className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-sky-500 focus:bg-white px-1 py-1.5 text-center outline-none rounded transition-all font-semibold text-xs text-slate-800"
          />
        </td>
      ));
  };

  // Render a row (either merged full-width banner or normal cells)
  const renderRow = (item: QuotationItem, idx: number, type: 'items' | 'reinforcements') => {
    const isVisibleInBrand = selectedBrand === "All" || item.brand === selectedBrand;
    if (!isVisibleInBrand) return null;

    const isSelected = selectedRowId === item.id;
    if (!item.isHidden) slNoCounter++;

    // --- CASE A: MERGED & CENTERED ROW (Excel Style) ---
    if (item.isMerged) {
      const bgMap = {
        gray: 'bg-slate-100 text-slate-900 border-slate-300',
        yellow: 'bg-amber-100 text-amber-950 border-amber-300',
        blue: 'bg-indigo-100 text-indigo-950 border-indigo-300',
        green: 'bg-emerald-100 text-emerald-950 border-emerald-300',
        white: 'bg-white text-slate-900 border-slate-300',
      };
      const bgClass = bgMap[item.mergedBg || 'gray'];
      const alignClass = item.mergedAlign === 'left' ? 'text-left pl-4' : item.mergedAlign === 'right' ? 'text-right pr-4' : 'text-center';

      return (
        <tr
          key={item.id}
          onClick={() => {
            setSelectedRowId(item.id);
            setSelectedRowType(type);
          }}
          className={`border-b-2 border-slate-400 group transition-all cursor-pointer ${
            isSelected ? 'ring-2 ring-indigo-500 ring-inset shadow-md' : 'hover:brightness-95'
          } ${item.isHidden ? 'opacity-40 bg-slate-200/60' : ''}`}
        >
          <td colSpan={totalVisibleCols - 1} className={`p-2.5 ${bgClass} border-r border-slate-400 transition-all`}>
            <div className={`flex items-center gap-3 ${alignClass}`}>
              <span className="no-print text-xs font-black text-indigo-600 bg-white/80 px-2 py-0.5 rounded shadow-2xs">
                🔀 MERGED
              </span>
              <input
                type="text"
                value={item.mergedText || ''}
                onChange={e => updateItemValue(type, idx, 'mergedText', e.target.value)}
                placeholder="Type merged heading, sub-total title, or section note here..."
                className={`flex-1 bg-transparent border-b border-transparent hover:border-slate-400 focus:border-indigo-600 outline-none font-black text-sm px-2 py-1 transition-all ${alignClass}`}
              />
              <div className="no-print flex items-center gap-1 opacity-80 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMergeCenter(type, item.id);
                  }}
                  className="text-[9px] font-bold bg-white text-slate-700 hover:text-indigo-600 border border-slate-300 px-2 py-0.5 rounded shadow-2xs"
                  title="Split back into standard columns"
                >
                  Unmerge
                </button>
                {/* BG color picker */}
                <div className="flex items-center gap-0.5 bg-white/70 p-0.5 rounded border border-slate-300">
                  {(['gray', 'yellow', 'blue', 'green', 'white'] as const).map(c => (
                    <button
                      key={c}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateItemValue(type, idx, 'mergedBg', c);
                      }}
                      className={`w-3 h-3 rounded-full border border-slate-400 ${
                        c === 'gray' ? 'bg-slate-300' : c === 'yellow' ? 'bg-amber-300' : c === 'blue' ? 'bg-indigo-300' : c === 'green' ? 'bg-emerald-300' : 'bg-white'
                      } ${item.mergedBg === c ? 'scale-125 ring-1 ring-black' : ''}`}
                      title={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </td>

          {/* Action column */}
          <td className="no-print border-slate-400 p-1 text-center bg-slate-100">
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  insertRow(type, idx, 'above', false);
                }}
                className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                title="Insert normal row above"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRowVisibility(type, item.id);
                }}
                className={`p-1 transition-all ${item.isHidden ? 'text-red-500' : 'text-slate-400 hover:text-slate-800'}`}
                title={item.isHidden ? "Show Row" : "Hide Row"}
              >
                {item.isHidden ? <EyeOffIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteRow(type, item.id);
                }}
                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all"
                title="Delete Row"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </td>
        </tr>
      );
    }

    // --- CASE B: NORMAL DATA ROW ---
    const { totalLength, totalWeight, ratePerMeter, amount } = calculateRowTotal(item);

    return (
      <tr
        key={item.id}
        onClick={() => {
          setSelectedRowId(item.id);
          setSelectedRowType(type);
        }}
        className={`border-b border-slate-200 transition-colors group cursor-pointer ${
          isSelected 
            ? 'bg-blue-50/70 ring-1 ring-blue-400 ring-inset' 
            : idx % 2 === 0 ? 'bg-white hover:bg-blue-50/30' : 'bg-slate-50/40 hover:bg-blue-50/40'
        } ${item.isHidden ? 'opacity-35 bg-slate-100 line-through' : ''}`}
      >
        {/* Sl.No */}
        {!hiddenCols.has('slNo') && (
          <td className="border-r border-slate-300 p-1 font-bold text-slate-500 text-center select-none w-12 min-w-[50px] max-w-[56px]">
            {item.isHidden ? "-" : slNoCounter}
          </td>
        )}

        {/* Description */}
        {!hiddenCols.has('description') && (
          <td className="border-r border-slate-300 p-0.5 text-left font-semibold">
            <input
              type="text"
              value={item.description}
              onChange={e => updateItemValue(type, idx, "description", e.target.value)}
              className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-600 focus:bg-white px-2 py-1 outline-none rounded transition-all text-xs font-bold text-slate-800"
            />
          </td>
        )}
        {renderCustomDataCells(type, item, idx, 'description')}

        {/* HSN Code */}
        {!hiddenCols.has('hsn') && (
          <td className="border-r border-slate-300 p-0.5">
            <input
              type="text"
              value={item.hsn}
              onChange={e => updateItemValue(type, idx, "hsn", e.target.value)}
              className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-600 focus:bg-white px-1 py-1 text-center outline-none rounded transition-all text-xs font-mono text-slate-600"
            />
          </td>
        )}
        {renderCustomDataCells(type, item, idx, 'hsn')}

        {/* Brand */}
        {!hiddenCols.has('brand') && (
          <td className="border-r border-slate-300 p-0.5">
            <select
              value={item.brand}
              onChange={e => updateItemValue(type, idx, "brand", e.target.value)}
              className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-600 focus:bg-white px-1 py-1 text-center outline-none rounded transition-all text-[11px] font-bold text-slate-700 cursor-pointer"
            >
              {availableBrands.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </td>
        )}
        {renderCustomDataCells(type, item, idx, 'brand')}

        {/* Profile Code */}
        {!hiddenCols.has('profileCode') && (
          <td className="border-r border-slate-300 p-0.5">
            <input
              type="text"
              value={item.profileCode}
              onChange={e => updateItemValue(type, idx, "profileCode", e.target.value)}
              className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-600 focus:bg-white px-1 py-1 text-center outline-none rounded transition-all text-xs font-mono font-bold text-slate-700"
            />
          </td>
        )}
        {renderCustomDataCells(type, item, idx, 'profileCode')}

        {/* Packets */}
        {!hiddenCols.has('packets') && (
          <td className="border-r border-slate-300 p-0.5">
            <input
              type="number"
              value={item.packets || 0}
              onChange={e => updateItemValue(type, idx, "packets", e.target.value)}
              className="w-full bg-emerald-50/50 hover:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:bg-white px-1 py-1.5 text-center outline-none rounded transition-all font-bold text-emerald-900 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>
        )}
        {renderCustomDataCells(type, item, idx, 'packets')}

        {/* Lengths in Packet (L/Pkt) - Enhanced Visibility */}
        {!hiddenCols.has('lengthsInPkt') && (
          <td className="border-r border-slate-300 p-0.5 bg-blue-50/30">
            <input
              type="number"
              value={item.lengthsInPkt || 0}
              onChange={e => updateItemValue(type, idx, "lengthsInPkt", e.target.value)}
              className="w-full bg-blue-100/70 hover:bg-white border border-blue-300 hover:border-blue-400 focus:border-indigo-600 focus:bg-yellow-50/40 px-1 py-1.5 text-center outline-none rounded transition-all font-black text-blue-900 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>
        )}
        {renderCustomDataCells(type, item, idx, 'lengthsInPkt')}

        {/* Total Length (Calculated) */}
        {!hiddenCols.has('totalL') && (
          <td className="border-r border-slate-300 px-1 py-1.5 font-black text-blue-900 text-center text-xs bg-slate-50">
            {totalLength.toFixed(2)}
          </td>
        )}
        {renderCustomDataCells(type, item, idx, 'totalL')}

        {/* Each Length - Enhanced Visibility */}
        {!hiddenCols.has('eachL') && (
          <td className="border-r border-slate-300 p-0.5 bg-amber-50/30">
            <input
              type="number"
              step="0.001"
              value={item.eachLength || 0}
              onChange={e => updateItemValue(type, idx, "eachLength", e.target.value)}
              className="w-full bg-amber-100/70 hover:bg-white border border-amber-300 hover:border-amber-400 focus:border-indigo-600 focus:bg-yellow-50/40 px-1 py-1.5 text-center outline-none rounded transition-all font-black text-amber-950 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>
        )}
        {renderCustomDataCells(type, item, idx, 'eachL')}

        {/* Length Weight */}
        {!hiddenCols.has('lengthWt') && (
          <td className="border-r border-slate-300 p-0.5">
            <input
              type="number"
              step="0.001"
              value={item.lengthWeight || 0}
              onChange={e => updateItemValue(type, idx, "lengthWeight", e.target.value)}
              className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-600 focus:bg-white px-1 py-1 text-center outline-none rounded transition-all font-bold text-slate-700 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>
        )}
        {renderCustomDataCells(type, item, idx, 'lengthWt')}

        {/* Meter Weight */}
        {!hiddenCols.has('meterWt') && (
          <td className="border-r border-slate-300 p-0.5">
            <input
              type="number"
              step="0.001"
              value={item.meterWeight || 0}
              onChange={e => updateItemValue(type, idx, "meterWeight", e.target.value)}
              className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-600 focus:bg-white px-1 py-1 text-center outline-none rounded transition-all font-bold text-slate-700 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>
        )}
        {renderCustomDataCells(type, item, idx, 'meterWt')}

        {/* Total Weight */}
        {!hiddenCols.has('totalWt') && (
          <td className="border-r border-slate-300 px-1 py-1.5 font-black text-blue-900 text-center text-xs bg-slate-50">
            {totalWeight.toFixed(3)}
          </td>
        )}
        {renderCustomDataCells(type, item, idx, 'totalWt')}

        {/* Rate / Kg */}
        {!hiddenCols.has('rateKg') && (
          <td className="border-r border-slate-300 p-0.5">
            <input
              type="number"
              value={item.ratePerKg || 0}
              onChange={e => updateItemValue(type, idx, "ratePerKg", e.target.value)}
              className="w-full bg-red-50/50 hover:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:bg-yellow-50/40 px-1 py-1.5 text-center outline-none rounded transition-all font-black text-red-700 text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </td>
        )}
        {renderCustomDataCells(type, item, idx, 'rateKg')}

        {/* Rate / MTR */}
        {!hiddenCols.has('rateMtr') && (
          <td className="border-r border-slate-300 px-1 py-1.5 text-center font-bold text-slate-600 text-xs bg-slate-50">
            {type === 'reinforcements' ? '-' : (ratePerMeter > 0 ? ratePerMeter.toFixed(2) : '-')}
          </td>
        )}
        {renderCustomDataCells(type, item, idx, 'rateMtr')}

        {/* Amount */}
        <td className="border-r border-slate-300 px-2 py-1.5 font-black text-right pr-2 min-w-[110px] text-slate-900 text-xs bg-yellow-50/20">
          {amount > 0 ? amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : "-"}
        </td>
        {renderCustomDataCells(type, item, idx, 'end')}

        {/* Actions Cell */}
        <td className="no-print border-slate-300 p-1 text-center bg-slate-50">
          <div className="flex items-center justify-center gap-1">
            {/* 1-Click Merge & Center */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMergeCenter(type, item.id);
              }}
              className="px-1.5 py-0.5 text-[9px] font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-all shadow-2xs"
              title="Merge row across all columns (Excel Merge & Center)"
            >
              🔀 Merge
            </button>

            {/* Insert Above */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                insertRow(type, idx, 'above', false);
              }}
              className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-all"
              title="Insert new row above"
            >
              <PlusIcon className="w-3 h-3 text-emerald-600" />
            </button>

            {/* Visibility Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleRowVisibility(type, item.id);
              }}
              className={`p-1 transition-all ${item.isHidden ? 'text-red-500 opacity-100' : 'text-slate-400 hover:text-slate-800 opacity-60 group-hover:opacity-100'}`}
              title={item.isHidden ? "Show Row" : "Hide Row"}
            >
              {item.isHidden ? <EyeOffIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
            </button>

            {/* Delete */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteRow(type, item.id);
              }}
              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all opacity-80 group-hover:opacity-100"
              title="Delete Row"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-black shadow-sm">
      <table className="min-w-[1550px] w-full text-[10px] border-collapse text-center">
        <thead className="bg-gray-100 uppercase font-black tracking-tighter">
          {/* Optional Excel 2-Tier Group Headers */}
          {showGroupedHeaders && (
            <tr className="bg-slate-200 text-slate-800 border-b border-black text-[10px] font-black tracking-wider uppercase">
              <th colSpan={getGroupColSpan('basic')} className="border-r border-black p-1 text-center bg-blue-100/70">
                1. Basic Specifications
              </th>
              <th colSpan={getGroupColSpan('length')} className="border-r border-black p-1 text-center bg-emerald-100/70">
                2. Length & Quantity
              </th>
              <th colSpan={getGroupColSpan('weight')} className="border-r border-black p-1 text-center bg-amber-100/70">
                3. Weight Parameters
              </th>
              <th colSpan={getGroupColSpan('rate')} className="border-r border-black p-1 text-center bg-purple-100/70">
                4. Rate & Valuation
              </th>
              <th className="no-print border-black p-1 text-center bg-slate-300">
                Actions
              </th>
            </tr>
          )}

          {/* Main Column Header Row */}
          <tr className="border-b-2 border-black">
            {!hiddenCols.has('slNo') && <th className="border-r border-black p-2 w-12 min-w-[50px] max-w-[56px]">Sl.No</th>}
            {!hiddenCols.has('description') && <th className="border-r border-black p-2 min-w-[200px]">Description</th>}
            {renderCustomHeader('description')}

            {!hiddenCols.has('hsn') && <th className="border-r border-black p-2 w-24 min-w-[85px]">HSN</th>}
            {renderCustomHeader('hsn')}

            {!hiddenCols.has('brand') && <th className="border-r border-black p-2 w-24 min-w-[85px]">Brand</th>}
            {renderCustomHeader('brand')}

            {!hiddenCols.has('profileCode') && <th className="border-r border-black p-2 min-w-[130px]">Profile Code</th>}
            {renderCustomHeader('profileCode')}

            {!hiddenCols.has('packets') && <th className="border-r border-black p-2 w-20 min-w-[75px]">Packets</th>}
            {renderCustomHeader('packets')}

            {!hiddenCols.has('lengthsInPkt') && <th className="border-r border-black p-2 w-20 min-w-[75px]">L/Pkt</th>}
            {renderCustomHeader('lengthsInPkt')}

            {!hiddenCols.has('totalL') && <th className="border-r border-black p-2 w-20 min-w-[75px] text-blue-800">Total L.</th>}
            {renderCustomHeader('totalL')}

            {!hiddenCols.has('eachL') && <th className="border-r border-black p-2 w-20 min-w-[75px]">Each L.</th>}
            {renderCustomHeader('eachL')}

            {!hiddenCols.has('lengthWt') && <th className="border-r border-black p-2 w-24 min-w-[85px]">Length Wt</th>}
            {renderCustomHeader('lengthWt')}

            {!hiddenCols.has('meterWt') && <th className="border-r border-black p-2 w-24 min-w-[85px]">Meter Wt</th>}
            {renderCustomHeader('meterWt')}

            {!hiddenCols.has('totalWt') && <th className="border-r border-black p-2 w-28 min-w-[95px] text-blue-800">Total Wt(kg)</th>}
            {renderCustomHeader('totalWt')}

            {!hiddenCols.has('rateKg') && <th className="border-r border-black p-2 w-24 min-w-[85px]">Rate/kg</th>}
            {renderCustomHeader('rateKg')}

            {!hiddenCols.has('rateMtr') && <th className="border-r border-black p-2 w-24 min-w-[85px]">Rate/MTR</th>}
            {renderCustomHeader('rateMtr')}

            <th className="border-r border-black p-2 w-32 min-w-[110px] text-right pr-2 bg-yellow-50">Amount (Rs)</th>
            {renderCustomHeader('end')}

            <th className="no-print border-black p-2 w-28 min-w-[110px]">ACTION</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-black">
          {/* Profile Section Heading */}
          <tr className={`${builderTab === 'reinforcements' ? 'hidden' : 'bg-slate-100/80'} font-black border-b border-black print:table-row`}>
            <td colSpan={totalVisibleCols - 1} className="p-1.5 uppercase tracking-wider text-left pl-4 text-[10px] text-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-extrabold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                  Profile Section ({items.filter(i => !i.isHidden).length} items)
                </span>
                <button
                  onClick={addProfileRow}
                  className="no-print text-[9px] bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 font-bold px-2.5 py-0.5 rounded shadow-xs active:scale-95 flex items-center gap-1"
                >
                  <PlusIcon className="w-2.5 h-2.5" /> + Add Profile Item
                </button>
              </div>
            </td>
            <td className="no-print p-1 bg-slate-200 text-center">
              <button
                onClick={addProfileRow}
                className="text-[9px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-0.5 mx-auto active:scale-95"
                title="Add new Profile row"
              >
                <PlusIcon className="w-2.5 h-2.5" /> Row
              </button>
            </td>
          </tr>

          {/* Profile Section Rows */}
          {items.map((item, idx) => renderRow(item, idx, 'items'))}

          {/* Reinforcement Section Heading */}
          <tr className={`${builderTab === 'profiles' ? 'hidden' : 'bg-slate-100/80'} font-black border-b border-black print:table-row`}>
            <td colSpan={totalVisibleCols - 1} className="p-1.5 uppercase tracking-wider text-left pl-4 text-[10px] text-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-extrabold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-600 inline-block"></span>
                  Reinforcement Section ({reinforcements.filter(r => !r.isHidden).length} items)
                </span>
                <button
                  onClick={addReinforcementRow}
                  className="no-print text-[9px] bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 font-bold px-2.5 py-0.5 rounded shadow-xs active:scale-95 flex items-center gap-1"
                >
                  <PlusIcon className="w-2.5 h-2.5" /> + Add Reinforcement Item
                </button>
              </div>
            </td>
            <td className="no-print p-1 bg-slate-200 text-center">
              <button
                onClick={addReinforcementRow}
                className="text-[9px] bg-amber-600 hover:bg-amber-700 text-white font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-0.5 mx-auto active:scale-95"
                title="Add new Reinforcement row"
              >
                <PlusIcon className="w-2.5 h-2.5" /> Row
              </button>
            </td>
          </tr>

          {/* Reinforcement Section Rows */}
          {reinforcements.map((item, idx) => renderRow(item, idx, 'reinforcements'))}
        </tbody>
      </table>
    </div>
  );
};
