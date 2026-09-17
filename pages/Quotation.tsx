import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { BrandLogo, CompanySettings } from "../types";
import { db } from "../firebase";
import { collection, addDoc, getDocs, doc, updateDoc, increment } from "firebase/firestore";
import { jsPDF } from "jspdf";
import { Card } from "../components/Card";
import { FileTextIcon, PlusIcon, TrashIcon, DownloadIcon, SaveIcon, SpinnerIcon, PrinterIcon, EyeIcon, EyeOffIcon, LayoutIcon, PencilIcon } from "../components/Icon";
import { QuotationSpreadsheetGrid } from "../components/QuotationSpreadsheetGrid";
import * as XLSX from 'xlsx';

export interface QuotationItem {
  id: string;
  slNo: number;
  description: string;
  hsn: string;
  profileCode: string;
  packets: number;
  lengthsInPkt: number;
  eachLength: number;
  lengthWeight: number; 
  meterWeight: number; 
  ratePerKg: number;
  brand: string;
  isHidden?: boolean;
  isReinforcement?: boolean;
  action?: 'DISPATCH' | 'PRODUCTION';
  isMerged?: boolean;
  mergedText?: string;
  mergedAlign?: 'center' | 'left' | 'right';
  mergedBg?: string;
  customFields?: Record<string, string | number>;
}

export interface CustomColumn {
  id: string;
  name: string;
  insertAfter: string;
}

const DEFAULT_ITEMS: QuotationItem[] = [];
const REINFORCEMENTS: QuotationItem[] = [];

function amountToWords(num: number): string {
  const units = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
  const teens = ['TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

  if (isNaN(num) || num <= 0) return num === 0 ? 'ZERO' : 'INVALID AMOUNT';

  function convert(n: number): string {
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
    if (n < 1000) return units[Math.floor(n / 100)] + ' HUNDRED' + (n % 100 !== 0 ? ' AND ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' THOUSAND' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' LAKH' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' CRORE' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  }

  const rounded = Math.floor(num);
  return `RUPEES ${convert(rounded)} ONLY`;
}

interface QuotationProps {
  defaultBrand?: string;
}

export default function Quotation({ defaultBrand }: QuotationProps) {
  const allProfiles = useStore(state => state.profiles);
  const companySettings = useStore(state => state.companySettings);
  const updateCompanySettings = useStore(state => state.updateCompanySettings);
  const storeBrands = useStore(state => state.brands || []);
  const addStoreBrand = useStore(state => state.addBrand);
  const updateStoreBrand = useStore(state => state.updateBrand);
  const deleteStoreBrand = useStore(state => state.deleteBrand);
  const addProfile = useStore(state => state.addProfile);
  const addProfileTransaction = useStore(state => state.addProfileTransaction);
  
  const [localAlert, setLocalAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const triggerAlert = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setLocalAlert({ message, type });
    setTimeout(() => {
      setLocalAlert(null);
    }, 4000);
  };

  const [availableBrands, setAvailableBrands] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("raviraja_available_brands");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [selectedBrand, setSelectedBrand] = useState<string>(defaultBrand || "All");

  // Sync with parent brand selection
  useEffect(() => {
    if (defaultBrand) {
      setSelectedBrand(defaultBrand);
    }
  }, [defaultBrand]);
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [designerBrand, setDesignerBrand] = useState<string>("");
  const [newDesignerBrandInput, setNewDesignerBrandInput] = useState("");

  // Brand Management Modal & Inline Editing States
  const [isManageBrandsModalOpen, setIsManageBrandsModalOpen] = useState(false);
  const [isInlineEditingBrand, setIsInlineEditingBrand] = useState(false);
  const [inlineBrandEditValue, setInlineBrandEditValue] = useState("");
  const [editingBrandInModal, setEditingBrandInModal] = useState<string | null>(null);
  const [editBrandModalInput, setEditBrandModalInput] = useState("");
  const [newBrandModalInput, setNewBrandModalInput] = useState("");

  // Persist available brands
  useEffect(() => {
    try {
      localStorage.setItem("raviraja_available_brands", JSON.stringify(availableBrands));
    } catch (e) {}
  }, [availableBrands]);

  const getBrandLogoData = (brandName?: string) => {
    if (!brandName || brandName === "All") {
      return {
        logoUrl: companySettings.logoUrl || "",
        logoRightUrl: companySettings.logoRightUrl || "",
        logoScale: 22,
        brandTheme: "Default"
      };
    }
    const match = companySettings.brandLogos?.find(
      bl => bl.brand?.trim().toLowerCase() === brandName.trim().toLowerCase()
    );
    if (match) {
      return {
        logoUrl: match.logoUrl || "",
        logoRightUrl: match.logoRightUrl || "",
        logoScale: match.logoScale || 22,
        brandTheme: match.brandTheme || match.brand
      };
    }
    return {
      logoUrl: companySettings.logoUrl || "",
      logoRightUrl: companySettings.logoRightUrl || "",
      logoScale: 22,
      brandTheme: brandName
    };
  };

  const saveBrandLogoData = (brandName: string, updates: Partial<BrandLogo>) => {
    if (!brandName || brandName === "All") return;
    const currentBrandLogos = [...(companySettings.brandLogos || [])];
    const idx = currentBrandLogos.findIndex(
      bl => bl.brand?.trim().toLowerCase() === brandName.trim().toLowerCase()
    );
    
    if (idx > -1) {
      currentBrandLogos[idx] = { 
        ...currentBrandLogos[idx], 
        ...updates, 
        brand: brandName 
      };
    } else {
      currentBrandLogos.push({
        brand: brandName,
        logoUrl: updates.logoUrl || "",
        logoRightUrl: updates.logoRightUrl || "",
        logoScale: updates.logoScale || 22,
        brandTheme: updates.brandTheme || brandName,
        ...updates
      });
    }

    const newSettings: CompanySettings = { ...companySettings, brandLogos: currentBrandLogos };
    if (brandName === "Default" || brandName === "General") {
      if (updates.logoUrl !== undefined) newSettings.logoUrl = updates.logoUrl;
      if (updates.logoRightUrl !== undefined) newSettings.logoRightUrl = updates.logoRightUrl;
    }

    updateCompanySettings(newSettings);
    try {
      localStorage.setItem("raviraja_brand_logos", JSON.stringify(currentBrandLogos));
    } catch (e) {}
  };

  const openDesigner = (brandToOpen?: string) => {
    const targetBrand = brandToOpen || (selectedBrand !== "All" ? selectedBrand : "General");
    setDesignerBrand(targetBrand);
    setIsDesignerOpen(true);
  };

  const [quotationMeta, setQuotationMeta] = useState(() => {
    let savedLogos: any = {};
    try {
      const raw = localStorage.getItem("raviraja_designer_logos");
      if (raw) savedLogos = JSON.parse(raw);
    } catch (e) {}

    return {
      quotationNo: `QTN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().split('T')[0],
      placeOfSupply: companySettings.cityStateZip?.split(',')[0] || "Hyderabad",
      stateCode: companySettings.stateCode || "36",
      transport: "By Road",
      vehicleNo: "",
      customerName: "",
      customerAddress: "",
      gstNo: "",
      companyName: companySettings.name || companySettings.name,
      accountNo: companySettings.accountNo || "1389150100000003",
      bankName: companySettings.bankName || "UNION BANK",
      ifscCode: companySettings.ifsc || "UBIN0813893",
      branchName: companySettings.branch || "IBRAHIMPATNAM",
      termsText: companySettings.terms || "1. Prices are valid for 7 days.\n2. Goods once sold will not be taken back.\n3. Subject to Hyderabad Jurisdiction.",
      logoUrl: savedLogos.logoUrl || companySettings.logoUrl || "",
      logoRightUrl: savedLogos.logoRightUrl || companySettings.logoRightUrl || "",
      logoScale: savedLogos.logoScale || 22,
      brandTheme: savedLogos.brandTheme || "Scraft",
      registeredAddress: (companySettings.addressLine1 ? companySettings.addressLine1 + " " + companySettings.addressLine2 + " " + companySettings.cityStateZip : "Plot No 123, Industrial Area, Hyderabad, Telangana - 500001"),
      factoryAddress: companySettings.factoryAddress || "Plot no: 488, TIF MSME Green Park, Dandu Malkapuram Vill -508252 Ph No: 8985587373"
    };
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, side: "left" | "right", targetBrand?: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const brandToUpdate = targetBrand || (selectedBrand !== "All" ? selectedBrand : (designerBrand || "General"));
        
        saveBrandLogoData(brandToUpdate, {
          [side === "left" ? "logoUrl" : "logoRightUrl"]: result
        });

        setQuotationMeta(prev => {
          const updated = { ...prev, [side === "left" ? "logoUrl" : "logoRightUrl"]: result };
          try {
            localStorage.setItem("raviraja_designer_logos", JSON.stringify({
              logoUrl: updated.logoUrl,
              logoRightUrl: updated.logoRightUrl,
              logoScale: updated.logoScale,
              brandTheme: updated.brandTheme
            }));
          } catch (err) {}
          return updated;
        });

        triggerAlert(`Logo saved for brand "${brandToUpdate}"!`, "success");
      };
      reader.readAsDataURL(file);
    }
  };

  // Sync with company settings if company profile changes
  useEffect(() => {
    setQuotationMeta(prev => ({
      ...prev,
      companyName: prev.companyName || companySettings.name || companySettings.name,
      registeredAddress: prev.registeredAddress || (companySettings.addressLine1 + " " + companySettings.addressLine2 + " " + companySettings.cityStateZip),
    }));
  }, [companySettings]);

  const [items, setItems] = useState<QuotationItem[]>([]);
  const [reinforcements, setReinforcements] = useState<QuotationItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize and automatically sync new items from store profiles
  useEffect(() => {
    if (allProfiles.length === 0) return;

    const windowProfiles = allProfiles.filter(p => !p.profileType || p.profileType === 'WINDOW');
    const reinfProfiles = allProfiles.filter(p => p.profileType === 'REINFORCEMENT');

    setItems(prevItems => {
      if (!isInitialized || prevItems.length === 0) {
        return windowProfiles.map((p, idx) => ({
          id: p.id,
          slNo: idx + 1,
          description: p.isMerged ? (p.mergedText || p.name) : p.name,
          hsn: p.hsnCode || "39162099",
          profileCode: p.sku || "",
          packets: 0,
          lengthsInPkt: p.piecesPerPacket || 1,
          eachLength: p.length || 5.9,
          lengthWeight: p.weight || 0,
          meterWeight: (p.weight && p.length) ? p.weight / p.length : 0,
          ratePerKg: p.price || 150,
          brand: p.brand || "General",
          isMerged: p.isMerged,
          mergedText: p.mergedText || p.name,
          mergedAlign: p.mergedAlign as ('center' | 'left' | 'right' | undefined),
          mergedBg: p.mergedBg,
          isHidden: false,
          action: 'DISPATCH' as const
        }));
      }

      // Merge new profiles that are not in prevItems yet
      const existingIds = new Set(prevItems.map(it => it.id));
      const existingCodes = new Set(prevItems.map(it => `${(it.brand || '').toLowerCase()}:::${(it.profileCode || '').toLowerCase()}`));
      const newItems = windowProfiles.filter(p => !existingIds.has(p.id) && !existingCodes.has(`${(p.brand || '').toLowerCase()}:::${(p.sku || '').toLowerCase()}`));

      if (newItems.length === 0) return prevItems;

      const formattedNew = newItems.map((p, idx) => ({
        id: p.id,
        slNo: prevItems.length + idx + 1,
        description: p.isMerged ? (p.mergedText || p.name) : p.name,
        hsn: p.hsnCode || "39162099",
        profileCode: p.sku || "",
        packets: 0,
        lengthsInPkt: p.piecesPerPacket || 1,
        eachLength: p.length || 5.9,
        lengthWeight: p.weight || 0,
        meterWeight: (p.weight && p.length) ? p.weight / p.length : 0,
        ratePerKg: p.price || 150,
        brand: p.brand || "General",
        isMerged: p.isMerged,
        mergedText: p.mergedText || p.name,
        mergedAlign: p.mergedAlign as ('center' | 'left' | 'right' | undefined),
        mergedBg: p.mergedBg,
        isHidden: false,
        action: 'DISPATCH' as const
      }));

      return [...prevItems, ...formattedNew];
    });

    setReinforcements(prevReinf => {
      if (!isInitialized || prevReinf.length === 0) {
        return reinfProfiles.map((p, idx) => ({
          id: p.id,
          slNo: idx + 1,
          description: p.isMerged ? (p.mergedText || p.name) : p.name,
          hsn: p.hsnCode || "REINFORCEMENT",
          profileCode: p.sku || "",
          packets: 0,
          lengthsInPkt: p.piecesPerPacket || 1,
          eachLength: p.length || 0,
          lengthWeight: p.weight || 0,
          meterWeight: (p.weight && p.length) ? p.weight / p.length : 0,
          ratePerKg: p.price || 95,
          brand: p.brand || "General",
          isMerged: p.isMerged,
          mergedText: p.mergedText || p.name,
          mergedAlign: p.mergedAlign as ('center' | 'left' | 'right' | undefined),
          mergedBg: p.mergedBg,
          isReinforcement: true,
          isHidden: false,
          action: 'DISPATCH' as const
        }));
      }

      const existingIds = new Set(prevReinf.map(it => it.id));
      const existingCodes = new Set(prevReinf.map(it => `${(it.brand || '').toLowerCase()}:::${(it.profileCode || '').toLowerCase()}`));
      const newReinfs = reinfProfiles.filter(p => !existingIds.has(p.id) && !existingCodes.has(`${(p.brand || '').toLowerCase()}:::${(p.sku || '').toLowerCase()}`));

      if (newReinfs.length === 0) return prevReinf;

      const formattedNew = newReinfs.map((p, idx) => ({
        id: p.id,
        slNo: prevReinf.length + idx + 1,
        description: p.isMerged ? (p.mergedText || p.name) : p.name,
        hsn: p.hsnCode || "REINFORCEMENT",
        profileCode: p.sku || "",
        packets: 0,
        lengthsInPkt: p.piecesPerPacket || 1,
        eachLength: p.length || 0,
        lengthWeight: p.weight || 0,
        meterWeight: (p.weight && p.length) ? p.weight / p.length : 0,
        ratePerKg: p.price || 95,
        brand: p.brand || "General",
        isMerged: p.isMerged,
        mergedText: p.mergedText || p.name,
        mergedAlign: p.mergedAlign as ('center' | 'left' | 'right' | undefined),
        mergedBg: p.mergedBg,
        isReinforcement: true,
        isHidden: false,
        action: 'DISPATCH' as const
      }));

      return [...prevReinf, ...formattedNew];
    });

    setIsInitialized(true);
  }, [allProfiles, isInitialized]);

  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set([])); 
  const toggleColumn = (col: string) => {
    const newHidden = new Set(hiddenCols);
    if (newHidden.has(col)) newHidden.delete(col);
    else newHidden.add(col);
    setHiddenCols(newHidden);
  };
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedRowType, setSelectedRowType] = useState<"items" | "reinforcements" | null>(null);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColPos, setNewColPos] = useState("description");
  const [showGroupedHeaders, setShowGroupedHeaders] = useState(false);
  const [gstMode, setGstMode] = useState<"CGST_SGST" | "IGST">("CGST_SGST");
  const [activeTab, setActiveTab] = useState<"builder" | "history">("builder");
  const [builderTab, setBuilderTab] = useState<"profiles" | "reinforcements">("reinforcements");
  const [savedQuotes, setSavedQuotes] = useState<any[]>([]);
  const [pdfSettings, setPdfSettings] = useState({
    logoSize: 22,
    headerFontSize: 14,
    showBankDetails: true,
    showTerms: true
  });

  // Load saved quotes from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("raviraja_saved_quotes");
    if (stored) setSavedQuotes(JSON.parse(stored));
  }, []);

  const saveToHistory = () => {
    const newQuote = {
      id: Math.random().toString(36).substr(2, 9),
      meta: quotationMeta,
      items: items.filter(it => !it.isHidden),
      reinforcements: reinforcements.filter(it => !it.isHidden),
      totals,
      timestamp: new Date().toLocaleString()
    };
    const updated = [newQuote, ...savedQuotes];
    setSavedQuotes(updated);
    localStorage.setItem("raviraja_saved_quotes", JSON.stringify(updated));
    triggerAlert("Quotation successfully saved to History!");
  };

  const loadFromHistory = (quote: any) => {
    setQuotationMeta(quote.meta);
    setItems(quote.items);
    setReinforcements(quote.reinforcements);
    setActiveTab("builder");
  };

  const deleteFromHistory = (id: string) => {
    const updated = savedQuotes.filter(q => q.id !== id);
    setSavedQuotes(updated);
    localStorage.setItem("raviraja_saved_quotes", JSON.stringify(updated));
  };

  const brandOptions = useMemo(() => {
    const bSet = new Set<string>();
    availableBrands.forEach(b => { if (b && b.trim()) bSet.add(b.trim()); });
    storeBrands.forEach(b => { if (b && b.trim()) bSet.add(b.trim()); });
    return ["All", ...Array.from(bSet)];
  }, [availableBrands, storeBrands]);

  const addBrand = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (availableBrands.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
      triggerAlert(`Brand "${trimmed}" already exists.`, "error");
      return;
    }
    setAvailableBrands(prev => [...prev, trimmed]);
    addStoreBrand(trimmed);
    triggerAlert(`Brand "${trimmed}" added successfully!`, "success");
  };

  const editBrandName = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    if (availableBrands.some(b => b.toLowerCase() === trimmed.toLowerCase() && b.toLowerCase() !== oldName.toLowerCase())) {
      triggerAlert(`Brand "${trimmed}" already exists.`, "error");
      return;
    }

    setAvailableBrands(prev => prev.map(b => b.toLowerCase() === oldName.toLowerCase() ? trimmed : b));
    updateStoreBrand(oldName, trimmed);

    // Update in active quotation items and reinforcements
    setItems(prev => prev.map(it => it.brand === oldName ? { ...it, brand: trimmed } : it));
    setReinforcements(prev => prev.map(it => it.brand === oldName ? { ...it, brand: trimmed } : it));

    // Update in companySettings.brandLogos
    const updatedLogos = (companySettings.brandLogos || []).map(bl => 
      bl.brand?.toLowerCase() === oldName.toLowerCase() ? { ...bl, brand: trimmed, brandTheme: bl.brandTheme === oldName ? trimmed : bl.brandTheme } : bl
    );
    updateCompanySettings({ ...companySettings, brandLogos: updatedLogos });

    if (selectedBrand.toLowerCase() === oldName.toLowerCase()) {
      setSelectedBrand(trimmed);
    }
    if (designerBrand.toLowerCase() === oldName.toLowerCase()) {
      setDesignerBrand(trimmed);
    }

    triggerAlert(`Brand "${oldName}" renamed to "${trimmed}"!`, "success");
  };

  const deleteBrandName = (brandToDelete: string) => {
    if (brandToDelete === "All") return;
    if (!window.confirm(`Are you sure you want to delete brand "${brandToDelete}"? This will remove its branding logos and remove it from the brand options.`)) {
      return;
    }

    setAvailableBrands(prev => prev.filter(b => b.toLowerCase() !== brandToDelete.toLowerCase()));
    deleteStoreBrand(brandToDelete);

    // Remove from companySettings.brandLogos
    const updatedLogos = (companySettings.brandLogos || []).filter(
      bl => bl.brand?.toLowerCase() !== brandToDelete.toLowerCase()
    );
    updateCompanySettings({ ...companySettings, brandLogos: updatedLogos });

    if (selectedBrand.toLowerCase() === brandToDelete.toLowerCase()) {
      setSelectedBrand("All");
    }
    if (designerBrand.toLowerCase() === brandToDelete.toLowerCase()) {
      setDesignerBrand("General");
    }

    triggerAlert(`Brand "${brandToDelete}" deleted successfully!`, "success");
  };

  const resetToCoreBrands = () => {
    if (!window.confirm("Reset brand list to our core brands only (RAVIRAJA)? This will remove other third-party brands.")) {
      return;
    }
    const coreBrands = ["General"];
    setAvailableBrands(coreBrands);
    const updatedLogos = (companySettings.brandLogos || []).filter(
      bl => coreBrands.some(cb => cb.toLowerCase() === bl.brand?.toLowerCase())
    );
    updateCompanySettings({ ...companySettings, brandLogos: updatedLogos });
    if (!coreBrands.includes(selectedBrand)) {
      setSelectedBrand("All");
    }
    setDesignerBrand("General");
    triggerAlert("Reset to core brands (RAVIRAJA)!", "success");
  };

  // Automatically switch quotation header logos and metadata when selectedBrand changes or brand logos update
  useEffect(() => {
    if (selectedBrand && selectedBrand !== "All") {
      const bData = getBrandLogoData(selectedBrand);
      setQuotationMeta(prev => ({
        ...prev,
        logoUrl: bData.logoUrl,
        logoRightUrl: bData.logoRightUrl,
        logoScale: bData.logoScale,
        brandTheme: bData.brandTheme
      }));
    } else if (selectedBrand === "All") {
      const activeItems = items.filter(it => !it.isHidden && it.packets > 0);
      const uniqueBrands = Array.from(new Set(activeItems.map(it => it.brand).filter((b): b is string => Boolean(b))));
      if (uniqueBrands.length === 1 && typeof uniqueBrands[0] === 'string') {
        const bData = getBrandLogoData(uniqueBrands[0]);
        setQuotationMeta(prev => ({
          ...prev,
          logoUrl: bData.logoUrl,
          logoRightUrl: bData.logoRightUrl,
          logoScale: bData.logoScale,
          brandTheme: bData.brandTheme
        }));
      } else {
        setQuotationMeta(prev => ({
          ...prev,
          logoUrl: companySettings.logoUrl || "",
          logoRightUrl: companySettings.logoRightUrl || "",
          logoScale: 22,
          brandTheme: "All"
        }));
      }
    }
  }, [selectedBrand, companySettings.brandLogos, companySettings.logoUrl, companySettings.logoRightUrl]);

  const calculateRowTotal = (item: QuotationItem) => {
    if (item.isMerged) {
      return { totalLength: 0, totalWeight: 0, ratePerMeter: 0, amount: 0 };
    }
    const totalPieces = item.packets * (item.lengthsInPkt || 1);
    const totalWeight = totalPieces * (item.lengthWeight || 0);
    const ratePerMeter = (item.meterWeight || 0) * item.ratePerKg;
    const amount = totalWeight * item.ratePerKg;
    return { totalLength: totalPieces, totalWeight, ratePerMeter, amount };
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    items
      .filter(it => !it.isHidden && (selectedBrand === "All" || it.brand === selectedBrand))
      .forEach(item => { subtotal += calculateRowTotal(item).amount; });
    
    // Only include reinforcements if "All" is selected or if they are relevant
    reinforcements
      .filter(it => !it.isHidden && (selectedBrand === "All" || it.brand === selectedBrand || true))
      .forEach(item => { subtotal += calculateRowTotal(item).amount; });
    
    const cgst = gstMode === "CGST_SGST" ? Math.round(subtotal * 0.09 * 100) / 100 : 0;
    const sgst = gstMode === "CGST_SGST" ? Math.round(subtotal * 0.09 * 100) / 100 : 0;
    const igst = gstMode === "IGST" ? Math.round(subtotal * 0.18 * 100) / 100 : 0;
    const grandTotal = Math.round((subtotal + cgst + sgst + igst) * 100) / 100;
    
    return { subtotal, cgst, sgst, igst, grandTotal };
  }, [items, reinforcements, gstMode, selectedBrand]);

  const prepareImageForPdf = async (imageSrc: string): Promise<{ dataUrl: string; width: number; height: number } | null> => {
    if (!imageSrc || typeof imageSrc !== 'string' || !imageSrc.trim()) return null;
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const w = img.naturalWidth || img.width || 400;
            const h = img.naturalHeight || img.height || 200;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve({ dataUrl: imageSrc, width: w, height: h });
              return;
            }
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL("image/png");
            resolve({ dataUrl, width: w, height: h });
          } catch (e) {
            console.warn("Canvas conversion fallback", e);
            resolve({ dataUrl: imageSrc, width: img.naturalWidth || 400, height: img.naturalHeight || 200 });
          }
        };
        img.onerror = (e) => {
          console.warn("Image load error for PDF embedding", e);
          if (imageSrc.startsWith("data:image/")) {
            resolve({ dataUrl: imageSrc, width: 400, height: 200 });
          } else {
            resolve(null);
          }
        };
        img.src = imageSrc;
      } catch (err) {
        console.warn("prepareImageForPdf error", err);
        resolve(null);
      }
    });
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const generatePDF = async () => {
    setIsGeneratingPdf(true);
    try {
      let activePdfBrand = selectedBrand !== "All" ? selectedBrand : "";
      if (!activePdfBrand) {
        const visibleItems = items.filter(it => !it.isHidden && it.packets > 0);
        const itemBrands = Array.from(new Set(visibleItems.map(it => it.brand).filter(b => b)));
        if (itemBrands.length === 1) {
          activePdfBrand = itemBrands[0];
        }
      }
      const brandLogoData = getBrandLogoData(activePdfBrand);
      const activeLogoUrl = brandLogoData.logoUrl || quotationMeta.logoUrl || companySettings.logoUrl || "";
      const activeLogoRightUrl = brandLogoData.logoRightUrl || quotationMeta.logoRightUrl || companySettings.logoRightUrl || "";
      const lSize = Math.max(15, brandLogoData.logoScale || quotationMeta.logoScale || pdfSettings.logoSize || 22);

      // Pre-load and convert logos to guaranteed PNG Data URLs
      const [leftImg, rightImg] = await Promise.all([
        prepareImageForPdf(activeLogoUrl),
        prepareImageForPdf(activeLogoRightUrl)
      ]);

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // 1. HEADER SECTION
      doc.setFillColor(180, 0, 0); 
      doc.rect(0, 0, pageWidth, 2, 'F');

      let leftOffset = 15;
      let rightOffset = 15;

      // Draw Left Logo
      if (leftImg) {
        try {
          const aspect = leftImg.height / (leftImg.width || 1);
          const logoW = lSize;
          const logoH = Math.min(22, Math.max(7, logoW * aspect));
          doc.addImage(leftImg.dataUrl, 'PNG', 12, 4.5, logoW, logoH, undefined, 'FAST');
          leftOffset = 12 + logoW + 5;
        } catch (e) {
          console.error("Failed to render left logo in PDF", e);
        }
      }

      // Draw Right Logo
      if (rightImg) {
        try {
          const aspect = rightImg.height / (rightImg.width || 1);
          const logoW = lSize;
          const logoH = Math.min(22, Math.max(7, logoW * aspect));
          const rightX = pageWidth - logoW - 12;
          doc.addImage(rightImg.dataUrl, 'PNG', rightX, 4.5, logoW, logoH, undefined, 'FAST');
          rightOffset = 12 + logoW + 5;
        } catch (e) {
          console.error("Failed to render right logo in PDF", e);
        }
      }

      // Company Name & Addresses
      doc.setFont("helvetica", "bold");
      doc.setFontSize(pdfSettings.headerFontSize);
      doc.setTextColor(0, 0, 0);
      
      // Adjust header positioning
      const quoteBoxWidth = 45;
      const headerX = Math.max(leftOffset, 15);
      
      // Decrease font size slightly if logos are large
      doc.setFontSize(pdfSettings.headerFontSize > 12 && (leftImg || rightImg) ? 12 : pdfSettings.headerFontSize);
      doc.text(quotationMeta.companyName || companySettings.name, headerX, 12);
      
      doc.setFontSize(6.5);
      doc.setTextColor(60);
      doc.setFont("helvetica", "normal");
      
      // Recalculate tag position to be safer
      const tagX = rightImg ? pageWidth - lSize - 12 - 48 : pageWidth - 60;
      const innerHeaderWidth = tagX - headerX - 5; 
      
      let currentY = 17;
      const regAddrLines = doc.splitTextToSize(`Regd Office: ${quotationMeta.registeredAddress}`, innerHeaderWidth);
      doc.text(regAddrLines, headerX, currentY);
      currentY += (regAddrLines.length * 3.2) + 1;

      const factAddrLines = doc.splitTextToSize(`Factory: ${quotationMeta.factoryAddress}`, innerHeaderWidth);
      doc.text(factAddrLines, headerX, currentY);

      // Document Name Tag (Small adjustments to avoid overlap)
      doc.setFillColor(245, 245, 245);
      doc.rect(tagX, 5, 45, 16, 'F');
      doc.setDrawColor(180, 0, 0);
      doc.setLineWidth(1);
      doc.line(tagX, 5, tagX, 21);
      
      doc.setFontSize(11); // Slightly smaller
      doc.setTextColor(180, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text("QUOTATION", tagX + 22.5, 12, { align: "center" });
      
      doc.setFontSize(5); // Smaller hint
      doc.setTextColor(150);
      doc.setFont("helvetica", "italic");
      doc.text("VALID COMPUTER GENERATED QUOTE", tagX + 22.5, 16, { align: "center" });

    // 2. METADATA SECTION
    let curY = 45;
    doc.setLineWidth(0.1);
    doc.setDrawColor(200);
    doc.line(10, curY - 5, pageWidth - 10, curY - 5);

    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.setFont("helvetica", "bold");
    doc.text("BILL TO:", 15, curY);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    curY += 5;
    doc.setFontSize(10);
    doc.text(quotationMeta.customerName || "CASUAL CUSTOMER", 15, curY);
    curY += 5;
    doc.setFontSize(8);
    const addressLines = doc.splitTextToSize(quotationMeta.customerAddress || "-", 80);
    doc.text(addressLines, 15, curY);
    curY += (addressLines.length * 4) + 2;
    doc.setFont("helvetica", "bold");
    doc.text(`GSTIN: ${quotationMeta.gstNo || "N/A"}`, 15, curY);

    // Right side meta (Invoice-style layout)
    const metaX = pageWidth - 85;
    const metaValX = pageWidth - 15;
    let metaY = 45;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.setFont("helvetica", "bold");
    doc.text("Quotation Details", metaX, metaY);
    doc.setFont("helvetica", "normal");
    
    const drawMetaRow = (label: string, val: string, y: number) => {
      doc.setTextColor(120);
      doc.text(label, metaX, y);
      doc.setTextColor(0);
      doc.text(val, metaValX, y, { align: "right" });
    };

    metaY += 5;
    drawMetaRow("Quotation #", quotationMeta.quotationNo, metaY);
    metaY += 4.5;
    drawMetaRow("Date", quotationMeta.date, metaY);
    metaY += 4.5;
    drawMetaRow("Delivery Place", quotationMeta.placeOfSupply, metaY);
    metaY += 4.5;
    drawMetaRow("Vehicle Info", quotationMeta.vehicleNo || "-", metaY);
    metaY += 4.5;
    drawMetaRow("Transport", quotationMeta.transport || "-", metaY);

    // 3. TABLE SECTION
    curY = Math.max(curY + 12, metaY + 10);
    doc.setFillColor(40, 40, 40);
    doc.rect(10, curY, pageWidth - 20, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("Sl.No", 10, curY + 6);
    doc.text("Description", 17, curY + 6);
    doc.text("HSN", 52, curY + 6);
    doc.text("Profile", 74, curY + 6);
    doc.text("Packets", 94, curY + 6, { align: "right" });
    doc.text("L/Pkt", 106, curY + 6, { align: "right" });
    doc.text("Mtr/Wt", 122, curY + 6, { align: "right" });
    doc.text("length/Wt", 138, curY + 6, { align: "right" });
    doc.text("Total L", 152, curY + 6, { align: "right" });
    doc.text("Total Wt", 168, curY + 6, { align: "right" });
    doc.text("Rate/Kg", 182, curY + 6, { align: "right" });
    doc.text("Amount", 200, curY + 6, { align: "right" });


    curY += 8;
    doc.setTextColor(0);
    let slCounter = 1;
    const filterAndDraw = (list: QuotationItem[]) => {
      list.forEach(item => {
        if (item.isHidden) return;
        if (item.isMerged) {
          doc.setFillColor(235, 240, 245);
          doc.rect(10, curY + 1, 192, 6, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          const align = item.mergedAlign || "center";
          const xPos = align === "left" ? 14 : align === "right" ? 198 : 106;
          doc.text(item.mergedText || item.description || "MERGED SECTION", xPos, curY + 5.5, { align });
          doc.setTextColor(0);
          curY += 7.5;
          if (curY > 260) { doc.addPage(); curY = 20; }
          return;
        }
        const { totalLength, totalWeight, amount } = calculateRowTotal(item);
        if (amount > 0 && !item.isHidden) {
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.text(slCounter.toString(), 10, curY + 5);
          doc.setFont("helvetica", "bold");
          
          const descLines = doc.splitTextToSize(item.description, 33);
          doc.text(descLines, 17, curY + 5);
          
          doc.setFont("helvetica", "normal");
          doc.setTextColor(80);
          doc.text(item.hsn || "-", 52, curY + 5);
          doc.text(item.profileCode || "-", 74, curY + 5);
          doc.setTextColor(0);
          
          doc.text(item.packets.toString(), 94, curY + 5, { align: "right" });
          doc.text((item.lengthsInPkt || 1).toString(), 106, curY + 5, { align: "right" });
          doc.text((item.meterWeight || 0).toFixed(3), 122, curY + 5, { align: "right" });
          doc.text((item.lengthWeight || 0).toFixed(3), 138, curY + 5, { align: "right" });
          doc.text(totalLength.toFixed(1), 152, curY + 5, { align: "right" });
          doc.text(totalWeight.toFixed(3), 168, curY + 5, { align: "right" });
          doc.text((item.ratePerKg || 0).toFixed(2), 182, curY + 5, { align: "right" });
          
          doc.setFont("helvetica", "bold");
          doc.text(amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), 200, curY + 5, { align: "right" });
          
          const rowHeight = descLines.length * 3.5 + 2.5;
          curY += Math.max(6, rowHeight);
          slCounter++;
          doc.setDrawColor(240);
          doc.line(10, curY, pageWidth - 10, curY);
          if (curY > 260) { doc.addPage(); curY = 20; }
        }
      });
    };

    const activeItems = items.filter(it => (selectedBrand === "All" || it.brand === selectedBrand));
    filterAndDraw(activeItems);
    
    // If reinforcement section has data
    const activeRefs = reinforcements.filter(it => (selectedBrand === "All" || it.brand === selectedBrand || true));
    const hasRefs = activeRefs.some(it => calculateRowTotal(it).amount > 0 && !it.isHidden);
    if (hasRefs) {
      curY += 2;
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(8);
      doc.text("REINFORCEMENTS:", 15, curY + 4);
      curY += 7;
      filterAndDraw(activeRefs);
    }

    // 4. FOOTER / TOTALS SECTION
    curY += 10;
    if (curY > 220) { doc.addPage(); curY = 20; }

    // Summary Box
    const summaryX = pageWidth - 90;
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.rect(summaryX, curY, 80, 48); // Increased height for proper spacing
    doc.line(summaryX + 50, curY, summaryX + 50, curY + 48); // V-line
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    let innerY = curY + 7;
    doc.text("Total Taxable Value", summaryX + 2, innerY); 
    doc.text((totals?.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), pageWidth - 12, innerY, { align: "right" });
    
    innerY += 9;
    doc.setDrawColor(200);
    doc.line(summaryX, innerY - 4, summaryX + 80, innerY - 4);
    
    doc.setFont("helvetica", "normal");
    if (gstMode === "CGST_SGST") {
      doc.text("CGST @ 9% (+)", summaryX + 2, innerY); doc.text((totals?.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), pageWidth - 12, innerY, { align: "right" });
      innerY += 7;
      doc.text("SGST @ 9% (+)", summaryX + 2, innerY); doc.text((totals?.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), pageWidth - 12, innerY, { align: "right" });
      innerY += 8;
    } else {
      doc.text("IGST @ 18% (+)", summaryX + 2, innerY); doc.text((totals?.igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), pageWidth - 12, innerY, { align: "right" });
      innerY += 8;
    }
    
    // Grand Total Box
    doc.setFillColor(30, 30, 30);
    doc.rect(summaryX, innerY - 4, 80, 10, 'F');
    doc.setTextColor(255);
    doc.setFontSize(10);
    doc.text("GRAND TOTAL", summaryX + 2, innerY + 2.5);
    doc.text(`INR ${(totals?.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - 12, innerY + 2.5, { align: "right" });

    // Amount in Words
    doc.setTextColor(0);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.rect(10, curY, summaryX - 15, 20);
    doc.text("AMOUNT IN WORDS:", 13, curY + 6);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100);
    const words = doc.splitTextToSize(amountToWords(totals.grandTotal), summaryX - 28);
    doc.text(words, 13, curY + 11);

    // Bank Details
    if (pdfSettings.showBankDetails) {
      curY += 40;
      doc.setTextColor(180, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("OUR BANK DETAILS:", 10, curY);
      
      doc.setFontSize(8);
      doc.setTextColor(0);
      doc.setFont("helvetica", "normal");
      curY += 6;
      doc.text(`ACCOUNT NAME: ${quotationMeta.companyName || companySettings.name}`, 10, curY);
      curY += 4.5;
      doc.text(`CURRENT A/C NO: ${quotationMeta.accountNo || "1389150100000003"}`, 10, curY);
      curY += 4.5;
      doc.text(`BANK NAME: ${quotationMeta.bankName || "UNION BANK"}`, 10, curY);
      curY += 4.5;
      doc.text(`IFSC CODE: ${quotationMeta.ifscCode || "UBIN0813893"} | BRANCH: ${quotationMeta.branchName || "IBRAHIMPATNAM"}`, 10, curY);
    } else {
      curY += 40;
    }

    // Terms (Optional but good)
    if (pdfSettings.showTerms) {
      doc.setFontSize(6);
      doc.setTextColor(150);
      curY += 8;
      doc.text(quotationMeta.termsText || "Terms: 1. Prices are valid for 7 days. 2. Goods once sold will not be taken back. 3. Subject to Hyderabad Jurisdiction.", 10, curY);
    }

    // Signature Area
    doc.setTextColor(0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`For ${quotationMeta.companyName || companySettings.name}`, pageWidth - 15, curY - 10, { align: "right" });
    doc.line(pageWidth - 80, curY + 5, pageWidth - 15, curY + 5);
    doc.text("AUTHORISED SIGNATORY", pageWidth - 15, curY + 10, { align: "right" });

    doc.save(`QTN_${quotationMeta.quotationNo}_${quotationMeta.customerName || "Export"}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
      triggerAlert("Failed to generate PDF. Please check logo format or try again.", "error");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const updateItemValue = (type: "items" | "reinforcements", indexIdx: number, field: keyof QuotationItem, val: any) => {
    // Ensure numeric fields are actually numbers and not NaN
    const isNumericField = ["slNo", "packets", "lengthsInPkt", "eachLength", "lengthWeight", "meterWeight", "ratePerKg"].includes(field);
    const value = isNumericField ? (parseFloat(val) || 0) : val;

    if (type === "items") {
      const newItems = [...items];
      let item = { ...newItems[indexIdx], [field]: value };
      
      // Auto-calculate dependencies
      if (field === "meterWeight") {
        item.lengthWeight = value * (item.eachLength || 0);
      } else if (field === "lengthWeight") {
        if (item.eachLength > 0) item.meterWeight = value / item.eachLength;
      } else if (field === "eachLength") {
        item.lengthWeight = (item.meterWeight || 0) * value;
      }
      
      newItems[indexIdx] = item;
      setItems(newItems);
    } else {
      const newRefs = [...reinforcements];
      let ref = { ...newRefs[indexIdx], [field]: value };
      
      // For reinforcements, fixed calculations if needed
      if (field === "meterWeight") {
        ref.lengthWeight = value * (ref.eachLength || 1);
      } else if (field === "lengthWeight") {
        if (ref.eachLength > 0) ref.meterWeight = value / ref.eachLength;
      }
      
      newRefs[indexIdx] = ref;
      setReinforcements(newRefs);
    }
  };

  const toggleColumnVisibility = (colKey: string) => {
    const newSet = new Set(hiddenCols);
    if (newSet.has(colKey)) newSet.delete(colKey);
    else newSet.add(colKey);
    setHiddenCols(newSet);
  };

  const toggleRowVisibility = (type: "items" | "reinforcements", id: string) => {
    if (type === "items") {
      setItems(prev => prev.map(it => it.id === id ? { ...it, isHidden: !it.isHidden } : it));
    } else {
      setReinforcements(prev => prev.map(it => it.id === id ? { ...it, isHidden: !it.isHidden } : it));
    }
  };

  const showAllRows = () => {
    setItems(prev => prev.map(it => ({ ...it, isHidden: false })));
    setReinforcements(prev => prev.map(it => ({ ...it, isHidden: false })));
  };

  const applyBrandToAll = () => {
    if (selectedBrand === "All") return;
    if (confirm(`Update BRAND of all visible items to "${selectedBrand}"?`)) {
      setItems(prev => prev.map(it => !it.isHidden ? { ...it, brand: selectedBrand } : it));
      setReinforcements(prev => prev.map(it => !it.isHidden ? { ...it, brand: selectedBrand } : it));
    }
  };

  const selectedRowItem = useMemo(() => {
    if (!selectedRowId || !selectedRowType) return null;
    const list = selectedRowType === "items" ? items : reinforcements;
    return list.find(it => it.id === selectedRowId) || null;
  }, [selectedRowId, selectedRowType, items, reinforcements]);

  const selectedRowItemIndex = useMemo(() => {
    if (!selectedRowId || !selectedRowType) return -1;
    const list = selectedRowType === "items" ? items : reinforcements;
    return list.findIndex(it => it.id === selectedRowId);
  }, [selectedRowId, selectedRowType, items, reinforcements]);

  const insertRow = (type: "items" | "reinforcements", targetIndex: number, position: "above" | "below", isMerged: boolean = false) => {
    const newId = `${type === "items" ? "profile" : "reinf"}-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newItem: QuotationItem = isMerged ? {
      id: newId,
      slNo: 0,
      description: "MERGED SECTION / NOTE",
      hsn: "",
      brand: selectedBrand === "All" ? "General" : selectedBrand,
      profileCode: "",
      packets: 0,
      lengthsInPkt: 0,
      eachLength: 0,
      lengthWeight: 0,
      meterWeight: 0,
      ratePerKg: 0,
      isHidden: false,
      isReinforcement: type === "reinforcements",
      isMerged: true,
      mergedText: "NEW SECTION TITLE / NOTE (MERGED & CENTERED)",
      mergedAlign: "center",
      mergedBg: "bg-slate-100",
      action: "DISPATCH"
    } : (type === "items" ? {
      id: newId,
      slNo: items.length + 1,
      description: "NEW PROFILE ITEM",
      hsn: "39162099",
      brand: selectedBrand === "All" ? "General" : selectedBrand,
      profileCode: "PRF-NEW",
      packets: 1,
      lengthsInPkt: 6,
      eachLength: 5.9,
      lengthWeight: 5.0,
      meterWeight: +(5.0 / 5.9).toFixed(3),
      ratePerKg: 150,
      isHidden: false,
      isReinforcement: false,
      action: 'DISPATCH'
    } : {
      id: newId,
      slNo: reinforcements.length + 1,
      description: "Galvanised Plain/Steel (NEW REINFORCEMENT)",
      hsn: "REINFORCEMENT",
      brand: "General",
      profileCode: "REINF-NEW",
      packets: 1,
      lengthsInPkt: 1,
      eachLength: 0,
      lengthWeight: 2.5,
      meterWeight: 0,
      ratePerKg: 95,
      isReinforcement: true,
      isHidden: false,
      action: 'DISPATCH'
    });

    if (type === "items") {
      setItems(prev => {
        const copy = [...prev];
        const insertAt = position === "above" ? Math.max(0, targetIndex) : targetIndex + 1;
        copy.splice(insertAt, 0, newItem);
        return copy;
      });
    } else {
      setReinforcements(prev => {
        const copy = [...prev];
        const insertAt = position === "above" ? Math.max(0, targetIndex) : targetIndex + 1;
        copy.splice(insertAt, 0, newItem);
        return copy;
      });
    }
    setSelectedRowId(newId);
    setSelectedRowType(type);
    triggerAlert(`Row inserted ${position}! Click 'Merge & Center' to merge cells.`, "success");
  };

  const toggleMergeCenter = (type: "items" | "reinforcements", id: string) => {
    const updateList = (list: QuotationItem[]) => list.map(it => {
      if (it.id === id) {
        const willBeMerged = !it.isMerged;
        return {
          ...it,
          isMerged: willBeMerged,
          mergedText: it.mergedText || it.description || "MERGED SECTION HEADING / NOTE",
          mergedAlign: it.mergedAlign || "center",
          mergedBg: it.mergedBg || "bg-slate-100"
        };
      }
      return it;
    });

    if (type === "items") {
      setItems(prev => updateList(prev));
    } else {
      setReinforcements(prev => updateList(prev));
    }
    triggerAlert("Merge & Center toggled for row!", "success");
  };

  const handleToolbarMergeCenter = () => {
    if (!selectedRowId || !selectedRowType) {
      insertRow(builderTab === 'reinforcements' ? 'reinforcements' : 'items', 0, 'above', true);
      return;
    }
    toggleMergeCenter(selectedRowType, selectedRowId);
  };

  const handleToolbarInsertRow = (pos: "above" | "below", isMerged: boolean = false) => {
    const type = selectedRowType || (builderTab === 'reinforcements' ? 'reinforcements' : 'items');
    const list = type === 'items' ? items : reinforcements;
    let idx = list.findIndex(it => it.id === selectedRowId);
    if (idx === -1) {
      idx = pos === 'above' ? 0 : list.length - 1;
    }
    insertRow(type, Math.max(0, idx), pos, isMerged);
  };

  const handleToolbarDeleteRow = () => {
    if (!selectedRowId || !selectedRowType) {
      triggerAlert("Please select a row to delete first!", "info");
      return;
    }
    deleteRow(selectedRowType, selectedRowId);
    setSelectedRowId(null);
    setSelectedRowType(null);
    triggerAlert("Row deleted!", "info");
  };

  const insertCustomColumn = (name: string, insertAfter: string) => {
    if (!name.trim()) {
      triggerAlert("Please enter a column title!", "error");
      return;
    }
    const newCol: CustomColumn = {
      id: `col_${Date.now()}`,
      name: name.trim(),
      insertAfter
    };
    setCustomColumns(prev => [...prev, newCol]);
    setNewColName("");
    setShowAddColumnModal(false);
    triggerAlert(`Column "${name}" added successfully!`, "success");
  };

  const deleteCustomColumn = (colId: string) => {
    setCustomColumns(prev => prev.filter(c => c.id !== colId));
    triggerAlert("Custom column deleted!", "info");
  };

  const renameCustomColumn = (colId: string, newName: string) => {
    setCustomColumns(prev => prev.map(c => c.id === colId ? { ...c, name: newName } : c));
  };

  const updateCustomField = (type: "items" | "reinforcements", idx: number, colId: string, value: string) => {
    if (type === "items") {
      setItems(prev => {
        const copy = [...prev];
        const item = { ...copy[idx] };
        item.customFields = { ...(item.customFields || {}), [colId]: value };
        copy[idx] = item;
        return copy;
      });
    } else {
      setReinforcements(prev => {
        const copy = [...prev];
        const ref = { ...copy[idx] };
        ref.customFields = { ...(ref.customFields || {}), [colId]: value };
        copy[idx] = ref;
        return copy;
      });
    }
  };

  const addProfileRow = () => {
    insertRow("items", items.length - 1, "below", false);
    setBuilderTab("profiles");
  };

  const addReinforcementRow = () => {
    insertRow("reinforcements", reinforcements.length - 1, "below", false);
    setBuilderTab("reinforcements");
  };

  const addItemRow = () => {
    if (builderTab === 'reinforcements') {
      addReinforcementRow();
    } else {
      addProfileRow();
    }
  };

  const deleteRow = (type: "items" | "reinforcements", id: string) => {
    if (type === "items") {
      setItems(prev => prev.filter(it => it.id !== id));
    } else {
      setReinforcements(prev => prev.filter(it => it.id !== id));
    }
    if (selectedRowId === id) {
      setSelectedRowId(null);
      setSelectedRowType(null);
    }
  };

  const handleExportExcel = () => {
    const data: any[][] = [
      ["QUOTATION"],
      ["Customer:", quotationMeta.customerAddress],
      ["GST NO:", quotationMeta.gstNo],
      ["Date:", quotationMeta.date],
      []
    ];

    const baseCols = ["Sl.No", "Description", "HSN", "Brand", "Profile", "Packets", "L/Pkt", "Total L", "Each L", "Total Wt", "Rate/Kg", "Amount"];
    const headerRow = [...baseCols];
    customColumns.forEach(c => headerRow.push(c.name));
    data.push(headerRow);
    const colCount = headerRow.length;
    const merges: any[] = [];

    let slNo = 1;
    items.filter(it => !it.isHidden && (selectedBrand === "All" || it.brand === selectedBrand)).forEach(it => {
      if (it.isMerged) {
        const rIdx = data.length;
        const rowArr = new Array(colCount).fill("");
        rowArr[0] = it.mergedText || it.description || "MERGED SECTION";
        data.push(rowArr);
        merges.push({ s: { r: rIdx, c: 0 }, e: { r: rIdx, c: colCount - 1 } });
        return;
      }
      const { totalLength, totalWeight, amount } = calculateRowTotal(it);
      if (amount > 0 || it.packets > 0) {
        const rowData = [
          String(slNo++), it.description, it.hsn, it.brand, it.profileCode, String(it.packets), String(it.lengthsInPkt), totalLength.toFixed(1), String(it.eachLength), totalWeight.toFixed(3), String(it.ratePerKg), amount.toFixed(2)
        ];
        customColumns.forEach(c => rowData.push(String(it.customFields?.[c.id] || "")));
        data.push(rowData);
      }
    });

    data.push(["Reinforcements"]);
    reinforcements.filter(it => !it.isHidden).forEach(it => {
      if (it.isMerged) {
        const rIdx = data.length;
        const rowArr = new Array(colCount).fill("");
        rowArr[0] = it.mergedText || it.description || "MERGED SECTION";
        data.push(rowArr);
        merges.push({ s: { r: rIdx, c: 0 }, e: { r: rIdx, c: colCount - 1 } });
        return;
      }
      const { totalLength, totalWeight, amount } = calculateRowTotal(it);
      if (amount > 0 || it.packets > 0) {
        const rowData = [
          String(slNo++), it.description, it.hsn, it.brand, it.profileCode, String(it.packets), String(it.lengthsInPkt || 1), totalLength.toFixed(1), String(it.eachLength || 0), totalWeight.toFixed(3), String(it.ratePerKg), amount.toFixed(2)
        ];
        customColumns.forEach(c => rowData.push(String(it.customFields?.[c.id] || "")));
        data.push(rowData);
      }
    });

    data.push([], ["Subtotal", String(totals.subtotal)]);
    data.push(["Grand Total", String(totals.grandTotal)]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    if (merges.length > 0) {
      ws['!merges'] = merges;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quotation");
    XLSX.writeFile(wb, `Quotation_${quotationMeta.quotationNo}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const saveQuotation = async () => {
    setIsSaving(true);
    try {
      const timestamp = new Date().toISOString();
      const docRef = await addDoc(collection(db, "quotations_complex"), {
        meta: quotationMeta,
        items: items.filter(it => !it.isHidden),
        reinforcements: reinforcements.filter(it => !it.isHidden),
        totals,
        createdAt: timestamp
      });

      // Automatically create DISPATCH transactions for stock reduction
      const dispatchPromises = [];
      const allQuoteItems = [...items, ...reinforcements].filter(it => !it.isHidden && it.packets > 0);
      
      for (const item of allQuoteItems) {
        // Calculate total pieces for dispatch
        const totalPcs = item.packets * (item.lengthsInPkt || 1);
        const actionType = item.action || 'DISPATCH';
        
        // --- STORE SYNC START ---
        // Find if profile already exists in master data
        let profileId = item.id;
        const existingProfile = allProfiles.find(p => p.id === item.id || p.sku === item.profileCode);
        
        if (!existingProfile) {
            // New profile from quotation - add to master data
            const newP = addProfile({
                sku: (item.profileCode === 'CUSTOM' || !item.profileCode) ? `QTN-${Date.now().toString().slice(-4)}` : item.profileCode,
                name: item.description,
                brand: item.brand,
                profileType: item.isReinforcement ? 'REINFORCEMENT' : 'WINDOW',
                uom: 'Pcs',
                length: item.eachLength,
                piecesPerPacket: item.lengthsInPkt,
                weight: item.lengthWeight,
                price: item.ratePerKg,
                reorderPoint: 0,
                category: 'Profile'
            });
            profileId = newP.id;
        } else {
            profileId = existingProfile.id;
        }

        // Add to local store transactions for immediate UI update in Profile Section
        addProfileTransaction({
            profileId,
            type: actionType,
            quantity: totalPcs,
            uom: 'Pcs',
            date: quotationMeta.date,
            refNo: quotationMeta.quotationNo,
            customer: quotationMeta.customerName,
            brand: item.brand
        });
        // --- STORE SYNC END ---

        dispatchPromises.push(addDoc(collection(db, "profileTransactions"), {
          profileId: profileId,
          type: actionType,
          quantity: totalPcs,
          uom: 'Pcs',
          date: quotationMeta.date,
          refNo: quotationMeta.quotationNo,
          customer: quotationMeta.customerName,
          customerAddress: quotationMeta.customerAddress,
          customerGST: quotationMeta.gstNo,
          brand: item.brand,
          createdAt: timestamp
        }));
      }
      
      if (dispatchPromises.length > 0) {
        await Promise.all(dispatchPromises);
      }

      triggerAlert("Quotation saved, dispatch tracked, and stock levels updated successfully!", "success");
      generatePDF();
    } catch (e) {
      console.error(e);
      triggerAlert("Failed to save quotation. Verify connectivity and try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const basicCols = ['slNo', 'description', 'hsn', 'brand', 'profileCode'];
  const lengthCols = ['packets', 'lengthsInPkt', 'totalL', 'eachL'];
  const weightCols = ['lengthWt', 'meterWt', 'totalWt'];
  const rateCols = ['rateKg', 'rateMtr', 'amount'];

  const getGroupColSpan = (group: 'basic' | 'length' | 'weight' | 'rate') => {
    let count = 0;
    if (group === 'basic') {
      count += basicCols.filter(c => !hiddenCols.has(c)).length;
      count += customColumns.filter(c => ['description', 'hsn', 'brand', 'profileCode'].includes(c.insertAfter) && !hiddenCols.has(c.id)).length;
    } else if (group === 'length') {
      count += lengthCols.filter(c => !hiddenCols.has(c)).length;
      count += customColumns.filter(c => ['packets', 'lengthsInPkt', 'totalL', 'eachL'].includes(c.insertAfter) && !hiddenCols.has(c.id)).length;
    } else if (group === 'weight') {
      count += weightCols.filter(c => !hiddenCols.has(c)).length;
      count += customColumns.filter(c => ['lengthWt', 'meterWt', 'totalWt'].includes(c.insertAfter) && !hiddenCols.has(c.id)).length;
    } else if (group === 'rate') {
      count += rateCols.filter(c => !hiddenCols.has(c)).length;
      count += customColumns.filter(c => ['rateKg', 'rateMtr', 'end'].includes(c.insertAfter) && !hiddenCols.has(c.id)).length;
    }
    return Math.max(1, count);
  };

  const totalVisibleCols = useMemo(() => {
    const stdCount = 15 - hiddenCols.size;
    const customCount = customColumns.filter(c => !hiddenCols.has(c.id)).length;
    return stdCount + customCount;
  }, [hiddenCols, customColumns]);

  let slNoCounter = 0;

  return (
    <div className="max-w-[1400px] mx-auto p-4 font-sans text-slate-800 dark:text-slate-100 relative">
      {localAlert && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-2xl border shadow-2xl flex items-center gap-3 animate-bounce ${
          localAlert.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800' 
            : localAlert.type === 'info'
            ? 'bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-800'
            : 'bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
        }`}>
          <span className="text-lg">{localAlert.type === 'success' ? '✅' : localAlert.type === 'info' ? 'ℹ️' : '🚨'}</span>
          <p className="text-xs font-bold uppercase tracking-wider">{localAlert.message}</p>
        </div>
      )}
      {/* Tab Navigation */}
      <div className="mb-8 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner flex gap-1 w-fit no-print">
        <button 
          onClick={() => setActiveTab("builder")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider transition-all duration-200 ${activeTab === 'builder' ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}
        >
          <PlusIcon className="w-3.5 h-3.5" /> Builder
        </button>
        <button 
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider transition-all duration-200 ${activeTab === 'history' ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}
        >
          <FileTextIcon className="w-3.5 h-3.5" /> Saved History ({savedQuotes.length})
        </button>
      </div>

      {activeTab === "builder" ? (
        <>
      {/* Action Bar */}
      <div className="mb-4 flex flex-wrap justify-between items-center no-print gap-4 bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl text-slate-800 dark:text-slate-100">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">Advanced Quotation Builder</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Click cells to edit • Use Eye icons to hide</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap items-center gap-2 mr-4 bg-white dark:bg-slate-900 p-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-800 dark:text-slate-100">
             <span className="text-[10px] font-black uppercase text-slate-400">Filter Brand:</span>
             
             {isInlineEditingBrand && selectedBrand !== "All" ? (
               <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                 <input
                   type="text"
                   value={inlineBrandEditValue}
                   onChange={e => setInlineBrandEditValue(e.target.value)}
                   onKeyDown={e => {
                     if (e.key === 'Enter') {
                       editBrandName(selectedBrand, inlineBrandEditValue);
                       setIsInlineEditingBrand(false);
                     } else if (e.key === 'Escape') {
                       setIsInlineEditingBrand(false);
                     }
                   }}
                   autoFocus
                   placeholder="New brand name"
                   className="text-xs font-black bg-white dark:bg-slate-800 border border-indigo-500 text-slate-900 dark:text-white px-2 py-1 rounded-lg outline-none w-28"
                 />
                 <button
                   onClick={() => {
                     editBrandName(selectedBrand, inlineBrandEditValue);
                     setIsInlineEditingBrand(false);
                   }}
                   className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-sm"
                 >
                   Save
                 </button>
                 <button
                   onClick={() => setIsInlineEditingBrand(false)}
                   className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-bold px-1.5 py-1"
                 >
                   ✕
                 </button>
               </div>
             ) : (
               <div className="flex items-center gap-1.5">
                 <select 
                   value={selectedBrand}
                   onChange={(e) => {
                     const newBrand = e.target.value;
                     setSelectedBrand(newBrand);
                   }}
                   className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-xs p-1.5 px-2 rounded-lg font-black focus:ring-1 focus:ring-indigo-500 cursor-pointer min-w-[110px]"
                 >
                   {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
                 </select>

                 {/* Edit Selected Brand Button */}
                 {selectedBrand !== "All" && (
                   <button
                     type="button"
                     onClick={() => {
                       setInlineBrandEditValue(selectedBrand);
                       setIsInlineEditingBrand(true);
                     }}
                     title={`Edit / Rename brand "${selectedBrand}"`}
                     className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-indigo-200"
                   >
                     <PencilIcon className="w-3.5 h-3.5" />
                   </button>
                 )}

                 {/* Delete Selected Brand Button */}
                 {selectedBrand !== "All" && (
                   <button
                     type="button"
                     onClick={() => deleteBrandName(selectedBrand)}
                     title={`Delete brand "${selectedBrand}"`}
                     className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-red-200"
                   >
                     <TrashIcon className="w-3.5 h-3.5" />
                   </button>
                 )}
               </div>
             )}

             <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

             {/* Add Brand Option */}
             <input 
               className="w-20 border-b border-slate-300 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-100 text-[10px] focus:ring-0 outline-none placeholder:text-gray-400 font-bold px-1"
               placeholder="+ Add Brand"
               onKeyDown={(e) => {
                 if (e.key === 'Enter') {
                   const val = (e.target as HTMLInputElement).value.trim();
                   if (val) {
                     addBrand(val);
                     setSelectedBrand(val);
                     (e.target as HTMLInputElement).value = '';
                   }
                 }
               }}
             />

             {/* Manage Brands Modal Button */}
             <button
               type="button"
               onClick={() => setIsManageBrandsModalOpen(true)}
               className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-all flex items-center gap-1 shadow-sm active:scale-95"
               title="Open Brand Manager: Edit, Delete, or Reset Brands"
             >
               Manage Brands
             </button>

             {selectedBrand !== "All" && (
               <button 
                 onClick={applyBrandToAll}
                 className="text-[9px] bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg font-black uppercase tracking-tighter shadow-sm transition-all active:scale-95"
                 title="Bulk Update: Set all current items' BRAND to this choice"
               >
                 Change All to {selectedBrand}
               </button>
             )}
          </div>
          <button onClick={addProfileRow} className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-2 rounded-lg text-[10px] font-black border border-blue-200 dark:border-blue-800 transition-all active:scale-95 shadow-sm">
            <PlusIcon className="w-3.5 h-3.5" /> + Add Profile
          </button>
          <button onClick={addReinforcementRow} className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 py-2 rounded-lg text-[10px] font-black border border-indigo-200 dark:border-indigo-800 transition-all active:scale-95 shadow-sm">
            <PlusIcon className="w-3.5 h-3.5" /> + Add Reinforcement
          </button>
          <button onClick={showAllRows} className="flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-slate-800">
            <EyeIcon className="w-3 h-3" /> Show All
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-[10px] font-bold shadow-md">
            <DownloadIcon className="w-3 h-3" /> Export Excel
          </button>
          <button onClick={generatePDF} disabled={isGeneratingPdf} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-[10px] font-bold shadow-md transition-all active:scale-95">
            {isGeneratingPdf ? <SpinnerIcon className="w-3 h-3 animate-spin" /> : <FileTextIcon className="w-3 h-3" />}
            {isGeneratingPdf ? "Generating PDF..." : "Download PDF"}
          </button>
          <button onClick={() => setIsDesignerOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-black shadow-lg transition-all hover:scale-105 active:scale-95">
             <LayoutIcon className="w-4 h-4" /> Organization Designer
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 bg-gray-800 hover:bg-black text-white px-3 py-2 rounded-lg text-[10px] font-bold shadow-md">
            <PrinterIcon className="w-3 h-3" /> Print
          </button>
          <button onClick={saveToHistory} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg">
            <SaveIcon className="w-4 h-4" /> Save Local
          </button>
          <button onClick={saveQuotation} disabled={isSaving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg disabled:opacity-50">
            {isSaving ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />} Save
          </button>
        </div>
      </div>

        {/* PDF Designer Panel */}
        <div className="no-print mb-4 bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-800 dark:text-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-slate-400">PDF Designer Controls</h3>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-450 dark:text-slate-500 uppercase">Logo Size</label>
              <input type="range" min="10" max="50" value={pdfSettings.logoSize} onChange={e => setPdfSettings({...pdfSettings, logoSize: parseInt(e.target.value)})} className="w-full accent-indigo-600 cursor-pointer" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-450 dark:text-slate-500 uppercase">Header Font Size</label>
              <input type="number" value={pdfSettings.headerFontSize} onChange={e => setPdfSettings({...pdfSettings, headerFontSize: parseInt(e.target.value)})} className="w-full border border-slate-205 dark:border-slate-850 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-1 rounded font-bold text-xs outline-none" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={pdfSettings.showBankDetails} onChange={e => setPdfSettings({...pdfSettings, showBankDetails: e.target.checked})} className="accent-indigo-505 cursor-pointer" />
              <label className="text-[10px] font-bold text-gray-450 dark:text-slate-500 uppercase select-none">Show Bank Details</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={pdfSettings.showTerms} onChange={e => setPdfSettings({...pdfSettings, showTerms: e.target.checked})} className="accent-indigo-505 cursor-pointer" />
              <label className="text-[10px] font-bold text-gray-450 dark:text-slate-500 uppercase select-none">Show Terms</label>
            </div>
          </div>
        </div>

      {/* Excel Sheet Layout */}
      <div className="border-[1.5px] border-slate-900 p-6 space-y-6 shadow-2xl relative bg-white text-slate-900">
        {/* Column Hide Toggles (No-Print) */}
        <div className="no-print absolute -left-12 top-0 flex flex-col gap-2 p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl shadow-xl text-[9px] font-black uppercase z-30">
           <span className="[writing-mode:vertical-lr] mb-2 text-slate-400 dark:text-slate-500">HIDE COLS</span>
           {['slNo', 'description', 'hsn', 'brand', 'profileCode', 'packets', 'lengthsInPkt', 'totalL', 'eachL', 'lengthWt', 'meterWt', 'totalWt', 'rateKg', 'rateMtr'].map(col => (
             <button 
               key={col} 
               onClick={() => toggleColumnVisibility(col)}
               className={`w-6 h-6 flex items-center justify-center border rounded font-bold uppercase transition-all ${hiddenCols.has(col) ? 'bg-red-500 text-white border-red-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-250 dark:border-slate-700 hover:bg-indigo-50 hover:text-indigo-600'}`}
               title={`Toggle visibility for column ${col}`}
             >
               {col[0].toUpperCase()}
             </button>
           ))}
        </div>
        {/* Header with Dual Logos from Organization Designer */}
        <div className="border-b-[1.5px] border-slate-900 pb-4 mb-4 flex items-center justify-between gap-4">
          {/* Left Logo */}
          <div className="w-36 flex items-center justify-start min-h-[50px]">
            {quotationMeta.logoUrl ? (
              <div 
                className="relative group cursor-pointer" 
                onClick={() => openDesigner(selectedBrand !== "All" ? selectedBrand : undefined)} 
                title="Click to customize brand logos in Organization Designer"
              >
                <img 
                  src={quotationMeta.logoUrl} 
                  alt="Left Logo" 
                  style={{ maxHeight: `${Math.max(36, quotationMeta.logoScale * 1.8)}px` }}
                  className="max-w-[130px] object-contain"
                />
                <div className="no-print absolute inset-0 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 flex items-center justify-center text-[9px] font-bold transition-opacity">
                  Edit ({selectedBrand !== "All" ? selectedBrand : "Default"})
                </div>
              </div>
            ) : (
              <button 
                onClick={() => openDesigner(selectedBrand !== "All" ? selectedBrand : undefined)} 
                className="no-print text-[9px] text-slate-500 hover:text-indigo-600 border border-dashed border-slate-300 hover:border-indigo-400 p-2 rounded-xl flex items-center gap-1 font-bold transition-all"
              >
                <LayoutIcon className="w-3 h-3" /> + Left Logo ({selectedBrand !== "All" ? selectedBrand : "Default"})
              </button>
            )}
          </div>

          {/* Center Title */}
          <div className="text-center flex-1">
            <h1 className="text-3xl font-black tracking-widest uppercase mb-1 text-slate-900">QUOTATION</h1>
            <p className="text-[10px] font-black uppercase text-slate-600 tracking-[0.15em]">{quotationMeta.companyName || companySettings.name}</p>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="inline-block text-[9px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Brand: {selectedBrand !== "All" ? selectedBrand : (quotationMeta.brandTheme || "Default")}
              </span>
              <button 
                onClick={() => openDesigner(selectedBrand !== "All" ? selectedBrand : undefined)}
                className="no-print text-[9px] font-bold text-slate-500 hover:text-indigo-600 underline"
              >
                Change Logos
              </button>
            </div>
          </div>

          {/* Right Logo */}
          <div className="w-36 flex items-center justify-end min-h-[50px]">
            {quotationMeta.logoRightUrl ? (
              <div 
                className="relative group cursor-pointer" 
                onClick={() => openDesigner(selectedBrand !== "All" ? selectedBrand : undefined)} 
                title="Click to customize brand logos in Organization Designer"
              >
                <img 
                  src={quotationMeta.logoRightUrl} 
                  alt="Right Logo" 
                  style={{ maxHeight: `${Math.max(36, quotationMeta.logoScale * 1.8)}px` }}
                  className="max-w-[130px] object-contain"
                />
                <div className="no-print absolute inset-0 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 flex items-center justify-center text-[9px] font-bold transition-opacity">
                  Edit ({selectedBrand !== "All" ? selectedBrand : "Default"})
                </div>
              </div>
            ) : (
              <button 
                onClick={() => openDesigner(selectedBrand !== "All" ? selectedBrand : undefined)} 
                className="no-print text-[9px] text-slate-500 hover:text-indigo-600 border border-dashed border-slate-300 hover:border-indigo-400 p-2 rounded-xl flex items-center gap-1 font-bold transition-all"
              >
                <LayoutIcon className="w-3 h-3" /> + Right Logo ({selectedBrand !== "All" ? selectedBrand : "Default"})
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-4 text-xs">
          <div className="space-y-1">
            <p className="font-black text-slate-500 uppercase text-[9px] tracking-widest">Supplier Registered Address</p>
            <textarea 
              value={quotationMeta.registeredAddress ?? ''}
              onChange={(e) => setQuotationMeta({...quotationMeta, registeredAddress: e.target.value})}
              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 p-2.5 focus:bg-yellow-50/50 outline-none h-20 font-bold text-[10px] rounded-xl shadow-inner text-slate-900 placeholder:text-slate-400 resize-none transition-all"
              placeholder="Enter Registered Office Address..."
            />
          </div>
          <div className="space-y-1">
            <p className="font-black text-slate-500 uppercase text-[9px] tracking-widest">Factory Address</p>
            <textarea 
              value={quotationMeta.factoryAddress ?? ''}
              onChange={(e) => setQuotationMeta({...quotationMeta, factoryAddress: e.target.value})}
              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 p-2.5 focus:bg-yellow-50/50 outline-none h-20 font-bold text-[10px] rounded-xl shadow-inner text-slate-900 placeholder:text-slate-400 resize-none transition-all"
              placeholder="Enter Factory Address..."
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 text-xs mb-4">
          <div className="border border-slate-350 rounded-2xl p-4 bg-slate-50/30 space-y-2">
            <div className="flex justify-between mb-1">
               <span className="font-black text-[10px] text-slate-500 uppercase tracking-wider">Billed & Delivered to:</span>
            </div>
            <input 
               value={quotationMeta.customerName ?? ''}
               onChange={(e) => setQuotationMeta({...quotationMeta, customerName: e.target.value})}
               placeholder="Customer Name..."
               className="w-full bg-white border border-slate-250 hover:border-slate-400 focus:border-indigo-600 mb-2 font-bold p-2 rounded-xl text-slate-900 text-xs outline-none shadow-sm transition-all"
            />
            <textarea 
               value={quotationMeta.customerAddress ?? ''}
               onChange={(e) => setQuotationMeta({...quotationMeta, customerAddress: e.target.value})}
               placeholder="Customer Address..."
               className="w-full h-20 bg-white border border-slate-250 hover:border-slate-400 focus:border-indigo-600 p-2 rounded-xl text-[10px] text-slate-900 outline-none shadow-sm transition-all resize-none"
            />
            <div className="mt-2 flex items-center gap-2">
               <span className="font-black text-[10px] text-slate-500 uppercase">GST NO: </span>
               <input 
                 value={quotationMeta.gstNo ?? ''}
                 onChange={(e) => setQuotationMeta({...quotationMeta, gstNo: e.target.value})}
                 placeholder="Enter GSTNo..."
                 className="bg-white border border-slate-250 hover:border-slate-400 focus:border-indigo-600 outline-none px-2 py-1 rounded-lg text-slate-900 font-bold text-[10px] uppercase shadow-sm transition-all"
               />
            </div>
          </div>
          <div className="border border-slate-300 rounded-2xl overflow-hidden bg-slate-50/50 shadow-inner">
            <table className="w-full text-[10px] text-slate-900">
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-100/40 transition-colors">
                  <td className="p-2 font-black border-r border-slate-200 w-1/2 text-slate-500 uppercase tracking-wider text-[8px]">Quotation No.</td>
                  <td className="p-1.5">
                    <input 
                      value={quotationMeta.quotationNo ?? ''}
                      onChange={(e) => setQuotationMeta({...quotationMeta, quotationNo: e.target.value})}
                      className="w-full bg-white border border-slate-250 focus:border-indigo-650 rounded-lg px-2 py-1 text-slate-905 font-black outline-none uppercase shadow-sm transition-all text-xs"
                    />
                  </td>
                </tr>
                <tr className="hover:bg-slate-100/40 transition-colors">
                  <td className="p-2 font-black border-r border-slate-200 text-slate-500 uppercase tracking-wider text-[8px]">Date</td>
                  <td className="p-1.5">
                    <input 
                      type="date"
                      value={quotationMeta.date ?? ''}
                      onChange={(e) => setQuotationMeta({...quotationMeta, date: e.target.value})}
                      className="w-full bg-white border border-slate-250 focus:border-indigo-650 rounded-lg px-2 py-1 text-slate-905 font-bold outline-none shadow-sm transition-all text-xs"
                    />
                  </td>
                </tr>
                <tr className="hover:bg-slate-100/40 transition-colors">
                  <td className="p-2 font-black border-r border-slate-200 text-slate-500 uppercase tracking-wider text-[8px]">Place of Supply</td>
                  <td className="p-1.5">
                    <input 
                       value={quotationMeta.placeOfSupply ?? ''}
                       onChange={(e) => setQuotationMeta({...quotationMeta, placeOfSupply: e.target.value})}
                       placeholder="Enter Supply Place"
                       className="w-full bg-white border border-slate-250 focus:border-indigo-650 rounded-lg px-2 py-1 text-slate-905 font-bold outline-none shadow-sm transition-all text-xs"
                    />
                  </td>
                </tr>
                <tr className="hover:bg-slate-100/40 transition-colors">
                  <td className="p-2 font-black border-r border-slate-200 text-slate-500 uppercase tracking-wider text-[8px]">State Code</td>
                  <td className="p-1.5">
                    <input 
                       value={quotationMeta.stateCode ?? ''}
                       onChange={(e) => setQuotationMeta({...quotationMeta, stateCode: e.target.value})}
                       placeholder="Enter State Code"
                       className="w-full bg-white border border-slate-250 focus:border-indigo-650 rounded-lg px-2 py-1 text-slate-905 font-bold outline-none shadow-sm transition-all text-xs"
                    />
                  </td>
                </tr>
                <tr className="hover:bg-slate-100/40 transition-colors">
                  <td className="p-2 font-black border-r border-slate-200 text-slate-500 uppercase tracking-wider text-[8px]">Transport</td>
                  <td className="p-1.5">
                    <input 
                       value={quotationMeta.transport ?? ''}
                       onChange={(e) => setQuotationMeta({...quotationMeta, transport: e.target.value})}
                       placeholder="Enter Transport Details"
                       className="w-full bg-white border border-slate-250 focus:border-indigo-650 rounded-lg px-2 py-1 text-slate-905 font-bold outline-none shadow-sm transition-all text-xs"
                    />
                  </td>
                </tr>
                <tr className="hover:bg-slate-100/40 transition-colors">
                  <td className="p-2 font-black border-r border-slate-200 text-slate-500 uppercase tracking-wider text-[8px]">Vehicle No.</td>
                  <td className="p-1.5">
                    <input 
                       value={quotationMeta.vehicleNo ?? ''}
                       onChange={(e) => setQuotationMeta({...quotationMeta, vehicleNo: e.target.value})}
                       placeholder="Enter Vehicle Number"
                       className="w-full bg-white border border-slate-250 focus:border-indigo-650 rounded-lg px-2 py-1 text-slate-905 font-bold outline-none shadow-sm transition-all text-xs"
                    />
                  </td>
                </tr>
                <tr className="no-print bg-violet-50/20">
                  <td className="p-2.5 font-bold border-r border-slate-200 text-indigo-700 text-[9px] uppercase tracking-wider">Company Logo</td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-3">
                      {quotationMeta.logoUrl && (
                        <div className="w-10 h-10 border border-slate-200 bg-white flex items-center justify-center p-1 rounded-lg shadow-sm">
                           <img src={quotationMeta.logoUrl} alt="logo" className="max-w-full max-h-full object-contain" />
                        </div>
                      )}
                      <input 
                         type="file"
                         accept="image/png, image/jpeg"
                         onChange={e => handleLogoUpload(e, "left")}
                         className="text-[9px] text-slate-600 file:border-none file:bg-slate-200 file:px-2 file:py-1 file:rounded-md file:text-[9px] file:font-semibold"
                      />
                      {quotationMeta.logoUrl && (
                        <button 
                          onClick={() => setQuotationMeta({...quotationMeta, logoUrl: ""})}
                          className="text-[9px] text-red-500 hover:underline hover:font-bold"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                <tr className="no-print bg-slate-100/40">
                  <td className="p-2 font-black border-r border-slate-200 text-[8px] uppercase text-slate-500 tracking-wider">Regd Address</td>
                  <td className="p-1.5">
                    <textarea 
                       value={quotationMeta.registeredAddress ?? ''}
                       onChange={(e) => setQuotationMeta({...quotationMeta, registeredAddress: e.target.value})}
                       className="w-full bg-white border border-slate-200 focus:border-indigo-500 p-2 focus:ring-0 outline-none text-[10px] font-mono leading-tight resize-none h-14 rounded-xl shadow-sm text-slate-905"
                    />
                  </td>
                </tr>
                <tr className="no-print bg-slate-100/40">
                  <td className="p-2 font-black border-r border-slate-200 text-[8px] uppercase text-slate-500 tracking-wider">Factory Address</td>
                  <td className="p-1.5">
                    <textarea 
                       value={quotationMeta.factoryAddress ?? ''}
                       onChange={(e) => setQuotationMeta({...quotationMeta, factoryAddress: e.target.value})}
                       className="w-full bg-white border border-slate-200 focus:border-indigo-500 p-2 focus:ring-0 outline-none text-[10px] font-mono leading-tight resize-none h-14 rounded-xl shadow-sm text-slate-905"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* GST Switch & Tabs */}
        <div className="no-print mb-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="font-bold">GST MODE:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={gstMode === "CGST_SGST"} onChange={() => setGstMode("CGST_SGST")} /> CGST/SGST (9%+9%)
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={gstMode === "IGST"} onChange={() => setGstMode("IGST")} /> IGST (18%)
            </label>
          </div>

          <div className="flex items-center gap-3">
            <div className="group relative">
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm">
                <LayoutIcon className="w-3.5 h-3.5" />
                Columns
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 hidden group-hover:block">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1 text-center border-b pb-1">Visible Columns</p>
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {[
                    { id: 'slNo', label: 'Sl.No' },
                    { id: 'description', label: 'Description' },
                    { id: 'hsn', label: 'HSN Code' },
                    { id: 'brand', label: 'Brand' },
                    { id: 'profileCode', label: 'Profile Code' },
                    ...customColumns.map(c => ({ id: c.id, label: `${c.name} (Custom)` })),
                    { id: 'packets', label: 'Packets' },
                    { id: 'lengthsInPkt', label: 'Lengths/Pkt' },
                    { id: 'totalL', label: 'Total Length' },
                    { id: 'eachL', label: 'Each Length' },
                    { id: 'lengthWt', label: 'Length Weight' },
                    { id: 'meterWt', label: 'Meter Weight' },
                    { id: 'totalWt', label: 'Total Weight' },
                    { id: 'rateKg', label: 'Rate/Kg' },
                    { id: 'rateMtr', label: 'Rate/MTR' },
                  ].map(col => (
                    <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group/item">
                      <input 
                        type="checkbox" 
                        checked={!hiddenCols.has(col.id)} 
                        onChange={() => toggleColumn(col.id)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`text-[10px] font-bold transition-colors ${!hiddenCols.has(col.id) ? 'text-slate-800' : 'text-slate-400'}`}>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
               <button
                 onClick={() => setBuilderTab("reinforcements")}
                 className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${
                   builderTab === "reinforcements" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
                 }`}
               >
                 Reinforcement
               </button>
               <button
                 onClick={() => setBuilderTab("profiles")}
                 className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${
                   builderTab === "profiles" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
                 }`}
               >
                 Profile Data
               </button>
            </div>
          </div>
        </div>

        {/* Modal to Add Custom Column */}
        {showAddColumnModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                  <span className="p-1 rounded bg-indigo-50 text-indigo-700">➕</span> Add Custom Column
                </h3>
                <button 
                  onClick={() => setShowAddColumnModal(false)}
                  className="text-slate-400 hover:text-slate-700 text-lg font-bold w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">Column Header Title</label>
                  <input
                    value={newColName}
                    onChange={e => setNewColName(e.target.value)}
                    placeholder="e.g. Color Code, Remarks, Batch..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:border-indigo-600 outline-none"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        insertCustomColumn(newColName, newColPos);
                      }
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-600 mb-1">Insert Position</label>
                  <select
                    value={newColPos}
                    onChange={e => setNewColPos(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:border-indigo-600 outline-none cursor-pointer"
                  >
                    <option value="description">After Description</option>
                    <option value="hsn">After HSN</option>
                    <option value="brand">After Brand</option>
                    <option value="profileCode">After Profile Code</option>
                    <option value="packets">After Packets</option>
                    <option value="lengthsInPkt">After L/Pkt</option>
                    <option value="totalL">After Total Length</option>
                    <option value="eachL">After Each Length</option>
                    <option value="lengthWt">After Length Weight</option>
                    <option value="meterWt">After Meter Weight</option>
                    <option value="totalWt">After Total Weight</option>
                    <option value="rateKg">After Rate/Kg</option>
                    <option value="rateMtr">After Rate/MTR</option>
                    <option value="end">At Table End (After Amount)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  onClick={() => setShowAddColumnModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => insertCustomColumn(newColName, newColPos)}
                  className="px-4 py-1.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm active:scale-95 transition-all"
                >
                  Add Column
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Excel Spreadsheet Ribbon Toolbar */}
        <div className="no-print bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border-2 border-emerald-500/30 rounded-2xl p-3 shadow-sm mb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-xs">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="8" y1="13" x2="16" y2="13"></line>
                  <line x1="8" y1="17" x2="16" y2="17"></line>
                  <line x1="10" y1="9" x2="10" y2="9.01"></line>
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-2">
                  Excel Spreadsheet Tools
                  <span className="text-[9px] bg-emerald-200 text-emerald-800 px-1.5 py-0.2 rounded-full font-extrabold">Active Grid</span>
                </h4>
                <p className="text-[10px] text-emerald-800 font-medium">
                  {selectedRowItem 
                    ? `Selected Row: "${selectedRowItem.description?.substring(0, 22)}..." (${selectedRowType === 'items' ? 'Profile' : 'Reinforcement'})` 
                    : "Select any row to merge/center, insert above/below, or click the buttons below"}
                </p>
              </div>
            </div>

            {/* Quick Action Ribbon Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Merge & Center Button */}
              <button
                onClick={handleToolbarMergeCenter}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-all shadow-sm active:scale-95 ${
                  selectedRowItem?.isMerged
                    ? "bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-300"
                }`}
                title="Merge row across all columns and center text (Excel style)"
              >
                <span className="text-sm">🔀</span>
                {selectedRowItem?.isMerged ? "Unmerge Row" : "Merge & Center"}
              </button>

              {/* Insert Row Above */}
              <button
                onClick={() => handleToolbarInsertRow("above", false)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100/70 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95"
                title="Insert new row above current selection"
              >
                <PlusIcon className="w-3.5 h-3.5 text-emerald-600" />
                + Row Above
              </button>

              {/* Insert Row Below */}
              <button
                onClick={() => handleToolbarInsertRow("below", false)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100/70 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95"
                title="Insert new row below current selection"
              >
                <PlusIcon className="w-3.5 h-3.5 text-emerald-600" />
                + Row Below
              </button>

              {/* Insert Merged Row */}
              <button
                onClick={() => handleToolbarInsertRow("below", true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 border border-indigo-300 text-indigo-900 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95"
                title="Insert a new Merged & Centered heading row"
              >
                <span className="text-xs">➕🔀</span>
                + Merged Row
              </button>

              {/* Add Custom Column */}
              <button
                onClick={() => setShowAddColumnModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-sky-300 text-sky-900 hover:bg-sky-100/70 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95"
                title="Add a new custom column anywhere in quotation grid"
              >
                <PlusIcon className="w-3.5 h-3.5 text-sky-600" />
                + Column
              </button>

              {/* Toggle Grouped Headers */}
              <button
                onClick={() => setShowGroupedHeaders(!showGroupedHeaders)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 border ${
                  showGroupedHeaders 
                    ? "bg-teal-600 text-white border-teal-700" 
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
                title="Toggle Excel two-tier grouped category headers"
              >
                <span>📊</span>
                {showGroupedHeaders ? "Grouped: ON" : "Group Headers"}
              </button>

              {/* Delete Selected Row */}
              {selectedRowId && (
                <button
                  onClick={handleToolbarDeleteRow}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 border border-red-300 text-red-700 hover:bg-red-100 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95"
                  title="Delete selected row"
                >
                  <TrashIcon className="w-3.5 h-3.5 text-red-600" />
                  Delete Row
                </button>
              )}
            </div>
          </div>

          {/* Active Selection Details Bar */}
          {selectedRowItem && (
            <div className="mt-2.5 pt-2 border-t border-emerald-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-black text-emerald-950 uppercase tracking-wider text-[10px]">Row Options:</span>
                <button
                  onClick={() => toggleMergeCenter(selectedRowType!, selectedRowId!)}
                  className="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-lg font-bold text-[10px] transition-all"
                >
                  {selectedRowItem.isMerged ? "Split back to cells" : "Merge all cells & center"}
                </button>
                {selectedRowItem.isMerged && (
                  <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                    <span className="text-[10px] font-bold text-slate-600">Align:</span>
                    {(['left', 'center', 'right'] as const).map(align => (
                      <button
                        key={align}
                        onClick={() => updateItemValue(selectedRowType!, selectedRowItemIndex, 'mergedAlign', align)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold capitalize ${
                          (selectedRowItem.mergedAlign || 'center') === align ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-mono">Row ID: {selectedRowId.substring(0, 14)}</span>
                <button
                  onClick={() => { setSelectedRowId(null); setSelectedRowType(null); }}
                  className="text-[10px] text-slate-600 hover:text-slate-900 underline"
                >
                  Deselect
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Main Table */}
        <QuotationSpreadsheetGrid
          items={items}
          reinforcements={reinforcements}
          hiddenCols={hiddenCols}
          customColumns={customColumns}
          selectedBrand={selectedBrand}
          availableBrands={brandOptions.filter(b => b !== "All")}
          builderTab={builderTab}
          selectedRowId={selectedRowId}
          selectedRowType={selectedRowType}
          showGroupedHeaders={showGroupedHeaders}
          totalVisibleCols={totalVisibleCols}
          getGroupColSpan={getGroupColSpan}
          calculateRowTotal={calculateRowTotal}
          updateItemValue={updateItemValue}
          updateCustomField={updateCustomField}
          setSelectedRowId={setSelectedRowId}
          setSelectedRowType={setSelectedRowType}
          insertRow={insertRow}
          toggleMergeCenter={toggleMergeCenter}
          deleteRow={deleteRow}
          toggleRowVisibility={toggleRowVisibility}
          deleteCustomColumn={deleteCustomColumn}
          addProfileRow={addProfileRow}
          addReinforcementRow={addReinforcementRow}
        />

        {/* Footer Totals */}
        <div className="flex justify-between items-end mt-4">
          <div className="text-[10px] space-y-4">
            <div className="p-2 border border-black bg-gray-50 uppercase font-bold max-w-lg min-h-[40px]">
               <p className="text-[9px]">Amount in words: <span className="text-gray-500 font-mono italic block mt-1">{amountToWords(totals.grandTotal)}</span></p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1 bg-slate-50/50 p-2.5 rounded-xl border border-slate-250 print:border-none print:bg-transparent print:p-0">
                 <div className="flex items-center justify-between">
                   <p className="font-black uppercase tracking-wider text-[9px] text-slate-500 print:text-black underline mb-1">Company Details & Bank Info:</p>
                   <span className="no-print text-[8px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Editable</span>
                 </div>
                 
                 <div className="space-y-1">
                   <div className="flex items-center gap-1.5">
                     <span className="font-bold text-[9px] text-slate-600 min-w-[70px]">Company:</span>
                     <input 
                       value={quotationMeta.companyName ?? ''}
                       onChange={(e) => setQuotationMeta({...quotationMeta, companyName: e.target.value})}
                       className="w-full bg-white print:bg-transparent border border-slate-200 print:border-none hover:border-slate-400 focus:border-indigo-600 px-1.5 py-0.5 rounded text-[10px] font-black text-slate-900 outline-none"
                       placeholder="Company Name"
                     />
                   </div>

                   <div className="flex items-center gap-1.5">
                     <span className="text-[9px] text-slate-600 font-semibold min-w-[70px]">CA - A/c No:</span>
                     <input 
                       value={quotationMeta.accountNo ?? ''}
                       onChange={(e) => setQuotationMeta({...quotationMeta, accountNo: e.target.value})}
                       className="w-full bg-white print:bg-transparent border border-slate-200 print:border-none hover:border-slate-400 focus:border-indigo-600 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-slate-900 outline-none"
                       placeholder="Account Number"
                     />
                   </div>

                   <div className="flex items-center gap-1.5">
                     <span className="text-[9px] text-slate-600 font-semibold min-w-[70px]">Bank:</span>
                     <input 
                       value={quotationMeta.bankName ?? ''}
                       onChange={(e) => setQuotationMeta({...quotationMeta, bankName: e.target.value})}
                       className="w-full bg-white print:bg-transparent border border-slate-200 print:border-none hover:border-slate-400 focus:border-indigo-600 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-900 outline-none"
                       placeholder="Bank Name"
                     />
                   </div>

                   <div className="flex items-center gap-1.5">
                     <span className="text-[9px] text-slate-600 font-semibold min-w-[70px]">IFSC:</span>
                     <input 
                       value={quotationMeta.ifscCode ?? ''}
                       onChange={(e) => setQuotationMeta({...quotationMeta, ifscCode: e.target.value})}
                       className="w-full bg-white print:bg-transparent border border-slate-200 print:border-none hover:border-slate-400 focus:border-indigo-600 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-slate-900 outline-none"
                       placeholder="IFSC Code"
                     />
                   </div>

                   <div className="flex items-center gap-1.5">
                     <span className="text-[9px] text-slate-600 font-semibold min-w-[70px]">Branch:</span>
                     <input 
                       value={quotationMeta.branchName ?? ''}
                       onChange={(e) => setQuotationMeta({...quotationMeta, branchName: e.target.value})}
                       className="w-full bg-white print:bg-transparent border border-slate-200 print:border-none hover:border-slate-400 focus:border-indigo-600 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-900 outline-none"
                       placeholder="Branch Name"
                     />
                   </div>
                 </div>
               </div>
               <div className="text-center pt-8">
                 <div className="w-full border-t border-black mt-8 pt-1 uppercase font-bold tracking-widest text-[9px]">Authorised Signature</div>
                 <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase">For {quotationMeta.companyName || companySettings.name}</p>
               </div>
            </div>
          </div>

          <div className="w-64 border border-black text-[10px] bg-white overflow-hidden">
             <table className="w-full">
               <tbody className="divide-y divide-black">
                 <tr>
                    <td className="p-1 font-bold border-r border-black">Total Taxable Value</td>
                    <td className="p-1 text-right font-black">₹ {totals.subtotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                 </tr>
                 {gstMode === "IGST" ? (
                   <tr>
                      <td className="p-1 font-bold border-r border-black">IGST @ 18%</td>
                      <td className="p-1 text-right">₹ {totals.igst.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                   </tr>
                 ) : (
                   <>
                     <tr>
                        <td className="p-1 font-bold border-r border-black">CGST @ 9%</td>
                        <td className="p-1 text-right">₹ {totals.cgst.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                     </tr>
                     <tr>
                        <td className="p-1 font-bold border-r border-black">SGST @ 9%</td>
                        <td className="p-1 text-right">₹ {totals.sgst.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                     </tr>
                   </>
                 )}
                 <tr className="bg-gray-900 text-white font-black text-xs">
                    <td className="p-2 uppercase border-r border-white">Total Value</td>
                    <td className="p-2 text-right">₹ {totals.grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                 </tr>
               </tbody>
             </table>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { counter-reset: none; }
          .no-print { display: none !important; }
          .print-full { width: 100% !important; margin: 0 !important; }
        }
      `}} />


        </>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-8 min-h-[60vh] text-slate-900 dark:text-slate-100 transition-colors">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8 border-b border-slate-100 dark:border-slate-800 pb-6">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-50">Saved Quotations</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">Manage and reload your previous work</p>
            </div>
            <button 
              onClick={() => { if(confirm("Clear all history?")) { setSavedQuotes([]); localStorage.removeItem("raviraja_saved_quotes"); } }}
              className="text-[10px] bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-4 py-2 rounded-full font-bold hover:bg-red-100/80 active:scale-95 uppercase tracking-wider transition-all self-start sm:self-center"
            >
              Clear All History
            </button>
          </div>

          {savedQuotes.filter(quote => selectedBrand === "All" || quote.items.some(it => it.brand === selectedBrand)).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-300 dark:text-slate-700">
              <FileTextIcon className="w-16 h-16 mb-4 opacity-30" />
              <p className="font-black uppercase tracking-widest text-xs">No saved quotations found {selectedBrand !== "All" ? `for brand ${selectedBrand}` : ""}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedQuotes
                .filter(quote => selectedBrand === "All" || quote.items.some(it => it.brand === selectedBrand))
                .map((quote) => (
                <div key={quote.id} className="group border border-slate-200 dark:border-slate-800 rounded-2xl p-6 bg-slate-50/50 dark:bg-slate-950 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all hover:shadow-2xl relative overflow-hidden">
                  <div className="absolute top-2 right-2 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => deleteFromHistory(quote.id)} 
                      className="text-red-500 hover:text-red-700 bg-white dark:bg-slate-800 shadow-md rounded-full p-2 border border-slate-300 dark:border-slate-700 transition"
                      title="Delete quote from history"
                    >
                       <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="mb-4">
                    <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1 italic">#{quote.meta.quotationNo}</p>
                    <h3 className="text-lg font-black leading-tight uppercase line-clamp-1 text-slate-800 dark:text-slate-100">{quote.meta.customerName || "CASUAL CUSTOMER"}</h3>
                  </div>
                  <div className="space-y-3 mb-6 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
                    <div className="flex justify-between text-[10px] font-bold uppercase">
                      <span className="text-slate-400 dark:text-slate-500">Date</span>
                      <span className="text-slate-700 dark:text-slate-300">{quote.timestamp}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold uppercase">
                      <span className="text-slate-400 dark:text-slate-500">Total Items</span>
                      <span className="text-slate-700 dark:text-slate-300">{quote.items.length + quote.reinforcements.length}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2 font-black">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Value</span>
                      <span className="text-sm text-slate-900 dark:text-slate-50">INR {(quote.totals?.grandTotal || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => loadFromHistory(quote)}
                    className="w-full bg-slate-900 dark:bg-indigo-600 text-white dark:text-indigo-50 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 dark:hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all shadow-md hover:shadow-indigo-500/25 cursor-pointer"
                  >
                    Open & Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Organization Designer Modal */}
      {isDesignerOpen && (
        <div className="fixed inset-0 bg-[#020617]/90 backdrop-blur-md flex items-center justify-center z-50 p-4 no-print transition-all">
           <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
              <div className="bg-slate-900 dark:bg-slate-950 p-6 sm:p-8 flex justify-between items-center text-white border-b border-slate-850 sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter flex items-center gap-3 text-white">
                    <LayoutIcon className="w-7 h-7 text-indigo-400" />
                    Organization Designer & Brand Logos
                  </h2>
                  <p className="text-slate-400 dark:text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">
                    Save individual logos per brand. Switching brands in Quotation automatically loads that brand's logos.
                  </p>
                </div>
                <button 
                  onClick={() => setIsDesignerOpen(false)} 
                  className="bg-white/10 dark:bg-slate-800/80 p-2 text-white rounded-full hover:bg-white/20 dark:hover:bg-slate-700 transition-all flex items-center justify-center cursor-pointer"
                  title="Close Designer"
                >
                  <TrashIcon className="w-6 h-6 rotate-45 text-white" />
                </button>
              </div>

              <div className="p-6 sm:p-8 space-y-8">
                {/* Brand Selector Bar */}
                <div className="bg-slate-50 dark:bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Select Brand to Configure</span>
                      <h4 className="text-sm font-black uppercase text-slate-800 dark:text-slate-200">
                        Configuring Logos for: <span className="text-indigo-600 dark:text-indigo-400 underline">{designerBrand}</span>
                      </h4>
                    </div>
                    {/* Inline Add Brand */}
                    <div className="flex items-center gap-2">
                      <input 
                        type="text"
                        value={newDesignerBrandInput}
                        onChange={e => setNewDesignerBrandInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newDesignerBrandInput.trim()) {
                            addBrand(newDesignerBrandInput.trim());
                            setDesignerBrand(newDesignerBrandInput.trim());
                            setNewDesignerBrandInput("");
                          }
                        }}
                        placeholder="Add new brand name..."
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs px-3 py-1.5 rounded-xl font-bold outline-none focus:border-indigo-500 w-44 text-slate-900 dark:text-white"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (newDesignerBrandInput.trim()) {
                            addBrand(newDesignerBrandInput.trim());
                            setDesignerBrand(newDesignerBrandInput.trim());
                            setNewDesignerBrandInput("");
                          }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow transition-all active:scale-95 flex items-center gap-1"
                      >
                        <PlusIcon className="w-3 h-3" /> Add
                      </button>
                    </div>
                  </div>

                  {/* Brand Pills */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {brandOptions.filter(b => b !== "All").map(brandName => {
                      const brandData = getBrandLogoData(brandName);
                      const hasLeft = !!brandData.logoUrl;
                      const hasRight = !!brandData.logoRightUrl;
                      const isSelected = designerBrand.toLowerCase() === brandName.toLowerCase();
                      
                      
                      return (
                        <div
                          key={brandName}
                          className={`group/pill flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setDesignerBrand(brandName)}
                            className="flex items-center gap-2 cursor-pointer outline-none"
                          >
                            <span>{brandName}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                              isSelected
                                ? 'bg-indigo-800 text-indigo-100'
                                : hasLeft || hasRight
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}>
                              {hasLeft && hasRight ? '2 Logos' : hasLeft ? 'Left Logo' : hasRight ? 'Right Logo' : 'No Logo'}
                            </span>
                          </button>

                          {/* Action icons for brand */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newName = window.prompt(`Rename brand "${brandName}" to:`, brandName);
                              if (newName && newName.trim()) {
                                editBrandName(brandName, newName.trim());
                              }
                            }}
                            title={`Rename brand ${brandName}`}
                            className={`p-1 rounded opacity-0 group-hover/pill:opacity-100 transition-opacity ${
                              isSelected ? 'hover:bg-indigo-700 text-indigo-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600'
                            }`}
                          >
                            <PencilIcon className="w-3 h-3" />
                          </button>

                          {true && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteBrandName(brandName);
                              }}
                              title={`Delete brand ${brandName}`}
                              className={`p-1 rounded opacity-0 group-hover/pill:opacity-100 transition-opacity ${
                                isSelected ? 'hover:bg-indigo-700 text-red-200 hover:text-red-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500'
                              }`}
                            >
                              <TrashIcon className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Header Layout Visualization for Selected Brand */}
                {(() => {
                  const brandData = getBrandLogoData(designerBrand);
                  return (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                         <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2 border-l-4 border-indigo-500 pl-4">
                            Header Layout for Brand: {designerBrand}
                         </h3>
                         <div className="flex flex-wrap items-center gap-6 bg-slate-50 dark:bg-slate-950 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-850">
                           <div className="flex items-center gap-3">
                             <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Logo Scale</span>
                             <input 
                                type="range" 
                                min="15" max="50" 
                                value={brandData.logoScale || 22} 
                                onChange={e => {
                                  const sc = parseInt(e.target.value);
                                  saveBrandLogoData(designerBrand, { logoScale: sc });
                                  if (selectedBrand === designerBrand) {
                                    setQuotationMeta(prev => ({ ...prev, logoScale: sc }));
                                  }
                                }} 
                                className="w-28 accent-indigo-500 cursor-pointer"
                             />
                             <span className="text-xs font-bold font-mono">{brandData.logoScale || 22}</span>
                           </div>
                           <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-800" />
                           <div className="flex items-center gap-3">
                             <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Brand Theme:</span>
                             <input
                               type="text"
                               value={brandData.brandTheme || designerBrand}
                               onChange={e => {
                                 const th = e.target.value;
                                 saveBrandLogoData(designerBrand, { brandTheme: th });
                                 if (selectedBrand === designerBrand) {
                                   setQuotationMeta(prev => ({ ...prev, brandTheme: th }));
                                 }
                               }}
                               className="text-[10px] font-black border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-1.5 px-2.5 rounded-xl shadow-sm outline-none w-28"
                             />
                           </div>
                         </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6 sm:p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-950/30">
                        {/* Left Logo Slot */}
                        <div className="flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-205 dark:border-slate-800 shadow-sm hover:border-slate-400 dark:hover:border-slate-600 transition-all hover:shadow-md cursor-pointer relative group aspect-video">
                          {brandData.logoUrl ? (
                            <img src={brandData.logoUrl} alt={`${designerBrand} Left Logo`} className="max-w-full max-h-full object-contain" />
                          ) : (
                            <div className="text-center">
                              <PlusIcon className="w-8 h-8 text-slate-350 mx-auto text-slate-400" />
                              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mt-2 block">+ {designerBrand} Left Logo</span>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={e => handleLogoUpload(e, "left", designerBrand)} 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                          />
                          {brandData.logoUrl && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                saveBrandLogoData(designerBrand, { logoUrl: "" });
                                if (selectedBrand === designerBrand) {
                                  setQuotationMeta(prev => ({ ...prev, logoUrl: "" }));
                                }
                                triggerAlert(`Left logo removed for brand "${designerBrand}"`);
                              }} 
                              className="absolute top-2 right-2 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900 text-red-500 p-2 rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition shadow-sm border border-red-200 dark:border-red-800"
                              title="Delete Left Logo"
                            >
                               <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Mid Section Text Placeholder */}
                        <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 border-y sm:border-y-0 sm:border-x border-slate-200 dark:border-slate-800 py-4 sm:py-0 px-4 text-center">
                           <h5 className="font-black text-xs uppercase tracking-widest text-slate-800 dark:text-slate-200">QUOTATION</h5>
                           <p className="text-[9px] font-bold uppercase mt-0.5">{quotationMeta.companyName}</p>
                           <span className="text-[8px] mt-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-black uppercase">
                             Brand: {designerBrand}
                           </span>
                        </div>

                        {/* Right Logo Slot */}
                        <div className="flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-205 dark:border-slate-800 shadow-sm hover:border-slate-400 dark:hover:border-slate-600 transition-all hover:shadow-md cursor-pointer relative group aspect-video">
                          {brandData.logoRightUrl ? (
                            <img src={brandData.logoRightUrl} alt={`${designerBrand} Right Logo`} className="max-w-full max-h-full object-contain" />
                          ) : (
                            <div className="text-center">
                              <PlusIcon className="w-8 h-8 text-slate-350 mx-auto text-slate-400" />
                              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mt-2 block">+ {designerBrand} Right Logo</span>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={e => handleLogoUpload(e, "right", designerBrand)} 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                          />
                          {brandData.logoRightUrl && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                saveBrandLogoData(designerBrand, { logoRightUrl: "" });
                                if (selectedBrand === designerBrand) {
                                  setQuotationMeta(prev => ({ ...prev, logoRightUrl: "" }));
                                }
                                triggerAlert(`Right logo removed for brand "${designerBrand}"`);
                              }} 
                              className="absolute top-2 right-2 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900 text-red-500 p-2 rounded-full opacity-100 sm:opacity-0 group-hover:opacity-100 transition shadow-sm border border-red-200 dark:border-red-800"
                              title="Delete Right Logo"
                            >
                               <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                        Tip: You can switch brands above to configure unique logos for each brand. When you change brands in the Quotation sheet, the saved logos will switch automatically.
                      </p>
                    </div>
                  );
                })()}

                <div className="flex justify-between items-center pt-6 border-t border-slate-200 dark:border-slate-850">
                   <button 
                     onClick={() => {
                       const brandData = getBrandLogoData(designerBrand);
                       if (brandData.logoUrl || brandData.logoRightUrl) {
                         brandOptions.filter(b => b !== "All").forEach(b => {
                           saveBrandLogoData(b, {
                             logoUrl: brandData.logoUrl,
                             logoRightUrl: brandData.logoRightUrl,
                             logoScale: brandData.logoScale
                           });
                         });
                         triggerAlert(`Copied ${designerBrand} logos to all available brands!`, "success");
                       } else {
                         triggerAlert("Please upload a logo first to copy.", "error");
                       }
                     }}
                     className="px-4 py-2.5 font-bold uppercase text-[10px] tracking-wider text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                   >
                     Copy {designerBrand} Logos to All Brands
                   </button>

                   <div className="flex items-center gap-3">
                     <button 
                       onClick={() => setIsDesignerOpen(false)} 
                       className="px-6 py-3.5 font-black uppercase text-xs tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all cursor-pointer"
                     >
                        Close
                     </button>
                     <button 
                       onClick={() => {
                         const currentData = getBrandLogoData(designerBrand);
                         if (selectedBrand === designerBrand || selectedBrand === "All") {
                           setQuotationMeta(prev => ({
                             ...prev,
                             logoUrl: currentData.logoUrl,
                             logoRightUrl: currentData.logoRightUrl,
                             logoScale: currentData.logoScale,
                             brandTheme: currentData.brandTheme
                           }));
                         }
                         setIsDesignerOpen(false);
                         triggerAlert(`Brand-wise logos saved successfully!`, "success");
                       }} 
                       className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                     >
                        Save & Apply Changes
                     </button>
                   </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Manage Brands Modal */}
      {isManageBrandsModalOpen && (
        <div className="fixed inset-0 bg-[#020617]/90 backdrop-blur-md flex items-center justify-center z-50 p-4 no-print transition-all">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="bg-slate-900 dark:bg-slate-950 p-6 flex justify-between items-center text-white border-b border-slate-800 sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2.5 text-white">
                  <span>🏷️</span> Manage Quotation Brands
                </h2>
                <p className="text-slate-400 text-xs font-bold mt-1">
                  Add, edit/rename, or delete brand names. Easily remove external brands that are not our brands.
                </p>
              </div>
              <button 
                onClick={() => setIsManageBrandsModalOpen(false)}
                className="bg-white/10 p-2 text-white rounded-full hover:bg-white/20 transition-all cursor-pointer"
                title="Close Modal"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Add New Brand Bar */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between">
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={newBrandModalInput}
                    onChange={e => setNewBrandModalInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newBrandModalInput.trim()) {
                        addBrand(newBrandModalInput.trim());
                        setNewBrandModalInput("");
                      }
                    }}
                    placeholder="Enter new brand name..."
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs px-3.5 py-2.5 rounded-xl font-bold outline-none focus:border-indigo-500 text-slate-900 dark:text-white shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newBrandModalInput.trim()) {
                        addBrand(newBrandModalInput.trim());
                        setNewBrandModalInput("");
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow transition-all active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <PlusIcon className="w-3.5 h-3.5" /> Add Brand
                  </button>
                </div>
              </div>

              {/* Brand List */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-wider px-2">
                  <span>Brand Name & Category</span>
                  <span>Active Rows & Actions</span>
                </div>

                {brandOptions.filter(b => b !== "All").length === 0 ? (
                  <div className="text-center py-8 text-slate-400 font-bold text-xs">
                    No brands configured yet.
                  </div>
                ) : (
                  brandOptions.filter(b => b !== "All").map(brand => {
                    
                    const isEditing = editingBrandInModal === brand;
                    const itemCount = items.filter(it => it.brand === brand).length + reinforcements.filter(it => it.brand === brand).length;
                    const brandLogo = getBrandLogoData(brand);
                    const hasLogo = !!(brandLogo.logoUrl || brandLogo.logoRightUrl);

                    return (
                      <div 
                        key={brand}
                        className={`flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                          isEditing
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {/* Brand Label or Inline Edit Field */}
                        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={editBrandModalInput}
                                onChange={e => setEditBrandModalInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    editBrandName(brand, editBrandModalInput);
                                    setEditingBrandInModal(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingBrandInModal(null);
                                  }
                                }}
                                autoFocus
                                className="bg-white dark:bg-slate-800 border border-indigo-500 text-xs px-3 py-1.5 rounded-xl font-bold outline-none text-slate-900 dark:text-white flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  editBrandName(brand, editBrandModalInput);
                                  setEditingBrandInModal(null);
                                }}
                                className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-indigo-700 shadow-sm cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingBrandInModal(null)}
                                className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1.5 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2.5">
                              <span className="font-black text-sm text-slate-900 dark:text-white">{brand}</span>
                              {hasLogo && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                  Logo Configured
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Stats & Actions */}
                        {!isEditing && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                              {itemCount} item{itemCount !== 1 ? 's' : ''} in sheet
                            </span>

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBrandInModal(brand);
                                setEditBrandModalInput(brand);
                              }}
                              className="p-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all border border-slate-200 dark:border-slate-800 flex items-center gap-1 text-xs font-bold cursor-pointer"
                              title={`Edit / Rename brand ${brand}`}
                            >
                              <PencilIcon className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Edit</span>
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => deleteBrandName(brand)}
                              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-all border border-red-200 dark:border-red-900 flex items-center gap-1 text-xs font-bold cursor-pointer"
                              title={`Delete brand ${brand}`}
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500">
                  Total Brands: {brandOptions.filter(b => b !== "All").length}
                </span>
                <button
                  type="button"
                  onClick={() => setIsManageBrandsModalOpen(false)}
                  className="bg-slate-900 dark:bg-slate-800 hover:bg-black text-white px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider shadow transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
