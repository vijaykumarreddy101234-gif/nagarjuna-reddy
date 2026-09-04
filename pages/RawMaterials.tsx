import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import type { Item, ToastMessage, User } from '../types';
import ItemsTable from '../components/ItemsTable';
import EditItemModal from '../components/EditItemModal';
import CreateItemModal from '../components/CreateItemModal';

declare const XLSX: any;
declare const jspdf: any;

interface RawMaterialsProps {
  items: Item[];
  deleteItem: (itemId: string) => void;
  updateItem: (item: Item) => void;
  addItem: (item: Omit<Item, 'id' | 'createdAt'>) => void;
  addToast: (message: string, type: ToastMessage['type']) => void;
}

const RawMaterials: React.FC<RawMaterialsProps> = ({ 
    items, deleteItem, updateItem, addItem, addToast
}) => {
  const [isCreateItemModalOpen, setIsCreateItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const canManage = true; // All permissions enabled

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
            setIsDownloadMenuOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleExportExcel = () => {
    try {
        const headers = ['Item SKU', 'Material Name', 'Category', 'Unit', 'Opening Stock', 'Reorder Alert Level', 'Cost Price (INR)'];
        const rows = items.map(item => [
            item.sku || 'N/A',
            item.name || 'N/A',
            item.category || 'N/A',
            item.uom || 'kg',
            item.openingStock || 0,
            item.reorderPoint || 0,
            item.costPrice || 0
        ]);

        if (rows.length === 0) {
            addToast('No records available to export.', 'error');
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        XLSX.utils.book_append_sheet(wb, ws, 'Materials List');
        
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Raw_Materials_${dateStr}.xlsx`);
        addToast('Successfully downloaded Materials Excel sheet!', 'success');
        setIsDownloadMenuOpen(false);
    } catch (error) {
        console.error('Excel Export Error:', error);
        addToast('Failed to generate Excel sheet.', 'error');
    }
  };

  const handleExportPdf = () => {
    try {
        const headers = ['SKU', 'Material Name', 'Category', 'Unit', 'Opening Stock', 'Reorder Lvl', 'Cost Price'];
        const rows = items.map(item => [
            item.sku || 'N/A',
            item.name || 'N/A',
            item.category || 'N/A',
            item.uom || 'kg',
            item.openingStock || 0,
            item.reorderPoint || 0,
            item.costPrice || 0
        ]);

        if (rows.length === 0) {
            addToast('No records available to export.', 'error');
            return;
        }

        const { jsPDF } = jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        
        const generatedDate = new Date().toLocaleDateString();
        doc.text(`Raw Materials List - Master Catalog`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated on: ${generatedDate} | Record Count: ${rows.length}`, 14, 20);

        doc.autoTable({
            head: [headers],
            body: rows,
            startY: 24,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        const dateStr = new Date().toISOString().split('T')[0];
        doc.save(`Raw_Materials_${dateStr}.pdf`);
        addToast('Successfully downloaded Materials PDF report!', 'success');
        setIsDownloadMenuOpen(false);
    } catch (error) {
        console.error('PDF Export Error:', error);
        addToast('Failed to generate PDF document.', 'error');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'n' && canManage) {
        e.preventDefault();
        setIsCreateItemModalOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canManage]);
  
  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Raw Materials</h1>
        <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
          {canManage && (
            <button 
                id="add-item-button"
                onClick={() => setIsCreateItemModalOpen(true)}
                className="w-full sm:w-auto bg-[#3B82F6] text-white px-5 py-2 rounded-md text-sm font-semibold hover:bg-blue-700 shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                title="Add New Raw Material (Alt + N)"
            >
                Add Raw Material
            </button>
          )}
          <div className="relative w-full sm:w-auto" ref={downloadMenuRef}>
              <button
                  onClick={() => setIsDownloadMenuOpen(prev => !prev)}
                  className="w-full sm:w-auto bg-slate-800 dark:bg-gray-700 text-white px-5 py-2 rounded-md text-sm font-semibold hover:bg-slate-700 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
              >
                  <Download className="w-4 h-4" />
                  <span>Export Report</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isDownloadMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg py-1 z-30 border border-gray-200 dark:border-gray-700">
                      <button onClick={handleExportExcel} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                          Download Excel
                      </button>
                      <button onClick={handleExportPdf} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                          Download PDF
                      </button>
                  </div>
              )}
          </div>
        </div>
      </div>
      
      <ItemsTable items={items} deleteItem={deleteItem} onEditItem={setEditingItem} />

      <CreateItemModal 
        isOpen={isCreateItemModalOpen}
        onClose={() => setIsCreateItemModalOpen(false)}
        onAdd={addItem}
        addToast={addToast}
      />
      {editingItem && (
        <EditItemModal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          item={editingItem}
          onUpdate={updateItem}
          addToast={addToast}
        />
      )}
    </>
  );
};

export default RawMaterials;