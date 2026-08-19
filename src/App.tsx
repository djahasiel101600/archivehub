import React, { useState } from 'react';
import { ArchiveProvider, useArchive } from './context/ArchiveContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { CameraQRScannerModal } from './components/scanner/CameraQRScannerModal';
import { BatchRelocateModal } from './components/scanner/BatchRelocateModal';
import { AuthPage } from './components/auth/AuthPage';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { LocationsPage } from './pages/LocationsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { DocumentDetailPage } from './pages/DocumentDetailPage';
import { BundlesPage } from './pages/BundlesPage';
import { CheckoutsPage } from './pages/CheckoutsPage';
import { RetentionPage } from './pages/RetentionPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';

function AppContent() {
  const { activeTab, setActiveTab, isAuthenticated } = useArchive();

  // Active Selected Document ID for detail view
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Mobile Drawer State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Global Modals
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showBatchRelocateModal, setShowBatchRelocateModal] = useState(false);
  const [triggerRegisterDoc, setTriggerRegisterDoc] = useState(false);
  const [triggerCreateLoc, setTriggerCreateLoc] = useState(false);

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  const handleSelectDocument = (docId: string) => {
    setSelectedDocId(docId);
  };

  const handleSelectTab = (tabId: string) => {
    setSelectedDocId(null);
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  const handleNavigateLocation = (locId: string) => {
    setSelectedDocId(null);
    setActiveTab('locations');
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
      
      {/* Top Header Navbar */}
      <Header 
        onOpenScanner={() => setShowScannerModal(true)}
        onOpenBatchRelocate={() => setShowBatchRelocateModal(true)}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onSelectTab={handleSelectTab}
      />

      <div className="flex-1 flex max-w-[1800px] w-full mx-auto">
        
        {/* Left Navigation Sidebar (Desktop + Mobile Slide-over Drawer) */}
        <Sidebar 
          onSelectTab={handleSelectTab} 
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content View Container */}
        <main className="flex-1 p-3 sm:p-5 md:p-8 pb-24 md:pb-8 overflow-y-auto min-w-0">
          
          {selectedDocId ? (
            <DocumentDetailPage
              documentId={selectedDocId}
              onBack={() => setSelectedDocId(null)}
              onNavigateLocation={handleNavigateLocation}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardPage
                  onOpenScanner={() => setShowScannerModal(true)}
                  onOpenRegisterDoc={() => {
                    handleSelectTab('documents');
                    setTriggerRegisterDoc(true);
                  }}
                  onOpenCreateLocation={() => {
                    handleSelectTab('locations');
                    setTriggerCreateLoc(true);
                  }}
                  onSelectDocument={handleSelectDocument}
                />
              )}

              {activeTab === 'locations' && (
                <LocationsPage
                  onSelectDocument={handleSelectDocument}
                  openCreateModalDirectly={triggerCreateLoc}
                  onClearTrigger={() => setTriggerCreateLoc(false)}
                />
              )}

              {activeTab === 'documents' && (
                <DocumentsPage
                  onSelectDocument={handleSelectDocument}
                  openRegisterModalDirectly={triggerRegisterDoc}
                  onClearTrigger={() => setTriggerRegisterDoc(false)}
                />
              )}

              {activeTab === 'bundles' && (
                <BundlesPage />
              )}

              {activeTab === 'checkouts' && (
                <CheckoutsPage
                  onSelectDocument={handleSelectDocument}
                />
              )}

              {activeTab === 'retention' && (
                <RetentionPage />
              )}

              {activeTab === 'audit' && (
                <AuditLogsPage />
              )}

              {activeTab === 'settings' && (
                <SettingsPage />
              )}
            </>
          )}

        </main>

      </div>

      {/* Mobile Bottom Navigation Bar (< md screens) */}
      <MobileBottomNav
        onOpenScanner={() => setShowScannerModal(true)}
        onOpenBatchRelocate={() => setShowBatchRelocateModal(true)}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onSelectTab={handleSelectTab}
      />

      {/* Camera & Manual QR/Barcode Scanner Modal */}
      {showScannerModal && (
        <CameraQRScannerModal
          isOpen={showScannerModal}
          onClose={() => setShowScannerModal(false)}
          onSelectDocument={(doc) => {
            setSelectedDocId(doc.id);
            setShowScannerModal(false);
          }}
          onSelectLocation={(loc) => {
            setSelectedDocId(null);
            setActiveTab('locations');
            setShowScannerModal(false);
          }}
          onSelectBundle={() => {
            setSelectedDocId(null);
            setShowScannerModal(false);
          }}
        />
      )}

      {/* Batch Relocate Modal */}
      {showBatchRelocateModal && (
        <BatchRelocateModal
          isOpen={showBatchRelocateModal}
          onClose={() => setShowBatchRelocateModal(false)}
        />
      )}

    </div>
  );
}

export default function App() {
  return (
    <ArchiveProvider>
      <AppContent />
    </ArchiveProvider>
  );
}
