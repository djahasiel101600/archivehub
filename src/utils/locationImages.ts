import { LocationType, LocationItem } from '../types';
import archiveVaultRoomImg from '../assets/images/archive_vault_room_1786514972208.jpg';
import filingCabinetUnitImg from '../assets/images/filing_cabinet_unit_1786514993509.jpg';
import archiveBoxShelfImg from '../assets/images/archive_box_shelf_1786515006012.jpg';

export const DEFAULT_TYPE_IMAGES: Record<LocationType, string> = {
  BUILDING: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
  FLOOR: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
  ROOM: archiveVaultRoomImg,
  STORAGE_AREA: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
  CABINET: filingCabinetUnitImg,
  RACK: 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80',
  SHELF: archiveBoxShelfImg,
  BOX: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80',
  FOLDER: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80',
  OTHER: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80',
};

export function getLocationImage(location: LocationItem): string {
  if (location.imageUrl && location.imageUrl.trim().length > 0) {
    return location.imageUrl;
  }
  return DEFAULT_TYPE_IMAGES[location.type] || DEFAULT_TYPE_IMAGES.OTHER;
}
