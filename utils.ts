import { Profile } from './types';

/**
 * Robustly identifies if a profile is a reinforcement item based on various indicators
 */
export const isReinforcementProfile = (p?: Partial<Profile> | null): boolean => {
    if (!p) return false;
    
    // 1. Explicit type check
    const pt = (p.profileType || '').trim().toUpperCase();
    if (pt === 'REINFORCEMENT') return true;
    
    // 2. Brand check
    const b = (p.brand || '').trim().toUpperCase();
    if (b === 'REINFORCEMENT' || b === 'GI' || b === 'STEEL') return true;
    
    // 3. Category check
    const cat = (p.category || '').trim().toUpperCase();
    if (
        cat.includes('REINFORC') || 
        cat.includes('STEEL') || 
        cat.includes('GI') || 
        cat.includes('GALVANIS') || 
        cat.includes('GALVANIZ')
    ) return true;
    
    // 4. Name check
    const name = (p.name || '').trim().toUpperCase();
    if (
        name.includes('REINFORC') || 
        name.includes('GALVANIS') || 
        name.includes('GALVANIZ') || 
        name.includes('STEEL') || 
        name.startsWith('GI ') || 
        name.includes(' GI ') || 
        name.includes('GI-') || 
        name.includes('GI REINF') || 
        name.includes('STEEL REINF')
    ) return true;
    
    // 5. SKU/Code check
    const sku = (p.sku || '').trim().toUpperCase();
    if (
        sku.startsWith('REINF') || 
        sku.startsWith('GI-') || 
        sku.startsWith('STEEL-') || 
        /\b\d+X\d+(?:X\d+)?\b/i.test(sku)
    ) return true;
    
    // 6. HSN Code check
    if (p.hsnCode && (p.hsnCode.startsWith('7216') || p.hsnCode === '72169910')) return true;
    
    return false;
};
