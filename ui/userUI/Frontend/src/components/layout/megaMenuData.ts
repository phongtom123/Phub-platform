export interface MenuCategory { id: string; label: string; count?: number; children?: readonly MenuCategory[] }
// Menu taxonomy and products now come from catalog metadata. No static records.
