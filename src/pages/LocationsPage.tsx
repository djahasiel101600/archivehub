import React, { useState, useEffect } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { LocationPathBreadcrumbs } from '../components/common/LocationPathBreadcrumbs';
import { QRBarcodeModal } from '../components/common/QRBarcodeModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { StatusBadge } from '../components/common/StatusBadge';
import { PageHeader } from '../components/common/PageHeader';
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
  Link as LinkIcon,
  LocateFixed,
  Loader2
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
  const { locations, documents, addLocation, updateLocation, deleteLocation, calculatePath, addNotification } = useArchive();
  
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
  const [newLocLatitude, setNewLocLatitude] = useState('');
  const [newLocLongitude, setNewLocLongitude] = useState('');
  const [capturingGps, setCapturingGps] = useState<'create' | 'edit' | null>(null);

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
  const [editLatitude, setEditLatitude] = useState('');
  const [editLongitude, setEditLongitude] = useState('');

  const parseCoord = (v: string): number | null => {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };

  const captureGps = (target: 'create' | 'edit') => {
    if (!navigator.geolocation) {
      addNotification('warning', 'Geolocation is not supported by this browser.');
      return;
    }
    setCapturingGps(target);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        if (target === 'create') {
          setNewLocLatitude(lat);
          setNewLocLongitude(lng);
        } else {
          setEditLatitude(lat);
          setEditLongitude(lng);
        }
        setCapturingGps(null);
        addNotification('success', 'GPS position captured.');
      },
      () => {
        addNotification('error', 'Unable to retrieve GPS position. Check location permissions.');
        setCapturingGps(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Hover preview for storage unit images
  const [imagePreview, setImagePreview] = useState<{ src: string; title: string; x: number; y: number } | null>(null);

  const PREVIEW_WIDTH = 288;
  const PREVIEW_HEIGHT = 320;

  const showImagePreview = (e: React.MouseEvent<HTMLElement>, src: string, title: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let x = rect.right + 12;
    if (x + PREVIEW_WIDTH > window.innerWidth - 8) {
      x = rect.left - PREVIEW_WIDTH - 12;
    }
    if (x < 8) x = 8;
    let y = rect.top + rect.height / 2 - PREVIEW_HEIGHT / 2;
    y = Math.max(8, Math.min(y, window.innerHeight - PREVIEW_HEIGHT - 8));
    setImagePreview({ src, title, x, y });
  };

  const hideImagePreview = () => setImagePreview(null);

  const handleOpenEditModal = (loc: LocationItem) => {
    setEditingLocation(loc);
    setEditName(loc.name || '');
    setEditType(loc.type || 'BOX');
    setEditCode(loc.code || '');
    setEditCapacity(loc.capacity || 20);
    setEditDescription(loc.description || '');
    setEditParentId(loc.parentId || null);
    setEditImageUrl(loc.imageUrl || '');
    setEditLatitude(loc.latitude != null ? String(loc.latitude) : '');
    setEditLongitude(loc.longitude != null ? String(loc.longitude) : '');
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
      imageUrl: editImageUrl.trim() || undefined,
      latitude: parseCoord(editLatitude),
      longitude: parseCoord(editLongitude)
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
      imageUrl: newLocImageUrl.trim() || undefined,
      latitude: parseCoord(newLocLatitude),
      longitude: parseCoord(newLocLongitude)
    });

    // Reset & close
    setNewLocName('');
    setNewLocCode('');
    setNewLocDesc('');
    setNewLocImageUrl('');
    setNewLocLatitude('');
    setNewLocLongitude('');
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
      default: return <MapPin className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />;
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
          className={`flex items-center justify-between pr-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
            isSelected
              ? 'bg-teal-600 text-white'
              : 'hover:bg-zinc-100 text-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800'
          }`}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(loc.id, e)}
                className={`p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 ${isSelected ? 'text-white' : 'text-zinc-400'}`}
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {renderIcon(loc.type)}
            <span className="font-semibold truncate max-w-[180px]">{loc.name}</span>
            <span className={`text-[10px] font-mono uppercase opacity-70 ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
              [{loc.code}]
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {loc.capacity && (
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                isSelected ? 'bg-teal-700 text-white' : 'bg-zinc-200/80 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
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
      
      <PageHeader
        icon={Building2}
        title="Locations"
        description="Browse the storage hierarchy and manage archive locations."
        actions={
          <button
            type="button"
            onClick={() => {
              setCreateParentId(selectedLocationId);
              setShowCreateModal(true);
            }}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add location
          </button>
        }
      />

      {/* Mobile View Toggle Switcher (< lg) */}
      <div className="flex lg:hidden bg-zinc-100 dark:bg-zinc-800/90 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700/80">
        <button
          type="button"
          onClick={() => setMobileView('tree')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-[42px] ${
            mobileView === 'tree'
              ? 'bg-white dark:bg-zinc-900 text-teal-600 dark:text-teal-400 shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
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
              ? 'bg-white dark:bg-zinc-900 text-teal-600 dark:text-teal-400 shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Unit Details {selectedLoc ? `(${selectedLoc.code})` : ''}</span>
        </button>
      </div>

      {/* Main Split Grid: Storage Tree Explorer (Left) & Node Contents Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Tree Explorer Column (5 cols) */}
        <div className={`lg:col-span-5 card p-4 sm:p-5 space-y-4 max-h-[80vh] flex flex-col ${
          mobileView === 'tree' ? 'flex' : 'hidden lg:flex'
        }`}>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="section-title">
                Hierarchy tree
              </span>
              <span className="chip bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {locations.length} nodes
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter locations (name, code)..."
                aria-label="Filter locations"
                className="input pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-1 divide-y divide-zinc-100 dark:divide-zinc-800/40">
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
              className="btn btn-secondary btn-sm mb-2"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back to storage tree</span>
            </button>
          </div>

          {selectedLoc ? (
            <div className="card p-4 sm:p-6 space-y-6">
              
              {/* Storage Unit Picture Hero Card */}
              <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 group">
                <div className="h-48 sm:h-56 w-full relative bg-zinc-900">
                  <img
                    src={getLocationImage(selectedLoc)}
                    alt={selectedLoc.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/40 to-transparent" />
                  
                  {/* Photo Badges Over Image */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="chip bg-teal-600/90 text-white font-mono uppercase">
                      {selectedLoc.type}
                    </span>
                    <span className="chip bg-zinc-900/80 text-zinc-200 font-mono">
                      {selectedLoc.code}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoInputUrl(selectedLoc.imageUrl || '');
                        setEditingPhotoModal(true);
                      }}
                      className="btn btn-xs bg-zinc-900/80 hover:bg-zinc-900 text-white border border-zinc-700"
                    >
                      <Camera className="w-3.5 h-3.5 text-teal-400" aria-hidden="true" />
                      Change photo
                    </button>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight drop-shadow-md">
                      {selectedLoc.name}
                    </h2>
                    {selectedLoc.description && (
                      <p className="text-xs text-zinc-200/90 mt-1 line-clamp-2 drop-shadow">
                        {selectedLoc.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Max Capacity: <strong className="text-zinc-800 dark:text-zinc-200">{selectedLoc.capacity || 'N/A'} items</strong>
                  </span>
                  {selectedLoc.latitude != null && selectedLoc.longitude != null && (
                    <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <strong className="text-zinc-800 dark:text-zinc-200 font-mono">
                        {selectedLoc.latitude.toFixed(5)}, {selectedLoc.longitude.toFixed(5)}
                      </strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(selectedLoc)}
                    className="btn btn-secondary btn-sm"
                  >
                    <Edit className="w-4 h-4" aria-hidden="true" />
                    Edit details
                  </button>

                  <button
                    type="button"
                    onClick={() => setQrModalItem(selectedLoc)}
                    className="btn btn-secondary btn-sm"
                  >
                    <QrCode className="w-4 h-4" aria-hidden="true" />
                    Print tag / barcode
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingLocItem(selectedLoc)}
                    className="btn btn-danger-outline btn-icon btn-sm"
                    title="Delete location node"
                    aria-label="Delete location node"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Full Hierarchy Breadcrumb Path */}
              <div>
                <span className="meta block mb-1">
                  Complete physical location path
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
                      <h4 className="section-title flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                        Direct sub-units ({childUnits.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateParentId(selectedLoc.id);
                          setShowCreateModal(true);
                        }}
                        className="btn btn-ghost btn-xs text-teal-600 dark:text-teal-400"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add sub-unit
                      </button>
                    </div>

                    {childUnits.length === 0 ? (
                      <p className="empty-state border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                        No child storage sub-units under this container.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {childUnits.map(child => (
                          <div
                            key={child.id}
                            onClick={() => setSelectedLocationId(child.id)}
                            className="p-2.5 bg-zinc-50 hover:bg-teal-50/70 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                          >
                            <div className="flex items-center gap-3 truncate">
                              <img
                                src={getLocationImage(child)}
                                alt={child.name}
                                referrerPolicy="no-referrer"
                                className="w-12 h-12 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700 flex-shrink-0 cursor-zoom-in"
                                onMouseEnter={(e) => showImagePreview(e, getLocationImage(child), `${child.code} — ${child.name}`)}
                                onMouseLeave={hideImagePreview}
                                onClick={hideImagePreview}
                              />
                              <div className="truncate">
                                <span className="block font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                  {child.name}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                                    {child.type}
                                  </span>
                                  <span className="text-[10px] font-mono text-zinc-400">
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
                                className="btn btn-ghost btn-icon btn-xs"
                                title="Edit sub-unit details"
                                aria-label={`Edit sub-unit ${child.name}`}
                              >
                                <Edit className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                              <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-teal-600 transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Contained Physical Documents Section */}
              <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <h4 className="section-title">
                    Contained records & documents ({selectedDocs.length})
                  </h4>
                  <span className="meta">
                    Calculated for node & all sub-containers
                  </span>
                </div>

                {selectedDocs.length === 0 ? (
                  <div className="empty-state border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                    <FileText className="w-6 h-6 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
                    <p>No physical documents currently assigned to this storage container.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {selectedDocs.map(doc => (
                      <div
                        key={doc.id}
                        onClick={() => onSelectDocument(doc.id)}
                        className="p-3 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                                #{doc.documentNumber}
                              </span>
                              <StatusBadge type="status" value={doc.status} size="sm" />
                            </div>
                            <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate mt-0.5">
                              {doc.title}
                            </p>
                          </div>
                        </div>

                        <ArrowRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="card empty-state py-12">
              <Building2 className="w-10 h-10 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
              <p className="font-medium text-zinc-700 dark:text-zinc-300">
                Select a physical location from the tree hierarchy to inspect its details.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Create New Storage Location Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="card max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden my-auto" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h3 className="section-title">
                  Add new storage container / unit
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="btn btn-ghost btn-icon btn-sm"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="label">
                  Parent Storage Unit (Parent Hierarchy)
                </label>
                <select
                  value={createParentId || ''}
                  onChange={(e) => setCreateParentId(e.target.value || null)}
                  className="input"
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
                  <label className="label">
                    Container Level / Type *
                  </label>
                  <select
                    value={newLocType}
                    onChange={(e) => setNewLocType(e.target.value as LocationType)}
                    className="input font-semibold"
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
                  <label className="label">
                    Storage Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={newLocCode}
                    onChange={(e) => setNewLocCode(e.target.value)}
                    placeholder="e.g. CAB-04, BOX-020"
                    className="input font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="label">
                  Container Name *
                </label>
                <input
                  type="text"
                  required
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  placeholder="e.g. Fireproof Cabinet C-04, Box B-020"
                  className="input"
                />
              </div>

              <div>
                <label className="label">
                  Maximum Holding Capacity
                </label>
                <input
                  type="number"
                  min={1}
                  value={newLocCapacity}
                  onChange={(e) => setNewLocCapacity(Number(e.target.value))}
                  className="input"
                />
              </div>

              <div>
                <label className="label">
                  GPS Coordinates (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    value={newLocLatitude}
                    onChange={(e) => setNewLocLatitude(e.target.value)}
                    placeholder="Latitude"
                    className="input font-mono"
                  />
                  <input
                    type="number"
                    step="any"
                    value={newLocLongitude}
                    onChange={(e) => setNewLocLongitude(e.target.value)}
                    placeholder="Longitude"
                    className="input font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => captureGps('create')}
                    disabled={capturingGps !== null}
                    title="Capture current GPS position"
                    className="btn btn-secondary btn-sm shrink-0"
                  >
                    {capturingGps === 'create' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
                    GPS
                  </button>
                </div>
              </div>

              <div>
                <label className="label">
                  Description / Storage Notes
                </label>
                <textarea
                  value={newLocDesc}
                  onChange={(e) => setNewLocDesc(e.target.value)}
                  rows={2}
                  placeholder="Additional storage specifications or handling notes..."
                  className="input resize-none"
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

              <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="card max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h3 className="section-title">
                  Update storage location photo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPhotoModal(false)}
                className="btn btn-ghost btn-icon btn-sm"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
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

            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setEditingPhotoModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  updateLocation(selectedLoc.id, { imageUrl: photoInputUrl.trim() || undefined });
                  setEditingPhotoModal(false);
                }}
                className="btn btn-primary"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="card max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden my-auto" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <div>
                  <h3 className="section-title">
                    Edit storage unit details
                  </h3>
                  <p className="meta">
                    Update storage name, classification, parent location, or capacity
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="btn btn-ghost btn-icon btn-sm"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                <div>
                  <label className="label">
                    Parent Storage Unit (Location Hierarchy)
                  </label>
                  <select
                    value={editParentId || ''}
                    onChange={(e) => setEditParentId(e.target.value ? e.target.value : null)}
                    className="input font-medium"
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
                    <label className="label">
                      Container Type / Classification *
                    </label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as LocationType)}
                      className="input font-semibold"
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
                    <label className="label">
                      Storage Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={editCode || ''}
                      onChange={(e) => setEditCode(e.target.value)}
                      placeholder="e.g. CAB-04, BOX-020"
                      className="input font-mono uppercase font-bold text-teal-600 dark:text-teal-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">
                    Physical Storage Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName || ''}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Main Vault Room 01, Cabinet C-03"
                    className="input font-medium"
                  />
                </div>

                <div>
                  <label className="label">
                    Max Holding Capacity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editCapacity ?? ''}
                    onChange={(e) => setEditCapacity(Number(e.target.value))}
                    className="input font-bold"
                  />
                </div>

                <div>
                  <label className="label">
                    GPS Coordinates (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      value={editLatitude}
                      onChange={(e) => setEditLatitude(e.target.value)}
                      placeholder="Latitude"
                      className="input font-mono"
                    />
                    <input
                      type="number"
                      step="any"
                      value={editLongitude}
                      onChange={(e) => setEditLongitude(e.target.value)}
                      placeholder="Longitude"
                      className="input font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => captureGps('edit')}
                      disabled={capturingGps !== null}
                      title="Capture current GPS position"
                      className="btn btn-secondary btn-sm shrink-0"
                    >
                      {capturingGps === 'edit' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
                      GPS
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">
                    Description / Storage Notes
                  </label>
                  <textarea
                    value={editDescription || ''}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    placeholder="Storage room conditions, physical security keys, handling instructions..."
                    className="input resize-none"
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

              <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
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

      {/* Hover preview popover for storage unit images */}
      {imagePreview && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{ left: imagePreview.x, top: imagePreview.y, width: PREVIEW_WIDTH }}
        >
          <div className="card rounded-xl shadow-lg overflow-hidden">
            <img
              src={imagePreview.src}
              alt={imagePreview.title}
              className="w-full max-h-64 object-contain bg-zinc-50 dark:bg-zinc-800"
              referrerPolicy="no-referrer"
            />
            <div className="px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 border-t border-zinc-100 dark:border-zinc-800 truncate">
              {imagePreview.title}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
