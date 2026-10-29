import React, { useState, useEffect, useRef } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { DocumentItem, ConfidentialityLevel, DocumentCondition, DocumentStatus } from '../../types';
import {
  X,
  Save,
  Edit3,
  SlidersHorizontal,
  Layers,
  MapPin,
  FileText,
  HardDrive,
  ShieldCheck,
  AlertCircle,
  FolderOpen,
  Upload,
} from 'lucide-react';
import { LocationPathBreadcrumbs } from '../common/LocationPathBreadcrumbs';
import { DocumentTypeCombobox } from '../common/DocumentTypeCombobox';

interface EditDocumentModalProps {
  document: DocumentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedDoc: DocumentItem) => void;
}

export const EditDocumentModal: React.FC<EditDocumentModalProps> = ({
  document,
  isOpen,
  onClose,
  onSaved,
}) => {
  const {
    departments,
    documentTypes,
    locations,
    bundles,
    updateDocument,
    uploadDigitalCopy,
    calculatePath,
    addNotification,
  } = useArchive();

  // Form State
  const [title, setTitle] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [homeLocationId, setHomeLocationId] = useState('');
  const [confidentiality, setConfidentiality] = useState<ConfidentialityLevel>('INTERNAL');
  const [condition, setCondition] = useState<DocumentCondition>('GOOD');
  const [conditionNotes, setConditionNotes] = useState('');
  const [custodianName, setCustodianName] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [filedDate, setFiledDate] = useState('');
  const [retentionEndDate, setRetentionEndDate] = useState('');
  const [status, setStatus] = useState<DocumentStatus>('AVAILABLE');

  // Custom Classification Fields
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number>>({});

  // Bundle Dossier
  const [bundleId, setBundleId] = useState<string>('');

  // Digital copy
  const [hasDigitalCopy, setHasDigitalCopy] = useState(false);
  const [digitalFileName, setDigitalFileName] = useState('');
  const [digitalFileVersion, setDigitalFileVersion] = useState(1);
  const [digitalFileType, setDigitalFileType] = useState('application/pdf');
  const [pendingDigitalFile, setPendingDigitalFile] = useState<File | null>(null);
  const digitalFileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form when document prop changes
  useEffect(() => {
    if (document && isOpen) {
      setTitle(document.title || '');
      setReferenceNumber(document.referenceNumber || '');
      setSubject(document.subject || '');
      setDescription(document.description || '');
      setDepartmentId(document.departmentId || (departments[0]?.id ?? ''));
      setDocumentTypeId(document.documentTypeId || (documentTypes[0]?.id ?? ''));
      setHomeLocationId(document.homeLocationId || (locations[0]?.id ?? ''));
      setConfidentiality(document.confidentiality || 'INTERNAL');
      setCondition(document.condition || 'GOOD');
      setConditionNotes(document.conditionNotes || '');
      setCustodianName(document.custodianName || '');
      setDocumentDate(document.documentDate || '');
      setReceivedDate(document.receivedDate || '');
      setFiledDate(document.filedDate || '');
      setRetentionEndDate(document.retentionEndDate || '');
      setStatus(document.status || 'AVAILABLE');

      // Custom Classification Fields
      setCustomFieldValues(document.customFieldValues || {});

      // Bundle Dossier
      setBundleId(document.bundleId || '');

      // Digital copy
      setHasDigitalCopy(document.hasDigitalCopy);
      setDigitalFileName(document.digitalFileName || '');
      setDigitalFileVersion(document.digitalFileVersion || 1);
      setDigitalFileType(document.digitalFileType || 'application/pdf');
      setPendingDigitalFile(document.hasDigitalCopy ? null : null);
    }
  });

  // Preview the next auto-generated number ({DEPT_CODE}-{TYPE_CODE}-{NNNN}) for a
  // department + document type pair — used by the registration form hint.
  const getNextDocumentNumber = async (departmentId: string, typeId: string): Promise<string | null> => {
    // ... implementation
  };

  // ... rest of component
};