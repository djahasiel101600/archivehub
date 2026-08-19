import React from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { getLocationAncestors } from '../../utils/locationUtils';
import { 
  Building2, 
  Layers, 
  DoorClosed, 
  Grid, 
  Archive, 
  Server, 
  Columns, 
  Box, 
  Folder, 
  MapPin,
  ChevronRight
} from 'lucide-react';
import { LocationType } from '../../types';

interface LocationPathBreadcrumbsProps {
  locationId: string | null;
  onNodeClick?: (locationId: string) => void;
  showIcon?: boolean;
  className?: string;
  badgeSize?: 'sm' | 'md';
}

export const LocationPathBreadcrumbs: React.FC<LocationPathBreadcrumbsProps> = ({
  locationId,
  onNodeClick,
  showIcon = true,
  className = '',
  badgeSize = 'md'
}) => {
  const { locations } = useArchive();
  
  if (!locationId) {
    return <span className="text-slate-400 italic text-sm">Unassigned Storage</span>;
  }

  const pathNodes = getLocationAncestors(locations, locationId);

  if (pathNodes.length === 0) {
    return <span className="text-slate-400 italic text-sm">Unknown Location ({locationId})</span>;
  }

  const renderIcon = (type: LocationType) => {
    const iconClass = badgeSize === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
    switch (type) {
      case 'BUILDING': return <Building2 className={`${iconClass} text-indigo-600 dark:text-indigo-400`} />;
      case 'FLOOR': return <Layers className={`${iconClass} text-sky-600 dark:text-sky-400`} />;
      case 'ROOM': return <DoorClosed className={`${iconClass} text-cyan-600 dark:text-cyan-400`} />;
      case 'STORAGE_AREA': return <Grid className={`${iconClass} text-teal-600 dark:text-teal-400`} />;
      case 'CABINET': return <Archive className={`${iconClass} text-emerald-600 dark:text-emerald-400`} />;
      case 'RACK': return <Server className={`${iconClass} text-amber-600 dark:text-amber-400`} />;
      case 'SHELF': return <Columns className={`${iconClass} text-orange-600 dark:text-orange-400`} />;
      case 'BOX': return <Box className={`${iconClass} text-blue-600 dark:text-blue-400`} />;
      case 'FOLDER': return <Folder className={`${iconClass} text-purple-600 dark:text-purple-400`} />;
      default: return <MapPin className={`${iconClass} text-slate-600 dark:text-slate-400`} />;
    }
  };

  return (
    <nav className={`flex flex-wrap items-center gap-1.5 ${className}`} aria-label="Physical Storage Location Breadcrumb">
      {pathNodes.map((node, index) => {
        const isLast = index === pathNodes.length - 1;

        return (
          <React.Fragment key={node.id}>
            {index > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            )}
            <button
              type="button"
              onClick={() => onNodeClick && onNodeClick(node.id)}
              disabled={!onNodeClick}
              className={`inline-flex items-center gap-1.5 rounded-lg transition-colors ${
                badgeSize === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium'
              } ${
                isLast
                  ? 'bg-indigo-50 text-indigo-950 font-semibold border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
              } ${onNodeClick ? 'cursor-pointer' : 'cursor-default'}`}
              title={`${node.type}: ${node.name} (${node.code})`}
            >
              {showIcon && renderIcon(node.type)}
              <span className="truncate max-w-[180px]">{node.name}</span>
              <span className="text-[10px] uppercase font-mono opacity-60">[{node.code}]</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
};
