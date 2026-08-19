import { LocationItem, DocumentItem } from '../types';

/**
 * Calculates the complete hierarchical location path string.
 * e.g., "Administration Building → Records Room 01 → Cabinet C-03 → Shelf S-02 → Box B-017 → Folder F-2026-003"
 */
export function calculateLocationPath(locations: LocationItem[], locationId: string | null): string {
  if (!locationId) return 'Unassigned Storage';
  
  const ancestors = getLocationAncestors(locations, locationId);
  if (ancestors.length === 0) return 'Unknown Location';
  
  return ancestors.map(loc => loc.name).join(' → ');
}

/**
 * Resolves array of location items from Root down to target Location ID.
 */
export function getLocationAncestors(locations: LocationItem[], targetId: string | null): LocationItem[] {
  if (!targetId) return [];
  
  const map = new Map<string, LocationItem>();
  locations.forEach(loc => map.set(loc.id, loc));
  
  const path: LocationItem[] = [];
  let current = map.get(targetId);
  const visited = new Set<string>();
  
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current); // Prepend to build root-to-leaf order
    if (current.parentId) {
      current = map.get(current.parentId);
    } else {
      current = undefined;
    }
  }
  
  return path;
}

/**
 * Get direct child locations of a given parentId (or root locations if parentId is null).
 */
export function getChildrenLocations(locations: LocationItem[], parentId: string | null): LocationItem[] {
  return locations.filter(loc => loc.parentId === parentId);
}

/**
 * Recursively find all descendant location IDs under a location.
 */
export function getAllDescendantIds(locations: LocationItem[], parentId: string): string[] {
  const result: string[] = [parentId];
  const children = getChildrenLocations(locations, parentId);
  
  for (const child of children) {
    result.push(...getAllDescendantIds(locations, child.id));
  }
  
  return Array.from(new Set(result));
}

/**
 * Get documents currently located or homed in a specific location or any of its descendants.
 */
export function getDocumentsInLocation(
  documents: DocumentItem[], 
  locations: LocationItem[], 
  locationId: string, 
  mode: 'current' | 'home' | 'both' = 'current'
): DocumentItem[] {
  const allIds = getAllDescendantIds(locations, locationId);
  const idSet = new Set(allIds);
  
  return documents.filter(doc => {
    if (mode === 'current') return idSet.has(doc.currentLocationId);
    if (mode === 'home') return idSet.has(doc.homeLocationId);
    return idSet.has(doc.currentLocationId) || idSet.has(doc.homeLocationId);
  });
}

export function getLocationIconName(type: LocationItem['type']): string {
  switch (type) {
    case 'BUILDING': return 'Building2';
    case 'FLOOR': return 'Layers';
    case 'ROOM': return 'DoorClosed';
    case 'STORAGE_AREA': return 'Grid';
    case 'CABINET': return 'Archive';
    case 'RACK': return 'Server';
    case 'SHELF': return 'Columns';
    case 'BOX': return 'Box';
    case 'FOLDER': return 'Folder';
    default: return 'MapPin';
  }
}
