import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Profile, CustomColumn } from '../types';
import { isReinforcementProfile } from '../utils';
import { 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Columns, 
  Download, 
  Upload, 
  Layers, 
  Copy, 
  Sparkles,
  ChevronDown,
  X,
  Search,
  Check,
  Package,
  FileSpreadsheet,
  Edit2,
  AlertTriangle,
  Filter,
  CheckCircle2,
  Boxes,
  Shuffle,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ProfileMasterSpreadsheetGridProps {
  profiles: Profile[];
  brands: string[];
  selectedBrand: string;
  onBrandChange: (brand: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  typeFilter?: 'All' | 'WINDOW' | 'REINFORCEMENT';
  onTypeFilterChange?: (type: 'All' | 'WINDOW' | 'REINFORCEMENT') => void;
  onUpdateProfile: (profile: Profile) => void;
  onEditProfile?: (profile: Profile) => void;
  onAddProfile: (profile: Omit<Profile, 'id' | 'createdAt'>) => Profile | void;
  onInsertProfileAt?: (profile: Omit<Profile, 'id' | 'createdAt'>, relativeId?: string | null, position?: 'above' | 'below') => Profile | void;
  onDeleteProfile: (id: string) => void;
  onPermanentlyDeleteProfile?: (id: string) => void;
  onDeduplicateProfiles?: () => void;
  onSyncProfileSpecsBySku?: (sourceProfileId: string) => void;
  onPushStandardCatalogueToAll?: (sourceBrand?: string) => { syncedProfiles: number; syncedFilms: number; syncedBrands: number };
  onUploadExcelClick: () => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ProfileMasterSpreadsheetGrid = ({
  profiles,
  brands,
  selectedBrand,
  onBrandChange,
  searchTerm,
  onSearchChange,
  typeFilter: controlledTypeFilter,
  onTypeFilterChange,
  onUpdateProfile,
  onEditProfile,
  onAddProfile,
  onInsertProfileAt,
  onDeleteProfile,
  onPermanentlyDeleteProfile,
  onDeduplicateProfiles,
  onSyncProfileSpecsBySku,
  onPushStandardCatalogueToAll,
  onUploadExcelClick,
  addToast
}: ProfileMasterSpreadsheetGridProps) => {
  // Selection state
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [deleteTargetProfile, setDeleteTargetProfile] = useState<Profile | null>(null);
  const [internalTypeFilter, setInternalTypeFilter] = useState<'All' | 'WINDOW' | 'REINFORCEMENT'>('WINDOW');
  const typeFilter = controlledTypeFilter !== undefined ? controlledTypeFilter : internalTypeFilter;
  const setTypeFilter = onTypeFilterChange || setInternalTypeFilter;

  // Text edit buffer for decimal numbers to prevent input skipping/erasing while typing '.'
  const [numericEditBuffers, setNumericEditBuffers] = useState<Record<string, string>>({});

  const getNumericDisplayValue = (profileId: string, field: string, realValue: any) => {
    const key = `${profileId}_${field}`;
    if (numericEditBuffers[key] !== undefined) {
      return numericEditBuffers[key];
    }
    return realValue !== undefined && realValue !== null ? String(realValue) : '';
  };

  const handleNumericInputChange = (profile: Profile, field: keyof Profile, rawText: string, isInteger: boolean = false) => {
    const key = `${profile.id}_${String(field)}`;
    setNumericEditBuffers(prev => ({ ...prev, [key]: rawText }));

    if (rawText.trim() === '') {
      handleFieldChange(profile, field, undefined as any);
      return;
    }

    const parsed = isInteger ? parseInt(rawText, 10) : parseFloat(rawText);
    if (!isNaN(parsed)) {
      handleFieldChange(profile, field, parsed);
    }
  };

  const handleNumericInputBlur = (profileId: string, field: string) => {
    const key = `${profileId}_${field}`;
    setNumericEditBuffers(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Grouped headers toggle
  const [showGroupedHeaders, setShowGroupedHeaders] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('erp_profile_master_grouped_headers');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Custom columns state
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(() => {
    try {
      const saved = localStorage.getItem('erp_profile_master_custom_cols');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Hidden columns state
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('erp_profile_master_hidden_cols');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Modal / popover for adding custom column
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColInsertAfter, setNewColInsertAfter] = useState('name');

  // Columns visibility dropdown
  const [isColMenuOpen, setIsColMenuOpen] = useState(false);

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem('erp_profile_master_grouped_headers', JSON.stringify(showGroupedHeaders));
    } catch {}
  }, [showGroupedHeaders]);

  useEffect(() => {
    try {
      localStorage.setItem('erp_profile_master_custom_cols', JSON.stringify(customColumns));
    } catch {}
  }, [customColumns]);

  useEffect(() => {
    try {
      localStorage.setItem('erp_profile_master_hidden_cols', JSON.stringify(Array.from(hiddenCols)));
    } catch {}
  }, [hiddenCols]);

  // Standard column definition
  const standardCols = [
    { id: 'type', label: 'Type', group: 'basic', defaultWidth: 'w-14' },
    { id: 'sku', label: 'Code (SKU)', group: 'basic', defaultWidth: 'w-24' },
    { id: 'name', label: 'Description', group: 'basic', defaultWidth: 'min-w-[180px]' },
    { id: 'hsnCode', label: 'HSN', group: 'basic', defaultWidth: 'w-20' },
    { id: 'brand', label: 'Brand', group: 'basic', defaultWidth: 'w-24' },
    { id: 'uom', label: 'UOM', group: 'basic', defaultWidth: 'w-14' },
    { id: 'length', label: 'Each L. (m)', group: 'length', defaultWidth: 'w-20' },
    { id: 'piecesPerPacket', label: 'L/Pkt', group: 'length', defaultWidth: 'w-16' },
    { id: 'weight', label: 'Len Wt (kg)', group: 'weight', defaultWidth: 'w-20' },
    { id: 'meterWeight', label: 'Mtr Wt (kg/m)', group: 'weight', defaultWidth: 'w-24' },
    { id: 'topFilm', label: 'Top / Right Film', group: 'film', defaultWidth: 'min-w-[140px]' },
    { id: 'bottomFilm', label: 'Bottom / Left Film', group: 'film', defaultWidth: 'min-w-[140px]' },
    { id: 'reorderPoint', label: 'Min Stock', group: 'pricing', defaultWidth: 'w-20' },
    { id: 'price', label: 'Price (₹)', group: 'pricing', defaultWidth: 'w-24' },
  ];

  const isReinf = isReinforcementProfile;

  // Selected profile memo for ribbon status
  const selectedProfile = useMemo(() => profiles.find(p => p.id === selectedProfileId), [profiles, selectedProfileId]);

  // Active profiles and category breakdown
  const activeProfiles = useMemo(() => profiles.filter(p => !p.deletedAt), [profiles]);
  const windowCount = useMemo(() => activeProfiles.filter(p => !isReinf(p)).length, [activeProfiles]);
  const reinfCount = useMemo(() => activeProfiles.filter(p => isReinf(p)).length, [activeProfiles]);

  // Duplicate auditing for brand-wise SKU duplication
  const duplicateKeysCount = useMemo(() => {
    const seen = new Set<string>();
    let duplicates = 0;
    activeProfiles.forEach(p => {
      if (p.isMerged) return;
      const sku = (p.sku || '').trim().toLowerCase();
      const brand = (p.brand || 'General').trim().toLowerCase().replace(/[\s_-]/g, '');
      if (!sku) return;
      const key = `${sku}::${brand}`;
      if (seen.has(key)) duplicates++;
      else seen.add(key);
    });
    return duplicates;
  }, [activeProfiles]);

  // Filter profiles based on brand, typeFilter, and search term
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      if (p.deletedAt) return false;

      // Category Switcher:
      // WINDOW: uPVC Profiles strictly (Reinforcement removed)
      // REINFORCEMENT: Reinforcement only
      // All: Mix (Profiles + Reinforcement together)
      if (typeFilter === 'WINDOW') {
        if (isReinf(p)) return false;
        if (p.profileType && p.profileType !== 'WINDOW' && p.profileType !== 'DOOR') return false;
      } else if (typeFilter === 'REINFORCEMENT') {
        if (!isReinf(p)) return false;
      }

      // Brand Filter: if brand is REINFORCEMENT, match either brand or profileType
      const matchesBrand = selectedBrand === 'All' || 
        p.brand === selectedBrand || 
        p.isMerged ||
        isReinf(p); // Reinforcements are standard across all brands
      if (!matchesBrand) return false;

      if (!searchTerm) return true;
      const lower = searchTerm.toLowerCase();
      if (p.isMerged) {
        return (p.mergedText || '').toLowerCase().includes(lower);
      }
      return (
        (p.sku && p.sku.toLowerCase().includes(lower)) ||
        (p.name && p.name.toLowerCase().includes(lower)) ||
        (p.hsnCode && p.hsnCode.toLowerCase().includes(lower)) ||
        (p.brand && p.brand.toLowerCase().includes(lower)) ||
        (p.profileType && p.profileType.toLowerCase().includes(lower)) ||
        (p.topStickerName && p.topStickerName.toLowerCase().includes(lower)) ||
        (p.bottomStickerName && p.bottomStickerName.toLowerCase().includes(lower))
      );
    });
  }, [profiles, selectedBrand, searchTerm, typeFilter]);

  // Compute total visible columns count (including standard, custom, slNo, and action)
  const totalVisibleCols = useMemo(() => {
    let count = 1; // Sl.No
    standardCols.forEach(c => {
      if (!hiddenCols.has(c.id)) count++;
    });
    customColumns.forEach(c => {
      if (!hiddenCols.has(c.id)) count++;
    });
    count++; // Actions col
    return count;
  }, [hiddenCols, customColumns]);

  // Group col spans for two-tier header
  const getGroupColSpan = (group: string) => {
    let count = 0;
    if (group === 'basic') count++; // Sl.No included in basic
    standardCols.forEach(c => {
      if (c.group === group && !hiddenCols.has(c.id)) {
        count++;
        // Include custom columns inserted after this column
        const matchingCustom = customColumns.filter(cc => cc.insertAfter === c.id && !hiddenCols.has(cc.id));
        count += matchingCustom.length;
      }
    });
    if (group === 'pricing') count++; // Action col
    return count;
  };

  // Toggle column visibility
  const toggleCol = (colId: string) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  };

  // Add custom column
  const handleAddCustomColumn = () => {
    if (!newColName.trim()) {
      addToast('Please enter a column title', 'error');
      return;
    }
    const newCol: CustomColumn = {
      id: `col_${Date.now()}`,
      name: newColName.trim(),
      insertAfter: newColInsertAfter,
    };
    setCustomColumns(prev => [...prev, newCol]);
    setNewColName('');
    setIsAddColumnOpen(false);
    addToast(`Added custom column "${newCol.name}"`, 'success');
  };

  // Delete custom column
  const handleDeleteCustomColumn = (id: string) => {
    setCustomColumns(prev => prev.filter(c => c.id !== id));
    addToast('Removed custom column', 'info');
  };

  // Update profile field value
  const handleFieldChange = (profile: Profile, field: keyof Profile, value: any) => {
    const updated = { ...profile, [field]: value };
    if (profile.isMerged && field === 'mergedText') {
      updated.name = value;
    }
    // Auto-calculate meterWeight if length and weight are present
    if (field === 'length' || field === 'weight') {
      const l = field === 'length' ? parseFloat(value) : profile.length;
      const w = field === 'weight' ? parseFloat(value) : profile.weight;
      if (l && w && l > 0) {
        updated.meterWeight = parseFloat((w / l).toFixed(3));
      }
    }
    onUpdateProfile(updated);
  };

  // Update custom field value
  const handleCustomFieldChange = (profile: Profile, colId: string, value: string) => {
    const customFields = { ...(profile.customFields || {}), [colId]: value };
    onUpdateProfile({ ...profile, customFields });
  };

  // Toggle Merge & Center for a profile row
  const handleToggleMergeCenter = (profileId?: string | null) => {
    const targetId = profileId || selectedProfileId;
    if (!targetId) {
      handleQuickAddMergedRow();
      return;
    }
    const p = profiles.find(item => item.id === targetId);
    if (!p) {
      handleQuickAddMergedRow();
      return;
    }
    const isNowMerged = !p.isMerged;
    const isThisReinf = isReinf(p) || typeFilter === 'REINFORCEMENT';
    const updated: Profile = {
      ...p,
      isMerged: isNowMerged,
      profileType: isThisReinf ? 'REINFORCEMENT' : (p.profileType || 'WINDOW'),
      category: isThisReinf ? (p.category || 'GI Reinforcement') : (p.category || '80.5 SERIES'),
      brand: p.brand || (isThisReinf ? 'Reinforcement' : (selectedBrand !== 'All' ? selectedBrand : 'General')),
      mergedText: isNowMerged ? (p.mergedText || p.name || (isThisReinf ? 'REINFORCEMENT SECTION' : 'SECTION HEADING')) : undefined,
      mergedAlign: isNowMerged ? (p.mergedAlign || 'center') : undefined,
      mergedBg: isNowMerged ? (p.mergedBg || 'blue') : undefined,
    };
    onUpdateProfile(updated);
    setSelectedProfileId(updated.id);
    addToast(isNowMerged ? 'Row merged across full table!' : 'Row unmerged back to standard cells', 'info');

    // Auto-sync across brands if "All Brands" is selected (as requested)
    if (selectedBrand === 'All' && isThisReinf && onPushStandardCatalogueToAll) {
      setTimeout(() => {
        onPushStandardCatalogueToAll();
        addToast('Auto-synced structural changes across all brands', 'info');
      }, 1000);
    }
  };

  // Insert row above or below
  const handleInsertRow = (relativeProfileId: string | null, position: 'above' | 'below', isMerged: boolean = false) => {
    // 1. Identify if we are in reinforcement mode
    const relProfile = relativeProfileId ? profiles.find(p => p.id === relativeProfileId) : null;
    const isReinfMode = typeFilter === 'REINFORCEMENT' || 
      (relProfile ? isReinf(relProfile) : false) ||
      (selectedProfileId ? isReinf(profiles.find(p => p.id === selectedProfileId)) : false);

    // 2. Resolve relative target ID if none passed
    let effectiveRelativeId = relativeProfileId;
    if (!effectiveRelativeId && filteredProfiles.length > 0) {
      if (position === 'above') {
        effectiveRelativeId = filteredProfiles[0].id;
      } else {
        effectiveRelativeId = filteredProfiles[filteredProfiles.length - 1].id;
      }
    }

    // 3. Build data matching mode
    let newProfileData: Omit<Profile, 'id' | 'createdAt'>;
    const targetBrand = selectedBrand !== 'All' 
      ? selectedBrand 
      : (relProfile?.brand || (isReinfMode ? 'Reinforcement' : (brands[0] || 'General')));

    if (isReinfMode) {
      newProfileData = {
        sku: isMerged ? '' : `GI-${Date.now().toString().slice(-4)}`,
        name: isMerged ? 'REINFORCEMENT SECTION' : 'GALVANISED STEEL REINFORCEMENT',
        category: 'GI Reinforcement',
        profileType: 'REINFORCEMENT',
        uom: 'Pcs',
        length: 0,
        piecesPerPacket: 1,
        weight: 0.897,
        meterWeight: 0.897,
        price: 95,
        hsnCode: '72169910',
        brand: targetBrand,
        topFilmWidth: '',
        bottomFilmWidth: '',
        isMerged,
        mergedText: isMerged ? 'REINFORCEMENT SECTION' : undefined,
        mergedAlign: 'center',
        mergedBg: 'blue'
      };
    } else {
      newProfileData = {
        sku: isMerged ? '' : `NEW-${Date.now().toString().slice(-4)}`,
        name: isMerged ? 'SECTION HEADING' : 'New Profile',
        category: relProfile?.category || '80.5 SERIES',
        profileType: 'WINDOW',
        uom: 'Pcs',
        length: relProfile?.length || 5.8,
        piecesPerPacket: relProfile?.piecesPerPacket || 6,
        weight: relProfile?.weight || 5.2,
        meterWeight: relProfile?.meterWeight || 0.897,
        price: relProfile?.price || 150,
        hsnCode: relProfile?.hsnCode || '39162099',
        brand: targetBrand,
        topFilmWidth: relProfile?.topFilmWidth || '38',
        bottomFilmWidth: relProfile?.bottomFilmWidth || '38',
        isMerged,
        mergedText: isMerged ? 'SECTION HEADING' : undefined,
        mergedAlign: 'center',
        mergedBg: 'blue'
      };
    }

    let created: any;
    if (onInsertProfileAt) {
      created = onInsertProfileAt(newProfileData, effectiveRelativeId, position);
    } else {
      created = onAddProfile(newProfileData);
    }

    if (created && created.id) {
      setSelectedProfileId(created.id);
      
      // Auto-sync across brands if "All Brands" is selected and we added a reinforcement
      if (selectedBrand === 'All' && isReinfMode && onPushStandardCatalogueToAll) {
        setTimeout(() => {
          onPushStandardCatalogueToAll();
          addToast('Auto-synced new reinforcement across all brands', 'info');
        }, 1000);
      }
    }

    addToast(
      isMerged 
        ? `Inserted new Merged Heading row (${isReinfMode ? 'Reinforcement' : 'Profile'})` 
        : `Inserted row ${position} (${isReinfMode ? 'Reinforcement' : 'Profile'})`, 
      'success'
    );
  };

  // Duplicate row
  const handleDuplicateRow = (profile: Profile) => {
    const newProfileData: Omit<Profile, 'id' | 'createdAt'> = {
      ...profile,
      sku: profile.sku ? `${profile.sku}-COPY` : '',
      name: `${profile.name} (Copy)`
    };
    const created = onAddProfile(newProfileData);
    if (created && (created as any).id) {
      setSelectedProfileId((created as any).id);
    }
    addToast(`Duplicated "${profile.name}"`, 'success');
  };

  // Quick Add Profile Row
  const handleQuickAddRow = () => {
    handleInsertRow(null, 'below', false);
  };

  // Quick Add Merged Row
  const handleQuickAddMergedRow = () => {
    handleInsertRow(null, 'below', true);
  };

  // Export to Excel with custom columns, merged rows, and guaranteed reinforcements
  const handleExportExcel = () => {
    try {
      const headers = ['Sl No'];
      standardCols.forEach(c => {
        if (!hiddenCols.has(c.id)) {
          headers.push(c.label);
          customColumns.filter(cc => cc.insertAfter === c.id && !hiddenCols.has(cc.id)).forEach(cc => headers.push(cc.name));
        }
      });

      const rows: any[] = [];
      const merges: { s: { r: number, c: number }, e: { r: number, c: number } }[] = [];
      let slNo = 1;

      filteredProfiles.forEach((p) => {
        const rowIndex = rows.length + 1; // 1-indexed for header row at 0
        if (p.isMerged) {
          const mergedRow = [p.mergedText || 'MERGED SECTION'];
          // fill rest with empty
          for (let i = 1; i < headers.length; i++) mergedRow.push('');
          rows.push(mergedRow);
          merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: headers.length - 1 } });
        } else {
          const rowData: any[] = [p.isHidden ? '-' : slNo++];
          standardCols.forEach(c => {
            if (!hiddenCols.has(c.id)) {
              switch (c.id) {
                case 'type': rowData.push(p.profileType); break;
                case 'sku': rowData.push(p.sku); break;
                case 'name': rowData.push(p.name); break;
                case 'hsnCode': rowData.push(p.hsnCode || ''); break;
                case 'brand': rowData.push(p.brand); break;
                case 'uom': rowData.push(p.uom); break;
                case 'length': rowData.push(p.length || ''); break;
                case 'piecesPerPacket': rowData.push(p.piecesPerPacket || ''); break;
                case 'weight': rowData.push(p.weight || ''); break;
                case 'meterWeight': rowData.push(p.meterWeight || (p.weight && p.length ? (p.weight/p.length).toFixed(3) : '')); break;
                case 'topFilm': rowData.push(`${p.topFilmWidth || ''}mm ${p.topStickerName || ''}`.trim()); break;
                case 'bottomFilm': rowData.push(`${p.bottomFilmWidth || ''}mm ${p.bottomStickerName || ''}`.trim()); break;
                case 'reorderPoint': rowData.push(p.reorderPoint || 0); break;
                case 'price': rowData.push(p.price || 0); break;
              }
              // Insert custom column values
              customColumns.filter(cc => cc.insertAfter === c.id && !hiddenCols.has(cc.id)).forEach(cc => {
                rowData.push(p.customFields?.[cc.id] || '');
              });
            }
          });
          rows.push(rowData);
        }
      });

      if (typeFilter === 'REINFORCEMENT') {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws['!merges'] = merges;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reinforcements Catalogue');

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Reinforcements_Catalogue_${selectedBrand === 'All' ? 'Universal' : selectedBrand}_${dateStr}.xlsx`);
        addToast('Reinforcement catalogue exported to Excel successfully!', 'success');
        return;
      }

      // Guarantee standard reinforcements are never missing from the exported Excel file
      const alreadyHasReinf = filteredProfiles.some(p => !p.isMerged && isReinf(p));
      const universalReinfs = profiles.filter(p => !p.deletedAt && !p.isMerged && isReinf(p));

      if (!alreadyHasReinf && universalReinfs.length > 0) {
        const bannerRowIndex = rows.length + 1;
        const bannerRow = ['--- REINFORCEMENT PROFILES (UNIVERSAL SIZES FOR ALL BRANDS) ---'];
        for (let i = 1; i < headers.length; i++) bannerRow.push('');
        rows.push(bannerRow);
        merges.push({ s: { r: bannerRowIndex, c: 0 }, e: { r: bannerRowIndex, c: headers.length - 1 } });

        universalReinfs.forEach(p => {
          const rowData: any[] = [p.isHidden ? '-' : slNo++];
          standardCols.forEach(c => {
            if (!hiddenCols.has(c.id)) {
              switch (c.id) {
                case 'type': rowData.push(p.profileType || 'REINFORCEMENT'); break;
                case 'sku': rowData.push(p.sku); break;
                case 'name': rowData.push(p.name); break;
                case 'hsnCode': rowData.push(p.hsnCode || ''); break;
                case 'brand': rowData.push(p.brand || 'Reinforcement'); break;
                case 'uom': rowData.push(p.uom || 'MTR'); break;
                case 'length': rowData.push(p.length || ''); break;
                case 'piecesPerPacket': rowData.push(p.piecesPerPacket || ''); break;
                case 'weight': rowData.push(p.weight || ''); break;
                case 'meterWeight': rowData.push(p.meterWeight || (p.weight && p.length ? (p.weight/p.length).toFixed(3) : '')); break;
                case 'topFilm': rowData.push(`${p.topFilmWidth || ''}mm ${p.topStickerName || ''}`.trim()); break;
                case 'bottomFilm': rowData.push(`${p.bottomFilmWidth || ''}mm ${p.bottomStickerName || ''}`.trim()); break;
                case 'reorderPoint': rowData.push(p.reorderPoint || 0); break;
                case 'price': rowData.push(p.price || 0); break;
              }
              customColumns.filter(cc => cc.insertAfter === c.id && !hiddenCols.has(cc.id)).forEach(cc => {
                rowData.push(p.customFields?.[cc.id] || '');
              });
            }
          });
          rows.push(rowData);
        });
      }

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!merges'] = merges;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Profiles Master Catalogue');

      // Dedicated Sheet 2: Universal Reinforcements
      if (universalReinfs.length > 0) {
        const reinfHeaders = ['Sl No', 'Reinforcement SKU', 'Profile Description', 'Standard Length (m)', 'Meter Weight (kg/m)', 'Pieces / Packet', 'Min Stock'];
        let rSl = 1;
        const reinfRows = universalReinfs.map(p => [
          rSl++,
          p.sku || '',
          p.name || '',
          p.length || 5.9,
          p.meterWeight || (p.weight && p.length ? (p.weight/p.length).toFixed(3) : p.weight) || '',
          p.piecesPerPacket || 1,
          p.reorderPoint || 0
        ]);
        const reinfWs = XLSX.utils.aoa_to_sheet([reinfHeaders, ...reinfRows]);
        XLSX.utils.book_append_sheet(wb, reinfWs, 'Reinforcements (Universal)');
      }

      // Dedicated Sheet 3: Protective Films Master
      const activeWindowProfiles = profiles.filter(p => !p.deletedAt && !p.isMerged && !isReinf(p));
      if (activeWindowProfiles.length > 0) {
        const filmHeaders = ['Sl No', 'Profile SKU', 'Profile Name', 'Brand', 'Top Film Width (mm)', 'Top Sticker Name', 'Bottom Film Width (mm)', 'Bottom Sticker Name'];
        let fSl = 1;
        const filmRows = activeWindowProfiles.map(p => [
          fSl++,
          p.sku || '',
          p.name || '',
          p.brand || 'General',
          p.topFilmWidth || 38,
          p.topStickerName || `${p.brand || 'General'} Top Film`,
          p.bottomFilmWidth || 38,
          p.bottomStickerName || `${p.brand || 'General'} Bottom Film`
        ]);
        const filmWs = XLSX.utils.aoa_to_sheet([filmHeaders, ...filmRows]);
        XLSX.utils.book_append_sheet(wb, filmWs, 'Protective Films Master');
      }

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Profiles_Master_Catalogue_${selectedBrand}_${dateStr}.xlsx`);
      addToast('Spreadsheet exported to Excel successfully with all profiles, reinforcements, and protective films!', 'success');
    } catch (err: any) {
      console.error(err);
      addToast('Failed to export Excel file', 'error');
    }
  };

  // Helper to render custom column headers inserted after a given column
  const renderCustomHeaders = (afterCol: string) => {
    return customColumns
      .filter(c => c.insertAfter === afterCol && !hiddenCols.has(c.id))
      .map(c => (
        <th key={c.id} className="border-r border-black p-2 min-w-[110px] bg-sky-100 text-sky-950 font-black text-center group/th select-none">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate">{c.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteCustomColumn(c.id);
              }}
              className="no-print text-red-500 hover:text-red-700 opacity-0 group-hover/th:opacity-100 transition-opacity font-bold px-1"
              title="Delete this custom column"
            >
              ✕
            </button>
          </div>
        </th>
      ));
  };

  // Helper to render custom column data cells inserted after a given column
  const renderCustomDataCells = (profile: Profile, afterCol: string) => {
    return customColumns
      .filter(c => c.insertAfter === afterCol && !hiddenCols.has(c.id))
      .map(c => (
        <td key={c.id} className="border-r border-slate-300 p-0.5 bg-sky-50/30">
          <input
            type="text"
            value={profile.customFields?.[c.id] || ''}
            onChange={e => handleCustomFieldChange(profile, c.id, e.target.value)}
            placeholder="..."
            className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-sky-500 focus:bg-white px-1.5 py-1 text-center outline-none rounded font-medium text-[11px] text-slate-800"
          />
        </td>
      ));
  };

  let displaySlNo = 0;

  return (
    <div className="space-y-3">
      {/* QUICK CATEGORY FILTER & DEDUPLICATION AUDIT BAR */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-white dark:bg-slate-800 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-indigo-500" /> Category:
          </span>

          {/* 1. PROFILES (Default - Reinforcement removed) */}
          <button
            onClick={() => setTypeFilter('WINDOW')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1.5 cursor-pointer ${
              typeFilter === 'WINDOW'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-400/40'
                : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
            }`}
            title="Window & Door Profiles only (Reinforcement excluded)"
          >
            <Package className="w-3.5 h-3.5" />
            <span>Profiles</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${typeFilter === 'WINDOW' ? 'bg-white/20 text-white' : 'bg-blue-200/70 dark:bg-blue-800 text-blue-800 dark:text-blue-200'}`}>{windowCount}</span>
          </button>

          {/* 2. REINFORCEMENT */}
          <button
            onClick={() => setTypeFilter('REINFORCEMENT')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1.5 cursor-pointer ${
              typeFilter === 'REINFORCEMENT'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400/40'
                : 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800'
            }`}
            title="Galvanised Steel / GI Reinforcements only"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Reinforcement</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${typeFilter === 'REINFORCEMENT' ? 'bg-white/20 text-white' : 'bg-amber-200/70 dark:bg-amber-800 text-amber-800 dark:text-amber-200'}`}>{reinfCount}</span>
          </button>

          {/* 3. MIX (PROFILES + REINFORCEMENT) */}
          <button
            onClick={() => setTypeFilter('All')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1.5 cursor-pointer ${
              typeFilter === 'All'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30 ring-2 ring-purple-400/40'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
            title="Mix Profiles and Reinforcements together"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Mix (Profiles + Reinforcement)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${typeFilter === 'All' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'}`}>{activeProfiles.length}</span>
          </button>

          {/* Brand Filter Selector */}
          <div className="flex items-center gap-1 ml-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Brand:</span>
            <select
              value={selectedBrand}
              onChange={e => onBrandChange(e.target.value)}
              className="bg-transparent text-xs font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
            >
              <option value="All">All Brands</option>
              {brands.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right side: Search & Deduplication Clean Button */}
        <div className="flex items-center gap-2 flex-wrap">
          {duplicateKeysCount > 0 && onDeduplicateProfiles && (
            <button
              onClick={() => {
                if (confirm(`Detected ${duplicateKeysCount} duplicate profile entries (same SKU & Brand). Would you like to merge duplicates, reconcile stock, and delete redundant entries across all tabs?`)) {
                  onDeduplicateProfiles();
                }
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1.5 shadow-sm animate-pulse"
              title="Remove double-double profiles and merge stock/transactions"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Clean {duplicateKeysCount} Duplicates</span>
            </button>
          )}

          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search code, desc, film..."
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-xs rounded-xl font-medium outline-none border border-transparent focus:border-indigo-500 w-44 sm:w-56"
            />
            {searchTerm && (
              <button onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* EXCEL SPREADSHEET RIBBON TOOLBAR */}
      <div className="bg-slate-900 text-white rounded-2xl p-2.5 shadow-xl border border-slate-700/80 flex flex-wrap items-center justify-between gap-2.5">
        
        {/* Left Toolbar Group: Core Excel Operations */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-800/90 rounded-xl border border-slate-700">
            <Package className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-black tracking-wide text-white uppercase">Standard Catalogue</span>
          </div>

          <div className="h-5 w-px bg-slate-700 mx-0.5 hidden sm:block" />

          {/* Merge & Center Button */}
          <button
            onClick={() => {
              if (selectedProfileId) {
                handleToggleMergeCenter(selectedProfileId);
              } else {
                handleQuickAddMergedRow();
              }
            }}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
            title={selectedProfileId ? "Merge selected row across full width as a category banner" : "Add new full-width merged heading row"}
          >
            <span className="text-sm">🔀</span>
            <span>Merge & Center</span>
          </button>

          {/* + Row Above */}
          <button
            onClick={() => handleInsertRow(selectedProfileId, 'above', false)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1 border border-slate-700"
            title="Insert new profile row above selected"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            <span>Row Above</span>
          </button>

          {/* + Row Below */}
          <button
            onClick={() => handleInsertRow(selectedProfileId, 'below', false)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1 border border-slate-700"
            title="Insert new profile row below selected"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            <span>Row Below</span>
          </button>

          {/* + Merged Heading Row */}
          <button
            onClick={handleQuickAddMergedRow}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1 border border-slate-700"
            title="Add a full-width merged category/section header row"
          >
            <Layers className="w-3 h-3 text-amber-400" />
            <span>+ Merged Row</span>
          </button>

          {/* Active Row Selection Indicator */}
          {selectedProfile && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-950/90 border border-indigo-500/60 rounded-xl text-indigo-200 text-xs font-bold animate-in fade-in duration-150">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Target: <strong className="text-white">{selectedProfile.sku || selectedProfile.name || (selectedProfile.isMerged ? (selectedProfile.mergedText || 'Merged Heading') : 'Selected')}</strong></span>
              <button
                onClick={() => setSelectedProfileId(null)}
                className="ml-1 p-0.5 hover:bg-white/20 rounded text-slate-400 hover:text-white"
                title="Deselect active row"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* + Custom Column */}
          <div className="relative">
            <button
              onClick={() => setIsAddColumnOpen(prev => !prev)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1 border border-slate-700"
              title="Add a custom spreadsheet column to Profile Master"
            >
              <Columns className="w-3 h-3" />
              <span>+ Column</span>
            </button>

            {/* Custom Column Popover */}
            {isAddColumnOpen && (
              <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl shadow-2xl p-4 z-40 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Columns className="w-3.5 h-3.5 text-indigo-500" />
                    Add Custom Column
                  </h4>
                  <button onClick={() => setIsAddColumnOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Column Title</label>
                  <input
                    type="text"
                    value={newColName}
                    onChange={e => setNewColName(e.target.value)}
                    placeholder="e.g. Die No, Wall Thick, Anodize"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Insert After</label>
                  <select
                    value={newColInsertAfter}
                    onChange={e => setNewColInsertAfter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none font-bold"
                  >
                    <option value="sku">After Code (SKU)</option>
                    <option value="name">After Description</option>
                    <option value="hsnCode">After HSN</option>
                    <option value="brand">After Brand</option>
                    <option value="length">After Length</option>
                    <option value="piecesPerPacket">After L/Pkt</option>
                    <option value="meterWeight">After Meter Wt</option>
                    <option value="bottomFilm">After Film Specs</option>
                    <option value="price">At the end (After Price)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsAddColumnOpen(false)}
                    className="px-3 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCustomColumn}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase rounded-lg shadow-sm"
                  >
                    Insert Column
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Toolbar Group: View Controls, Export & Add Row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Two-Tier Group Headers Toggle */}
          <button
            onClick={() => setShowGroupedHeaders(prev => !prev)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1 border ${
              showGroupedHeaders 
                ? 'bg-indigo-950/70 text-indigo-300 border-indigo-700' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Toggle two-tier category grouping headers"
          >
            <span>Group Headers</span>
            <span className={`w-2 h-2 rounded-full ${showGroupedHeaders ? 'bg-indigo-400' : 'bg-slate-600'}`} />
          </button>

          {/* Hide/Show Columns Menu */}
          <div className="relative">
            <button
              onClick={() => setIsColMenuOpen(prev => !prev)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1 border border-slate-700"
              title="Show or hide table columns"
            >
              <Eye className="w-3 h-3 text-slate-400" />
              <span>Cols ({standardCols.length - hiddenCols.size + customColumns.length})</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {isColMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-2xl shadow-2xl p-3 z-40 border border-slate-200 dark:border-slate-700 max-h-80 overflow-y-auto space-y-1">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Column Visibility</span>
                  <button 
                    onClick={() => setHiddenCols(new Set())} 
                    className="text-[10px] text-indigo-600 font-bold hover:underline"
                  >
                    Show All
                  </button>
                </div>
                {standardCols.map(col => (
                  <label key={col.id} className="flex items-center justify-between px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded cursor-pointer">
                    <span className="font-semibold">{col.label}</span>
                    <input
                      type="checkbox"
                      checked={!hiddenCols.has(col.id)}
                      onChange={() => toggleCol(col.id)}
                      className="rounded accent-indigo-600"
                    />
                  </label>
                ))}
                {customColumns.length > 0 && (
                  <>
                    <div className="pt-2 pb-1 text-[9px] font-black uppercase tracking-wider text-sky-500 border-t border-slate-200 dark:border-slate-700">Custom Columns</div>
                    {customColumns.map(col => (
                      <label key={col.id} className="flex items-center justify-between px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded cursor-pointer">
                        <span className="font-semibold text-sky-600 dark:text-sky-300">{col.name}</span>
                        <input
                          type="checkbox"
                          checked={!hiddenCols.has(col.id)}
                          onChange={() => toggleCol(col.id)}
                          className="rounded accent-sky-500"
                        />
                      </label>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Push Data to All Brands & Protective Films */}
          <button
            onClick={() => {
              if (onPushStandardCatalogueToAll) {
                const res = onPushStandardCatalogueToAll(selectedBrand);
                addToast(`Standard Catalogue data pushed to all! Synced ${res.syncedProfiles} profile(s) across ${res.syncedBrands} brand(s) and ${res.syncedFilms} protective film(s).`, 'success');
              } else if (onSyncProfileSpecsBySku && selectedProfileId) {
                onSyncProfileSpecsBySku(selectedProfileId);
                addToast('Profile specs pushed to all brands sharing SKU!', 'success');
              } else {
                addToast('Standard Catalogue specs synced across brands.', 'info');
              }
            }}
            className="px-3 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-900/20"
            title="Push Standard Catalogue profiles, dimensions & protective film specs across all brands"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Push Data to All</span>
            <span className="sm:hidden">Push All</span>
          </button>

          {/* Upload Excel Button */}
          <button
            onClick={onUploadExcelClick}
            className={`px-3 py-1.5 text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer ${
              typeFilter === 'REINFORCEMENT'
                ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-900/20'
                : 'bg-emerald-700 hover:bg-emerald-600'
            }`}
            title={typeFilter === 'REINFORCEMENT' ? "Import Reinforcement Excel with Brand Selection (.xlsx/.csv)" : "Import Excel Catalogue with Brand Selection (.xlsx/.csv)"}
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {typeFilter === 'REINFORCEMENT' ? 'Import Reinforcement Excel' : 'Import Excel'}
            </span>
            <span className="md:hidden">Import</span>
          </button>

          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-1 border border-slate-700 cursor-pointer active:scale-95"
            title={typeFilter === 'REINFORCEMENT' ? "Export Reinforcement Catalogue to Excel (.xlsx)" : "Export Profile Master Catalogue with Reinforcements and Protective Films to Excel (.xlsx)"}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{typeFilter === 'REINFORCEMENT' ? 'Export Reinforcement Excel' : 'Export Excel'}</span>
            <span className="sm:hidden">Export</span>
          </button>

          {/* Quick Add Profile Row Button */}
          <button
            onClick={handleQuickAddRow}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black rounded-xl text-xs uppercase tracking-tight transition-all flex items-center gap-1 shadow-md shadow-emerald-500/20"
            title="Add a new empty profile row ready for immediate typing"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Row</span>
          </button>
        </div>
      </div>

      {/* SPREADSHEET TABLE GRID */}
      <div className="overflow-x-auto rounded-2xl border border-black dark:border-slate-700 shadow-md bg-white dark:bg-slate-900">
        <table className="w-full text-[10px] border-collapse border border-black text-center dark:border-slate-700">
          
          {/* TIER 1: GROUPED HEADERS (Excel Categories) */}
          {showGroupedHeaders && (
            <thead className="bg-slate-800 text-slate-200 text-[9px] uppercase font-black tracking-wider border-b border-black">
              <tr>
                <th colSpan={getGroupColSpan('basic')} className="border-r border-black py-1.5 px-3 bg-slate-800 text-slate-200 text-center">
                  1. Basic Identification & Code
                </th>
                <th colSpan={getGroupColSpan('length')} className="border-r border-black py-1.5 px-3 bg-indigo-950 text-indigo-200 text-center">
                  2. Length & Packet Count
                </th>
                <th colSpan={getGroupColSpan('weight')} className="border-r border-black py-1.5 px-3 bg-emerald-950 text-emerald-200 text-center">
                  3. Weight & Density
                </th>
                <th colSpan={getGroupColSpan('film')} className="border-r border-black py-1.5 px-3 bg-blue-950 text-blue-200 text-center">
                  4. Protective Films & Stickers
                </th>
                <th colSpan={getGroupColSpan('pricing')} className="py-1.5 px-3 bg-amber-950 text-amber-200 text-center">
                  5. Stock & Price Matrix
                </th>
              </tr>
            </thead>
          )}

          {/* TIER 2: DETAILED COLUMN HEADERS */}
          <thead className="bg-[#0f172a] text-white uppercase font-black tracking-tight text-[9px] border-b-2 border-black sticky top-0 z-20">
            <tr>
              {/* Sl.No */}
              <th className="border-r border-black p-2 w-10 text-center select-none bg-slate-900">#</th>

              {/* Type */}
              {!hiddenCols.has('type') && (
                <th className="border-r border-black p-2 w-16 text-center select-none">TYPE</th>
              )}
              {renderCustomHeaders('type')}

              {/* SKU */}
              {!hiddenCols.has('sku') && (
                <th className="border-r border-black p-2 w-24 text-center select-none">CODE (SKU)</th>
              )}
              {renderCustomHeaders('sku')}

              {/* Description / Name */}
              {!hiddenCols.has('name') && (
                <th className="border-r border-black p-2 min-w-[200px] text-left px-3 select-none">DESCRIPTION / PROFILE NAME</th>
              )}
              {renderCustomHeaders('name')}

              {/* HSN */}
              {!hiddenCols.has('hsnCode') && (
                <th className="border-r border-black p-2 w-18 text-center select-none">HSN</th>
              )}
              {renderCustomHeaders('hsnCode')}

              {/* Brand */}
              {!hiddenCols.has('brand') && (
                <th className="border-r border-black p-2 w-24 text-center select-none">BRAND</th>
              )}
              {renderCustomHeaders('brand')}

              {/* UOM */}
              {!hiddenCols.has('uom') && (
                <th className="border-r border-black p-2 w-14 text-center select-none">UOM</th>
              )}
              {renderCustomHeaders('uom')}

              {/* Length */}
              {!hiddenCols.has('length') && (
                <th className="border-r border-black p-2 w-20 text-center bg-indigo-900/80 text-indigo-100 select-none">EACH L. (M)</th>
              )}
              {renderCustomHeaders('length')}

              {/* Pcs/Pkt */}
              {!hiddenCols.has('piecesPerPacket') && (
                <th className="border-r border-black p-2 w-16 text-center bg-indigo-900/80 text-indigo-100 select-none">L/PKT</th>
              )}
              {renderCustomHeaders('piecesPerPacket')}

              {/* Weight */}
              {!hiddenCols.has('weight') && (
                <th className="border-r border-black p-2 w-20 text-center bg-emerald-900/80 text-emerald-100 select-none">LEN WT (KG)</th>
              )}
              {renderCustomHeaders('weight')}

              {/* Meter Weight */}
              {!hiddenCols.has('meterWeight') && (
                <th className="border-r border-black p-2 w-24 text-center bg-emerald-900/80 text-emerald-100 select-none">MTR WT (KG/M)</th>
              )}
              {renderCustomHeaders('meterWeight')}

              {/* Top Film */}
              {!hiddenCols.has('topFilm') && (
                <th className="border-r border-black p-2 min-w-[140px] bg-blue-900/80 text-blue-100 select-none">TOP / RIGHT FILM</th>
              )}
              {renderCustomHeaders('topFilm')}

              {/* Bottom Film */}
              {!hiddenCols.has('bottomFilm') && (
                <th className="border-r border-black p-2 min-w-[140px] bg-blue-950 text-blue-100 select-none">BOTTOM / LEFT FILM</th>
              )}
              {renderCustomHeaders('bottomFilm')}

              {/* Min Stock */}
              {!hiddenCols.has('reorderPoint') && (
                <th className="border-r border-black p-2 w-20 text-center text-red-200 select-none">MIN STOCK</th>
              )}
              {renderCustomHeaders('reorderPoint')}

              {/* Price */}
              {!hiddenCols.has('price') && (
                <th className="border-r border-black p-2 w-24 text-center bg-amber-900/80 text-amber-100 select-none">PRICE / PC (₹)</th>
              )}
              {renderCustomHeaders('price')}

              {/* Actions */}
              <th className="p-2 w-24 no-print text-center select-none bg-slate-900">ACTIONS</th>
            </tr>
          </thead>

          {/* TABLE BODY */}
          <tbody className="divide-y divide-black dark:divide-slate-700 bg-white dark:bg-slate-900 font-sans">
            {filteredProfiles.map((p) => {
              const isSelected = selectedProfileId === p.id;
              if (!p.isHidden && !p.isMerged) displaySlNo++;

              // CASE A: MERGED & CENTERED ROW (BANNER / CATEGORY HEADING)
              if (p.isMerged) {
                const bgMap = {
                  gray: 'bg-slate-100 text-slate-900 border-slate-300',
                  yellow: 'bg-amber-100 text-amber-950 border-amber-300',
                  blue: 'bg-indigo-100 text-indigo-950 border-indigo-300',
                  green: 'bg-emerald-100 text-emerald-950 border-emerald-300',
                  white: 'bg-white text-slate-900 border-slate-300',
                };
                const bgClass = bgMap[(p.mergedBg as any) || 'blue'];
                const alignClass = p.mergedAlign === 'left' ? 'text-left pl-4' : p.mergedAlign === 'right' ? 'text-right pr-4' : 'text-center';

                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedProfileId(p.id)}
                    className={`border-b-2 border-black group transition-all cursor-pointer ${
                      isSelected ? 'ring-2 ring-indigo-500 ring-inset shadow-md' : 'hover:brightness-95'
                    } ${p.isHidden ? 'opacity-40 bg-slate-200' : ''}`}
                  >
                    <td colSpan={totalVisibleCols - 1} className={`p-2.5 ${bgClass} border-r border-black transition-all`}>
                      <div className={`flex items-center gap-3 ${alignClass}`}>
                        <span className="no-print text-[10px] font-black text-indigo-700 bg-white/90 px-2.5 py-1 rounded shadow-sm border border-indigo-200 uppercase tracking-widest flex items-center gap-1">
                          <span>🔀</span>
                          <span>MERGED SECTION</span>
                        </span>
                        <select
                          value={p.brand || brands[0] || 'Scraft'}
                          onChange={e => handleFieldChange(p, 'brand', e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="no-print bg-white/90 border border-indigo-200 rounded px-2 py-1 text-[11px] font-black uppercase text-indigo-900 outline-none shadow-xs"
                        >
                          {brands.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={p.mergedText || ''}
                          onChange={e => handleFieldChange(p, 'mergedText', e.target.value)}
                          placeholder="Type section name (e.g. 60MM SLIDING SYSTEM, REINFORCEMENTS)..."
                          className={`flex-1 bg-transparent border-b border-transparent hover:border-slate-400 focus:border-indigo-600 outline-none font-black text-xs md:text-sm px-2 py-1 uppercase tracking-wide transition-all ${alignClass}`}
                        />
                        <div className="no-print flex items-center gap-1 opacity-90 group-hover:opacity-100">
                          {/* Unmerge button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleMergeCenter(p.id);
                            }}
                            className="text-[9px] font-black uppercase bg-white text-slate-700 hover:text-indigo-600 border border-slate-300 px-2 py-1 rounded shadow-xs"
                            title="Split back into standard profile cells"
                          >
                            Unmerge
                          </button>
                          {/* Alignment buttons */}
                          <div className="flex items-center bg-white/80 rounded border border-slate-300 p-0.5">
                            {(['left', 'center', 'right'] as const).map(align => (
                              <button
                                key={align}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFieldChange(p, 'mergedAlign', align);
                                }}
                                className={`px-1.5 py-0.5 text-[8px] font-black uppercase rounded ${
                                  (p.mergedAlign || 'center') === align ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {align[0].toUpperCase()}
                              </button>
                            ))}
                          </div>
                          {/* Color picker */}
                          <div className="flex items-center gap-1 bg-white/80 p-1 rounded border border-slate-300">
                            {(['blue', 'yellow', 'green', 'gray', 'white'] as const).map(color => (
                              <button
                                key={color}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFieldChange(p, 'mergedBg', color);
                                }}
                                className={`w-3 h-3 rounded-full border border-slate-400 ${
                                  color === 'gray' ? 'bg-slate-300' : color === 'yellow' ? 'bg-amber-300' : color === 'blue' ? 'bg-indigo-400' : color === 'green' ? 'bg-emerald-400' : 'bg-white'
                                } ${(p.mergedBg || 'blue') === color ? 'scale-125 ring-1 ring-black' : ''}`}
                                title={`Theme: ${color}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Merged Row Action Column */}
                    <td className="no-print border-black p-1 text-center bg-slate-100 dark:bg-slate-800">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInsertRow(p.id, 'above', false);
                          }}
                          className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                          title="Insert profile row above"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInsertRow(p.id, 'below', false);
                          }}
                          className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                          title="Insert profile row below"
                        >
                          <Plus className="w-3.5 h-3.5 rotate-90" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFieldChange(p, 'isHidden', !p.isHidden);
                          }}
                          className={`p-1 transition-all ${p.isHidden ? 'text-red-500' : 'text-slate-400 hover:text-slate-800'}`}
                          title={p.isHidden ? "Show Section" : "Hide Section"}
                        >
                          {p.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProfile(p.id);
                          }}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all"
                          title="Delete Section Row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              // CASE B: STANDARD PROFILE DATA ROW
              return (
                <tr
                  key={p.id}
                  onClick={() => setSelectedProfileId(p.id)}
                  className={`border-b border-black group cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-blue-100/70 ring-1 ring-blue-500 ring-inset' 
                      : 'hover:bg-blue-50/40 dark:hover:bg-slate-800/60'
                  } ${p.isHidden ? 'opacity-40 line-through bg-slate-100' : ''}`}
                >
                  {/* Sl.No */}
                  <td className="border-r border-black p-1 font-mono font-bold text-slate-500 text-center select-none w-10">
                    {p.isHidden ? '-' : displaySlNo}
                  </td>

                  {/* Profile Type */}
                  {!hiddenCols.has('type') && (
                    <td className="border-r border-black p-0.5">
                      <select
                        value={p.profileType || 'WINDOW'}
                        onChange={e => handleFieldChange(p, 'profileType', e.target.value)}
                        className={`w-full bg-transparent text-[9px] font-black text-center py-1 outline-none rounded border border-transparent hover:border-slate-300 focus:bg-white ${
                          p.profileType === 'REINFORCEMENT' ? 'text-orange-700 dark:text-orange-400' : 'text-blue-700 dark:text-blue-400'
                        }`}
                      >
                        <option value="WINDOW">WIN</option>
                        <option value="REINFORCEMENT">REINF</option>
                        <option value="DOOR">DOOR</option>
                        <option value="OTHER">OTHER</option>
                      </select>
                    </td>
                  )}
                  {renderCustomDataCells(p, 'type')}

                  {/* SKU / Code */}
                  {!hiddenCols.has('sku') && (
                    <td className="border-r border-black p-0.5">
                      <input
                        type="text"
                        value={p.sku || ''}
                        onChange={e => handleFieldChange(p, 'sku', e.target.value)}
                        className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-600 focus:bg-white px-1.5 py-1 text-center font-mono font-black text-[10px] uppercase outline-none rounded text-slate-900 dark:text-slate-100"
                        placeholder="SKU"
                      />
                    </td>
                  )}
                  {renderCustomDataCells(p, 'sku')}

                  {/* Description / Name */}
                  {!hiddenCols.has('name') && (
                    <td className="border-r border-black p-0.5 text-left">
                      <input
                        type="text"
                        value={p.name || ''}
                        onChange={e => handleFieldChange(p, 'name', e.target.value)}
                        className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-600 focus:bg-white px-2 py-1 font-bold text-[10px] uppercase outline-none rounded text-slate-800 dark:text-slate-100"
                        placeholder="Profile Description"
                      />
                    </td>
                  )}
                  {renderCustomDataCells(p, 'name')}

                  {/* HSN */}
                  {!hiddenCols.has('hsnCode') && (
                    <td className="border-r border-black p-0.5">
                      <input
                        type="text"
                        value={p.hsnCode || ''}
                        onChange={e => handleFieldChange(p, 'hsnCode', e.target.value)}
                        className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-600 focus:bg-white px-1 py-1 text-center font-mono text-[10px] outline-none rounded text-slate-700 dark:text-slate-200"
                        placeholder="HSN"
                      />
                    </td>
                  )}
                  {renderCustomDataCells(p, 'hsnCode')}

                  {/* Brand */}
                  {!hiddenCols.has('brand') && (
                    <td className="border-r border-black p-0.5">
                      <select
                        value={p.brand || ''}
                        onChange={e => handleFieldChange(p, 'brand', e.target.value)}
                        className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-600 focus:bg-white px-1 py-1 text-center font-black text-[9px] uppercase outline-none rounded"
                      >
                        {brands.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {renderCustomDataCells(p, 'brand')}

                  {/* UOM */}
                  {!hiddenCols.has('uom') && (
                    <td className="border-r border-black p-0.5">
                      <input
                        type="text"
                        value={p.uom || 'Pcs'}
                        onChange={e => handleFieldChange(p, 'uom', e.target.value)}
                        className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-indigo-600 focus:bg-white px-1 py-1 text-center font-bold text-[9px] uppercase outline-none rounded"
                      />
                    </td>
                  )}
                  {renderCustomDataCells(p, 'uom')}

                  {/* Each Length (Length in meters) */}
                  {!hiddenCols.has('length') && (
                    <td className="border-r border-black p-0.5 bg-indigo-50/20">
                      <input
                        type="text"
                        value={getNumericDisplayValue(p.id, 'length', p.length)}
                        onChange={e => handleNumericInputChange(p, 'length', e.target.value, false)}
                        onBlur={() => handleNumericInputBlur(p.id, 'length')}
                        className="w-full bg-transparent hover:bg-white border border-transparent hover:border-indigo-300 focus:border-indigo-600 focus:bg-white px-1 py-1 text-center font-mono font-bold text-[10px] outline-none rounded text-indigo-950 dark:text-indigo-200"
                        placeholder="5.8"
                      />
                    </td>
                  )}
                  {renderCustomDataCells(p, 'length')}

                  {/* Pieces per packet (L/Pkt) */}
                  {!hiddenCols.has('piecesPerPacket') && (
                    <td className="border-r border-black p-0.5 bg-indigo-50/20">
                      <input
                        type="text"
                        value={getNumericDisplayValue(p.id, 'piecesPerPacket', p.piecesPerPacket)}
                        onChange={e => handleNumericInputChange(p, 'piecesPerPacket', e.target.value, true)}
                        onBlur={() => handleNumericInputBlur(p.id, 'piecesPerPacket')}
                        className="w-full bg-transparent hover:bg-white border border-transparent hover:border-indigo-300 focus:border-indigo-600 focus:bg-white px-1 py-1 text-center font-mono font-bold text-[10px] outline-none rounded text-indigo-950 dark:text-indigo-200"
                        placeholder="10"
                      />
                    </td>
                  )}
                  {renderCustomDataCells(p, 'piecesPerPacket')}

                  {/* Length Weight */}
                  {!hiddenCols.has('weight') && (
                    <td className="border-r border-black p-0.5 bg-emerald-50/20">
                      <input
                        type="text"
                        value={getNumericDisplayValue(p.id, 'weight', p.weight)}
                        onChange={e => handleNumericInputChange(p, 'weight', e.target.value, false)}
                        onBlur={() => handleNumericInputBlur(p.id, 'weight')}
                        className="w-full bg-transparent hover:bg-white border border-transparent hover:border-emerald-300 focus:border-emerald-600 focus:bg-white px-1 py-1 text-center font-mono font-bold text-[10px] outline-none rounded text-emerald-950 dark:text-emerald-200"
                        placeholder="5.2"
                      />
                    </td>
                  )}
                  {renderCustomDataCells(p, 'weight')}

                  {/* Meter Weight (Auto-calculated or editable) */}
                  {!hiddenCols.has('meterWeight') && (
                    <td className="border-r border-black p-0.5 bg-emerald-50/20">
                      <input
                        type="text"
                        value={getNumericDisplayValue(p.id, 'meterWeight', p.meterWeight !== undefined ? p.meterWeight : (p.weight && p.length ? parseFloat((p.weight / p.length).toFixed(3)) : ''))}
                        onChange={e => handleNumericInputChange(p, 'meterWeight', e.target.value, false)}
                        onBlur={() => handleNumericInputBlur(p.id, 'meterWeight')}
                        className="w-full bg-transparent hover:bg-white border border-transparent hover:border-emerald-300 focus:border-emerald-600 focus:bg-white px-1 py-1 text-center font-mono font-bold text-[10px] outline-none rounded text-emerald-900 dark:text-emerald-300"
                        placeholder="0.897"
                      />
                    </td>
                  )}
                  {renderCustomDataCells(p, 'meterWeight')}

                  {/* TOP / RIGHT FILM */}
                  {!hiddenCols.has('topFilm') && (
                    <td className="border-r border-black p-1 bg-blue-50/20">
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] text-gray-500 font-bold">W:</span>
                        <input
                          type="text"
                          value={p.topFilmWidth || ''}
                          onChange={e => handleFieldChange(p, 'topFilmWidth', e.target.value)}
                          className="w-10 bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white text-center text-[9px] font-mono font-bold outline-none rounded"
                          placeholder="38"
                        />
                        <input
                          type="text"
                          value={p.topStickerName || ''}
                          onChange={e => handleFieldChange(p, 'topStickerName', e.target.value)}
                          className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white px-1 text-[9px] outline-none rounded"
                          placeholder="Top Sticker"
                        />
                      </div>
                    </td>
                  )}
                  {renderCustomDataCells(p, 'topFilm')}

                  {/* BOTTOM / LEFT FILM */}
                  {!hiddenCols.has('bottomFilm') && (
                    <td className="border-r border-black p-1 bg-blue-50/20">
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] text-gray-500 font-bold">W:</span>
                        <input
                          type="text"
                          value={p.bottomFilmWidth || ''}
                          onChange={e => handleFieldChange(p, 'bottomFilmWidth', e.target.value)}
                          className="w-10 bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white text-center text-[9px] font-mono font-bold outline-none rounded"
                          placeholder="38"
                        />
                        <input
                          type="text"
                          value={p.bottomStickerName || ''}
                          onChange={e => handleFieldChange(p, 'bottomStickerName', e.target.value)}
                          className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white px-1 text-[9px] outline-none rounded"
                          placeholder="Bottom Sticker"
                        />
                      </div>
                    </td>
                  )}
                  {renderCustomDataCells(p, 'bottomFilm')}

                  {/* Min Stock (Reorder Point) */}
                  {!hiddenCols.has('reorderPoint') && (
                    <td className="border-r border-black p-0.5">
                      <input
                        type="text"
                        value={getNumericDisplayValue(p.id, 'reorderPoint', p.reorderPoint)}
                        onChange={e => handleNumericInputChange(p, 'reorderPoint', e.target.value, true)}
                        onBlur={() => handleNumericInputBlur(p.id, 'reorderPoint')}
                        className="w-full bg-transparent hover:bg-white border border-transparent hover:border-slate-300 focus:border-red-500 focus:bg-white px-1 py-1 text-center font-mono font-bold text-[10px] text-red-600 outline-none rounded"
                        placeholder="0"
                      />
                    </td>
                  )}
                  {renderCustomDataCells(p, 'reorderPoint')}

                  {/* Price */}
                  {!hiddenCols.has('price') && (
                    <td className="border-r border-black p-0.5 bg-amber-50/20">
                      <input
                        type="text"
                        value={getNumericDisplayValue(p.id, 'price', p.price)}
                        onChange={e => handleNumericInputChange(p, 'price', e.target.value, false)}
                        onBlur={() => handleNumericInputBlur(p.id, 'price')}
                        className="w-full bg-transparent hover:bg-white border border-transparent hover:border-amber-300 focus:border-amber-600 focus:bg-white px-1 py-1 text-center font-mono font-black text-[10px] text-amber-700 dark:text-amber-400 outline-none rounded"
                        placeholder="0.00"
                      />
                    </td>
                  )}
                  {renderCustomDataCells(p, 'price')}

                  {/* Action Column */}
                  <td className="p-1 no-print text-center bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center justify-center gap-1">
                      {/* Merge Row Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMergeCenter(p.id);
                        }}
                        className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-all font-bold text-[10px]"
                        title="Merge row across all columns into a category banner"
                      >
                        🔀
                      </button>

                      {/* Insert Row Above */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInsertRow(p.id, 'above', false);
                        }}
                        className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                        title="Insert row above"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      {/* Insert Row Below */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInsertRow(p.id, 'below', false);
                        }}
                        className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                        title="Insert row below"
                      >
                        <Plus className="w-3.5 h-3.5 rotate-90" />
                      </button>

                      {/* Duplicate Row */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateRow(p);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                        title="Duplicate this profile row"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Hide / Show */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFieldChange(p, 'isHidden', !p.isHidden);
                        }}
                        className={`p-1 transition-all ${p.isHidden ? 'text-red-500' : 'text-slate-400 hover:text-slate-800'}`}
                        title={p.isHidden ? "Show Row" : "Hide Row"}
                      >
                        {p.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>

                      {/* Edit Profile */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onEditProfile) {
                            onEditProfile(p);
                          } else {
                            setSelectedProfileId(p.id);
                          }
                        }}
                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-all"
                        title="Edit Profile in Modal / Comprehensive form"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Push Specs to All Brands */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Push ${p.sku} specifications to all other brands? This will sync Name, Length, Weight, Pcs/Pkt, and Protective Film settings for all brands having SKU ${p.sku}.`)) {
                            onSyncProfileSpecsBySku?.(p.id);
                            addToast(`Synchronized ${p.sku} specifications across all brands!`, 'success');
                          }
                        }}
                        className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-all"
                        title="Push these specifications (Film, Weight, etc.) to all other brands with the same SKU"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTargetProfile(p);
                        }}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all"
                        title="Delete Profile (Everywhere or Trash)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredProfiles.length === 0 && (
              <tr>
                <td colSpan={totalVisibleCols} className="p-10 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Package className="w-10 h-10 stroke-1 text-slate-300" />
                    <p className="text-xs font-bold uppercase tracking-wider">No profiles found in catalogue.</p>
                    <button
                      onClick={handleQuickAddRow}
                      className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-500 transition-all shadow-sm"
                    >
                      + Add First Profile Row
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* QUICK STATUS BAR (EXCEL STYLE FOOTER) */}
      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span>Total Profiles: <strong className="text-slate-900 dark:text-white font-mono">{filteredProfiles.filter(p => !p.isMerged).length}</strong></span>
          <span>•</span>
          <span>Merged Headings: <strong className="text-indigo-600 font-mono">{filteredProfiles.filter(p => p.isMerged).length}</strong></span>
          <span>•</span>
          <span>Brand Filter: <strong className="text-slate-900 dark:text-white">{selectedBrand}</strong></span>
          {customColumns.length > 0 && (
            <>
              <span>•</span>
              <span className="text-sky-600">Custom Columns: <strong className="font-mono">{customColumns.length}</strong></span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">⚡ Changes are auto-saved directly into master catalogue</span>
        </div>
      </div>

      {/* DELETE EVERYWHERE CONFIRMATION MODAL */}
      {deleteTargetProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6 space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-black uppercase tracking-tight">Delete Profile Options</h3>
              </div>
              <button
                onClick={() => setDeleteTargetProfile(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="font-black text-sm text-slate-900 dark:text-white">{deleteTargetProfile.name}</div>
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                <span>SKU: <strong className="text-indigo-600 dark:text-indigo-400">{deleteTargetProfile.sku}</strong></span>
                <span>Brand: <strong>{deleteTargetProfile.brand || 'General'}</strong></span>
                <span>Type: <strong>{deleteTargetProfile.profileType || 'WINDOW'}</strong></span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Choose how you want to remove this profile. Selecting <strong>Delete Everywhere</strong> immediately purges this item from Profiles, Stock balances, Quotations, Protective Films, Data Plan sheets, Dies, and Scrap logs so it is not seen anywhere.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  const id = deleteTargetProfile.id;
                  const sku = deleteTargetProfile.sku;
                  if (onPermanentlyDeleteProfile) {
                    onPermanentlyDeleteProfile(id);
                  } else {
                    onDeleteProfile(id);
                  }
                  addToast(`Profile "${sku}" removed everywhere (Stock, Quotes, Films, Data Plan, Dies).`, 'success');
                  setDeleteTargetProfile(null);
                }}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Everywhere (Purge From All Tabs)</span>
              </button>

              <button
                onClick={() => {
                  const id = deleteTargetProfile.id;
                  const sku = deleteTargetProfile.sku;
                  onDeleteProfile(id);
                  addToast(`Profile "${sku}" moved to trash.`, 'info');
                  setDeleteTargetProfile(null);
                }}
                className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <span>Move to Trash (Soft Delete)</span>
              </button>

              <button
                onClick={() => setDeleteTargetProfile(null)}
                className="w-full py-1.5 text-center text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
