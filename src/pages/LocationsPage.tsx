import React, { useState, useEffect } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { LocationPathBreadcrumbs } from '../components/common/LocationPathBreadcrumbs';
import { QRBarcodeModal } from '../components/common/QRBarcodeModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { StatusBadge } from '../components/common/StatusBadge';
import { getLocationImage, DEFAULT_TYPE_IMAGES } from '../utils/locationImages';
import { PhotoUploader } from '../components/common/PhotoUploader';
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
  Plus, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  QrCode, 
  FileText, 
  Trash2, 
  Edit, 
  PlusCircle,
  X,
  ArrowRight,
  ArrowLeft,
  Network,
  Camera,
  Image as ImageIcon,
  Link as LinkIcon
} from 'lucide-react';
import { LocationItem, LocationType } from '../types';
import { getChildrenLocations, getDocumentsInLocation } from '../utils/locationUtils';

interface LocationsPageProps {
  onSelectDocument: (docId: string) => void;
  openCreateModalDirectly?: boolean;
  onClearTrigger?: () => void;
}

export const LocationsPage: React.FC<LocationsPageProps> = ({ 
  onSelectDocument, 
  openCreateModalDirectly,
  onClearTrigger 
}) => {
  const { locations, documents, addLocation, updateLocation, deleteLocation, calculatePath } = useArchive();
  
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(locations[0]?.id || null);
  const [mobileView, setMobileView] = useState<'tree' | 'details'>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set(['loc-bld-admin', 'loc-flr-02', 'loc-rm-rr01', 'loc-cab-c03', 'loc-shf-s02', 'loc-box-b017']));
  
  // Modals & Editing photo state
  const [showCreateModal, setShowCreateModal] = useState(Boolean(openCreateModalDirectly));
  const [editingPhotoModal, setEditingPhotoModal] = useState(false);
  const [photoInputUrl, setPhotoInputUrl] = useState('');

  useEffect(() => {
    if (openCreateModalDirectly) {
      setShowCreateModal(true);
      if (onClearTrigger) {
        onClearTrigger();
      }
    }
  }, [openCreateModalDirectly, onClearTrigger]);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  
  // Form fields
  const [newLocName, setNewLocName] = useState('');
  const [newLocType, setNewLocType] = useState<LocationType>('BOX');
  const [newLocCode, setNewLocCode] = useState('');
  const [newLocCapacity, setNewLocCapacity] = useState(20);
  const [newLocDesc, setNewLocDesc] = useState('');
  const [newLocImageUrl, setNewLocImageUrl] = useState('');

  // QR Modal & Delete Confirm State
  const [qrModalItem, setQrModalItem] = useState<LocationItem | null>(null);
  const [deletingLocItem, setDeletingLocItem] = useState<LocationItem | null>(null);

  // Edit Location Details State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<LocationType>('BOX');
  const [editCode, setEditCode] = useState('');
  const [editCapacity, setEditCapacity] = useState<number>(20);
  const [editDescription, setEditDescription] = useState('');
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [editImageUrl, setEditImageUrl] = useState('');

  const handleOpenEditModal = (loc: LocationItem) => {
    setEditingLocation(loc);
    setEditName(loc.name || '');
    setEditType(loc.type || 'BOX');
    setEditCode(loc.code || '');
    setEditCapacity(loc.capacity || 20);
    setEditDescription(loc.description || '');
    setEditParentId(loc.parentId || null);
    setEditImageUrl(loc.imageUrl || '');
    setShowEditModal(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation || !editName.trim()) return;

    updateLocation(editingLocation.id, {
      name: editName.trim(),
      type: editType,
      code: editCode.trim().toUpperCase() || editingLocation.code,
      capacity: Number(editCapacity) || 20,
      description: editDescription.trim(),
      parentId: editParentId,
      imageUrl: editImageUrl.trim() || undefined
    });

    setShowEditModal(false);
    setEditingLocation(null);
  };

  // Helper to prevent circular parent choices
  const getValidParentOptions = (currentLocId: string, allLocations: LocationItem[]) => {
    const getDescendantIds = (id: string): string[] => {
      const children = allLocations.filter(l => l.parentId === id);
      return [id, ...children.flatMap(c => getDescendantIds(c.id))];
    };
    const invalidIds = new Set(getDescendantIds(currentLocId));
    return allLocations.filter(l => !invalidIds.has(l.id));
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim()) return;

    addLocation({
      parentId: createParentId,
      name: newLocName.trim(),
      type: newLocType,
      code: newLocCode.trim().toUpperCase() || `${newLocType.substring(0, 3)}-${Math.floor(100 + Math.random() * 900)}`,
      capacity: Number(newLocCapacity) || 20,
      description: newLocDesc.trim(),
      imageUrl: newLocImageUrl.trim() || undefined
    });

    // Reset & close
    setNewLocName('');
    setNewLocCode('');
    setNewLocDesc('');
    setNewLocImageUrl('');
    setShowCreateModal(false);
  };

  // Filter root locations
  const rootLocations = getChildrenLocations(locations, null);
  const selectedLoc = locations.find(l => l.id === selectedLocationId);
  const selectedDocs = selectedLocationId ? getDocumentsInLocation(documents, locations, selectedLocationId, 'both') : [];

  const renderIcon = (type: LocationType) => {
    switch (type) {
      case 'BUILDING': return <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'FLOOR': return <Layers className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
      case 'ROOM': return <DoorClosed className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
      case 'STORAGE_AREA': return <Grid className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      case 'CABINET': return <Archive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'RACK': return <Server className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'SHELF': return <Columns className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
      case 'BOX': return <Box className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'FOLDER': return <Folder className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      default: return <MapPin className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (loc: LocationItem, depth = 0) => {
    const children = getChildrenLocations(locations, loc.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodeIds.has(loc.id);
    const isSelected = selectedLocationId === loc.id;

    // Filter by search query if present
    if (searchQuery.trim()) {
      const matchSelf = loc.name.toLowerCase().includes(searchQuery.toLowerCase()) || loc.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchChild = children.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.code.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchSelf && !matchChild) return null;
    }

    return (
      <div key={loc.id} className="select-none">
        <div
          onClick={() => {
            setSelectedLocationId(loc.id);
            setMobileView('details');
          }}
          style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
          className={`flex items-center justify-between pr-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
            isSelected
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'hover:bg-slate-100 text-slate-800 dark:text-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(loc.id, e)}
                className={`p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 ${isSelected ? 'text-white' : 'text-slate-400'}`}
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {renderIcon(loc.type)}
            <span className="font-semibold truncate max-w-[180px]">{loc.name}</span>
            <span className={`text-[10px] font-mono uppercase opacity-70 ${isSelected ? 'text-white' : 'text-slate-400'}`}>
              [{loc.code}]
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {loc.capacity && (
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}>
                Cap: {loc.capacity}
              </span>
            )}
          </div>
        </div>

        {/* Children Nodes */}
        {hasChildren && isExpanded && (
          <div className="mt-0.5 space-y-0.5">
            {children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Physical Storage Location Hierarchy
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            PRD Mandate: Building → Floor → Room → Storage Area → Cabinet → Rack → Shelf → Box → Folder
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateParentId(selectedLocationId);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Child Storage Unit
        </button>
      </div>

      {/* Mobile View Toggle Switcher (< lg) */}
      <div className="flex lg:hidden bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
        <button
          type="button"
          onClick={() => setMobileView('tree')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-[42px] ${
            mobileView === 'tree'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Network className="w-4 h-4" />
          <span>Storage Tree ({locations.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileView('details')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-[42px] ${
            mobileView === 'details'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Unit Details {selectedLoc ? `(${selectedLoc.code})` : ''}</span>
        </button>
      </div>

      {/* Main Split Grid: Storage Tree Explorer (Left) & Node Contents Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Tree Explorer Column (5 cols) */}
        <div className={`lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4 max-h-[80vh] flex flex-col ${
          mobileView === 'tree' ? 'flex' : 'hidden lg:flex'
        }`}>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                Hierarchy Tree
              </span>
              <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">
                {locations.length} Nodes
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter locations (Name, Code)..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/40">
            {rootLocations.map(root => renderTreeNode(root, 0))}
          </div>

        </div>

        {/* Right Inspector Column (7 cols) */}
        <div className={`lg:col-span-7 space-y-6 ${
          mobileView === 'details' ? 'block' : 'hidden lg:block'
        }`}>
          {/* Mobile Back to Tree Button (< lg) */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setMobileView('tree')}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold mb-2 transition-colors min-h-[40px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Storage Tree</span>
            </button>
          </div>

          {selectedLoc ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-sm space-y-6">
              
              {/* Storage Unit Picture Hero Card */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm group">
                <div className="h-48 sm:h-56 w-full relative bg-slate-900">
                  <img
                    src={getLocationImage(selectedLoc)}
                    alt={selectedLoc.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
                  
                  {/* Photo Badges Over Image */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2.5 py-1 text-[10px] font-mono font-extrabold uppercase bg-indigo-600/90 backdrop-blur-md text-white rounded-lg shadow-md border border-indigo-400/30">
                      {selectedLoc.type}
                    </span>
                    <span className="px-2.5 py-1 text-[10px] font-mono font-bold bg-slate-900/80 backdrop-blur-md text-slate-200 rounded-lg border border-slate-700">
                      CODE: {selectedLoc.code}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(selectedLoc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600/90 hover:bg-indigo-600 backdrop-blur-md text-white rounded-xl border border-indigo-400/30 shadow-lg transition-all"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit Details
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPhotoInputUrl(selectedLoc.imageUrl || '');
                        setEditingPhotoModal(true);
                      }}
                      className="absolute top-3 right-3 sm:static inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900/80 hover:bg-slate-900 backdrop-blur-md text-white rounded-xl border border-slate-700 shadow-lg transition-all"
                    >
                      <Camera className="w-3.5 h-3.5 text-indigo-400" />
                      Change Photo
                    </button>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <h2 className="text-xl sm:text-2xl font-black drop-shadow-md">
                      {selectedLoc.name}
                    </h2>
                    {selectedLoc.description && (
                      <p className="text-xs text-slate-200/90 mt-1 line-clamp-2 drop-shadow">
                        {selectedLoc.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Max Capacity: <strong className="text-slate-800 dark:text-slate-200">{selectedLoc.capacity || 'N/A'} items</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(selectedLoc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 rounded-xl border border-indigo-200 dark:border-indigo-800/80 transition-colors"
                  >
                    <Edit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Edit Storage Details
                  </button>

                  <button
                    type="button"
                    onClick={() => setQrModalItem(selectedLoc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    <QrCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Print Tag / Barcode
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingLocItem(selectedLoc)}
                    className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                    title="Delete location node"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Full Hierarchy Breadcrumb Path */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Complete Physical Location Path:
                </span>
                <LocationPathBreadcrumbs
                  locationId={selectedLoc.id}
                  onNodeClick={(id) => setSelectedLocationId(id)}
                />
              </div>

              {/* Child Sub-Units Section with Visual Photo Thumbnails */}
              {(() => {
                const childUnits = getChildrenLocations(locations, selectedLoc.id);
                return (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        Direct Storage Sub-Units ({childUnits.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateParentId(selectedLoc.id);
                          setShowCreateModal(true);
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Sub-Unit
                      </button>
                    </div>

                    {childUnits.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-center border border-slate-200/60 dark:border-slate-800">
                        No child storage sub-units under this container.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {childUnits.map(child => (
                          <div
                            key={child.id}
                            onClick={() => setSelectedLocationId(child.id)}
                            className="p-2.5 bg-slate-50 hover:bg-indigo-50/70 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-2xl border border-slate-200/80 dark:border-slate-700 cursor-pointer transition-all flex items-center justify-between gap-3 group shadow-2xs"
                          >
                            <div className="flex items-center gap-3 truncate">
                              <img
                                src={getLocationImage(child)}
                                alt={child.name}
                                referrerPolicy="no-referrer"
                                className="w-12 h-12 object-cover rounded-xl border border-slate-200 dark:border-slate-700 flex-shrink-0 group-hover:scale-105 transition-transform"
                              />
                              <div className="truncate">
                                <span className="block font-bold text-xs text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                  {child.name}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                    {child.type}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    {child.code}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditModal(child);
                                }}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/80 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                title="Edit sub-unit details"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Contained Physical Documents Section */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">
                    Contained Records & Documents ({selectedDocs.length})
                  </h4>
                  <span className="text-xs text-slate-400">
                    Calculated for node & all sub-containers
                  </span>
                </div>

                {selectedDocs.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      No physical documents currently assigned to this storage container.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {selectedDocs.map(doc => (
                      <div
                        key={doc.id}
                        onClick={() => onSelectDocument(doc.id)}
                        className="p-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-xl border border-slate-200/80 dark:border-slate-700 cursor-pointer transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                #{doc.documentNumber}
                              </span>
                              <StatusBadge type="status" value={doc.status} size="sm" />
                            </div>
                            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate mt-0.5">
                              {doc.title}
                            </p>
                          </div>
                        </div>

                        <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Select a physical location from the tree hierarchy to inspect its details.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Create New Storage Location Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100">
                  Add New Storage Container / Unit
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Parent Storage Unit (Parent Hierarchy)
                </label>
                <select
                  value={createParentId || ''}
                  onChange={(e) => setCreateParentId(e.target.value || null)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                >
                  <option value="">[ROOT LEVEL BUILDING / WAREHOUSE]</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      [{loc.type}] {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Container Level / Type *
                  </label>
                  <select
                    value={newLocType}
                    onChange={(e) => setNewLocType(e.target.value as LocationType)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-semibold"
                  >
                    <option value="BUILDING">Building</option>
                    <option value="FLOOR">Floor</option>
                    <option value="ROOM">Room / Vault</option>
                    <option value="STORAGE_AREA">Storage Area</option>
                    <option value="CABINET">Cabinet</option>
                    <option value="RACK">Rack System</option>
                    <option value="SHELF">Shelf</option>
                    <option value="BOX">Archive Box</option>
                    <option value="FOLDER">Folder Dossier</option>
                    <option value="OTHER">Other Facility Desk</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Storage Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={newLocCode}
                    onChange={(e) => setNewLocCode(e.target.value)}
                    placeholder="e.g. CAB-04, BOX-020"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Container Name *
                </label>
                <input
                  type="text"
                  required
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  placeholder="e.g. Fireproof Cabinet C-04, Box B-020"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Maximum Holding Capacity
                </label>
                <input
                  type="number"
                  min={1}
                  value={newLocCapacity}
                  onChange={(e) => setNewLocCapacity(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Storage Notes
                </label>
                <textarea
                  value={newLocDesc}
                  onChange={(e) => setNewLocDesc(e.target.value)}
                  rows={2}
                  placeholder="Additional storage specifications or handling notes..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none resize-none"
                />
              </div>

              <PhotoUploader
                value={newLocImageUrl}
                onChange={setNewLocImageUrl}
                label="Storage Container Photo (Optional)"
                presets={[
                  { label: 'Vault Room', url: DEFAULT_TYPE_IMAGES.ROOM },
                  { label: 'Steel Cabinet', url: DEFAULT_TYPE_IMAGES.CABINET },
                  { label: 'Box Shelves', url: DEFAULT_TYPE_IMAGES.SHELF },
                  { label: 'HQ Building', url: DEFAULT_TYPE_IMAGES.BUILDING }
                ]}
              />

              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold shadow-md shadow-indigo-600/20"
                >
                  Create Storage Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Storage Photo Modal */}
      {editingPhotoModal && selectedLoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Update Storage Location Picture
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPhotoModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload or link a photo for <strong>{selectedLoc.name}</strong> to help personnel physically identify this vault, cabinet, or box.
              </p>

              <PhotoUploader
                value={photoInputUrl}
                onChange={setPhotoInputUrl}
                label="Storage Location Photo"
                presets={[
                  { label: 'Vault Room', url: DEFAULT_TYPE_IMAGES.ROOM },
                  { label: 'Steel Cabinet', url: DEFAULT_TYPE_IMAGES.CABINET },
                  { label: 'Box Shelves', url: DEFAULT_TYPE_IMAGES.SHELF },
                  { label: 'HQ Building', url: DEFAULT_TYPE_IMAGES.BUILDING }
                ]}
              />
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setEditingPhotoModal(false)}
                className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  updateLocation(selectedLoc.id, { imageUrl: photoInputUrl.trim() || undefined });
                  setEditingPhotoModal(false);
                }}
                className="px-5 py-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold shadow-md shadow-indigo-600/20"
              >
                Save Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Printable Modal */}
      {qrModalItem && (
        <QRBarcodeModal
          isOpen={Boolean(qrModalItem)}
          onClose={() => setQrModalItem(null)}
          title={qrModalItem.name}
          subtitle={`Type: ${qrModalItem.type} | Code: ${qrModalItem.code}`}
          qrValue={qrModalItem.qrCode}
          barcodeValue={qrModalItem.barcode}
          entityType="LOCATION"
          entityCode={qrModalItem.code}
          pathString={calculatePath(qrModalItem.id)}
        />
      )}

      {/* Edit Storage Node Details Modal */}
      {showEditModal && editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Edit Storage Unit Details
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Update storage name, classification, parent location, or capacity
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Parent Storage Unit (Location Hierarchy)
                  </label>
                  <select
                    value={editParentId || ''}
                    onChange={(e) => setEditParentId(e.target.value ? e.target.value : null)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium text-slate-900 dark:text-slate-100"
                  >
                    <option value="">[None / Root Level Facility]</option>
                    {getValidParentOptions(editingLocation.id, locations).map(loc => (
                      <option key={loc.id} value={loc.id}>
                        [{loc.type}] {loc.name} ({calculatePath(loc.id)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Container Type / Classification *
                    </label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as LocationType)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-semibold text-slate-900 dark:text-slate-100"
                    >
                      <option value="BUILDING">Building</option>
                      <option value="FLOOR">Floor</option>
                      <option value="ROOM">Room / Vault</option>
                      <option value="STORAGE_AREA">Storage Area</option>
                      <option value="CABINET">Cabinet</option>
                      <option value="RACK">Rack System</option>
                      <option value="SHELF">Shelf</option>
                      <option value="BOX">Archive Box</option>
                      <option value="FOLDER">Folder Dossier</option>
                      <option value="OTHER">Other Facility Desk</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Storage Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={editCode || ''}
                      onChange={(e) => setEditCode(e.target.value)}
                      placeholder="e.g. CAB-04, BOX-020"
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-mono uppercase font-bold text-indigo-600 dark:text-indigo-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Physical Storage Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName || ''}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Main Vault Room 01, Cabinet C-03"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-medium text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Max Holding Capacity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editCapacity ?? ''}
                    onChange={(e) => setEditCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description / Storage Notes
                  </label>
                  <textarea
                    value={editDescription || ''}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    placeholder="Storage room conditions, physical security keys, handling instructions..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none resize-none"
                  />
                </div>

                <PhotoUploader
                  value={editImageUrl || ''}
                  onChange={setEditImageUrl}
                  label="Storage Container Photo"
                  presets={[
                    { label: 'Vault Room', url: DEFAULT_TYPE_IMAGES.ROOM },
                    { label: 'Steel Cabinet', url: DEFAULT_TYPE_IMAGES.CABINET },
                    { label: 'Box Shelves', url: DEFAULT_TYPE_IMAGES.SHELF },
                    { label: 'HQ Building', url: DEFAULT_TYPE_IMAGES.BUILDING }
                  ]}
                />
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold shadow-md shadow-indigo-600/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Location Node Confirm Modal */}
      {deletingLocItem && (
        <ConfirmModal
          isOpen={Boolean(deletingLocItem)}
          onClose={() => setDeletingLocItem(null)}
          onConfirm={() => {
            deleteLocation(deletingLocItem.id);
            setDeletingLocItem(null);
          }}
          title="Delete Physical Storage Node"
          message={`Are you sure you want to delete physical storage unit "${deletingLocItem.name}" (${deletingLocItem.code})? Note: Storage nodes containing sub-units or documents cannot be removed until emptied.`}
          confirmText="Delete Storage Unit"
          variant="danger"
        />
      )}

    </div>
  );
};
