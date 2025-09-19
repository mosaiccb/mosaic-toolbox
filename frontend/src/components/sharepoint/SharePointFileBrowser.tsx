import React, { useState, useEffect, useCallback } from 'react';
import { useSharePointApi, type SharePointConfiguration, type SharePointSite, type SharePointItem, type SharePointDrive } from '../../api/sharePointService';

interface SharePointFileBrowserProps {
  configuration: SharePointConfiguration;
  onClose: () => void;
}

interface BreadcrumbItem {
  name: string;
  driveId?: string;
  itemId?: string;
}

const SharePointFileBrowser: React.FC<SharePointFileBrowserProps> = ({ configuration, onClose }) => {
  const [sites, setSites] = useState<SharePointSite[]>([]);
  const [drives, setDrives] = useState<SharePointDrive[]>([]);
  const [items, setItems] = useState<SharePointItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentView, setCurrentView] = useState<'sites' | 'drives' | 'items'>('sites');
  const [selectedSite, setSelectedSite] = useState<SharePointSite | null>(null);
  const [selectedDrive, setSelectedDrive] = useState<SharePointDrive | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ name: 'Sites' }]);

  const { 
    getSharePointSites, 
    browseSharePointDrives, 
    browseSharePointItems,
    downloadSharePointFile 
  } = useSharePointApi();

  // Load sites from database (sites that were saved for this configuration)
  const loadSites = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const sitesData = await getSharePointSites(configuration.id);
      setSites(sitesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SharePoint sites');
      console.error('Error loading sites:', err);
    } finally {
      setLoading(false);
    }
  }, [getSharePointSites, configuration.id]);

  // Load drives for a specific site
  const loadDrives = useCallback(async (site: SharePointSite) => {
    try {
      setLoading(true);
      setError(null);
      const drivesData = await browseSharePointDrives(configuration.id, site.siteId);
      setDrives(drivesData);
      setSelectedSite(site);
      setCurrentView('drives');
      setBreadcrumbs([
        { name: 'Sites' },
        { name: site.siteName }
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drives');
      console.error('Error loading drives:', err);
    } finally {
      setLoading(false);
    }
  }, [browseSharePointDrives, configuration.id]);

  // Load items for a specific drive/folder
  const loadItems = useCallback(async (drive: SharePointDrive, itemId?: string, folderName?: string) => {
    try {
      setLoading(true);
      setError(null);
      const itemsData = await browseSharePointItems(configuration.id, selectedSite!.siteId, drive.id, itemId);
      setItems(itemsData);
      setSelectedDrive(drive);
      setCurrentView('items');
      
      // Update breadcrumbs
      const newBreadcrumbs = [
        { name: 'Sites' },
        { name: selectedSite!.siteName },
        { name: drive.name, driveId: drive.id }
      ];
      
      if (folderName && itemId) {
        newBreadcrumbs.push({ name: folderName, driveId: drive.id, itemId });
      }
      
      setBreadcrumbs(newBreadcrumbs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
      console.error('Error loading items:', err);
    } finally {
      setLoading(false);
    }
  }, [browseSharePointItems, configuration.id, selectedSite]);

  // Navigate into a folder
  const navigateToFolder = useCallback(async (item: SharePointItem) => {
    if (!item.folder || !selectedDrive) return;
    
    try {
      setLoading(true);
      setError(null);
      const itemsData = await browseSharePointItems(configuration.id, selectedSite!.siteId, selectedDrive.id, item.id);
      setItems(itemsData);
      
      // Add to breadcrumbs
      setBreadcrumbs(prev => [...prev, { name: item.name, driveId: selectedDrive.id, itemId: item.id }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to navigate to folder');
      console.error('Error navigating to folder:', err);
    } finally {
      setLoading(false);
    }
  }, [browseSharePointItems, configuration.id, selectedSite, selectedDrive]);

  // Navigate via breadcrumb
  const navigateToBreadcrumb = useCallback(async (index: number) => {
    const breadcrumb = breadcrumbs[index];
    
    if (index === 0) {
      // Back to sites
      setCurrentView('sites');
      setBreadcrumbs([{ name: 'Sites' }]);
      setSelectedSite(null);
      setSelectedDrive(null);
      return;
    }
    
    if (index === 1 && selectedSite) {
      // Back to drives
      setCurrentView('drives');
      setBreadcrumbs(breadcrumbs.slice(0, 2));
      setSelectedDrive(null);
      return;
    }
    
    // Navigate to specific folder
    if (breadcrumb.driveId && selectedSite) {
      const drive = drives.find(d => d.id === breadcrumb.driveId) || selectedDrive;
      if (drive) {
        await loadItems(drive, breadcrumb.itemId, breadcrumb.name);
        setBreadcrumbs(breadcrumbs.slice(0, index + 1));
      }
    }
  }, [breadcrumbs, selectedSite, drives, selectedDrive, loadItems]);

  // Download a file
  const handleDownload = useCallback(async (item: SharePointItem) => {
    if (!item.file || !selectedSite || !selectedDrive) return;
    
    try {
      const blob = await downloadSharePointFile(configuration.id, selectedSite.siteId, selectedDrive.id, item.id);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download file');
      console.error('Error downloading file:', err);
    }
  }, [downloadSharePointFile, configuration.id, selectedSite, selectedDrive]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && currentView === 'sites') {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-full max-w-6xl shadow-lg rounded-md bg-white">
          <div className="flex items-center justify-center min-h-96">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-6xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Browse SharePoint - {configuration.name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="sr-only">Close</span>
            <span className="text-xl">×</span>
          </button>
        </div>

        {/* Breadcrumbs */}
        <nav className="flex mb-4" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            {breadcrumbs.map((crumb, index) => (
              <li key={index} className="flex items-center">
                {index > 0 && (
                  <span className="mx-2 text-gray-400">/</span>
                )}
                <button
                  onClick={() => navigateToBreadcrumb(index)}
                  className={`text-sm ${
                    index === breadcrumbs.length - 1
                      ? 'text-gray-900 font-medium'
                      : 'text-blue-600 hover:text-blue-800'
                  }`}
                >
                  {crumb.name}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
            <div className="flex">
              <span className="h-5 w-5 text-red-400 font-bold">⚠</span>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-600">Loading...</span>
          </div>
        )}

        {/* Content */}
        {!loading && (
          <div className="max-h-96 overflow-y-auto">
            {/* Sites View */}
            {currentView === 'sites' && (
              <div className="space-y-2">
                {sites.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="mx-auto h-12 w-12 text-gray-400 text-4xl">📂</div>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No SharePoint sites</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      No sites have been configured for this SharePoint connection.
                    </p>
                  </div>
                ) : (
                  sites.map((site) => (
                    <div
                      key={site.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                      onClick={() => loadDrives(site)}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🏢</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{site.siteName}</p>
                          <p className="text-xs text-gray-500">{site.siteUrl}</p>
                        </div>
                      </div>
                      <span className="text-gray-400">→</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Drives View */}
            {currentView === 'drives' && (
              <div className="space-y-2">
                {drives.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="mx-auto h-12 w-12 text-gray-400 text-4xl">💾</div>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No drives found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      No drives are available for this site.
                    </p>
                  </div>
                ) : (
                  drives.map((drive) => (
                    <div
                      key={drive.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                      onClick={() => loadItems(drive)}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">💾</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{drive.name}</p>
                          {drive.description && (
                            <p className="text-xs text-gray-500">{drive.description}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-gray-400">→</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Items View */}
            {currentView === 'items' && (
              <div className="space-y-1">
                {items.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="mx-auto h-12 w-12 text-gray-400 text-4xl">📄</div>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Empty folder</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      This folder doesn't contain any files or subfolders.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="col-span-6">Name</div>
                      <div className="col-span-2">Size</div>
                      <div className="col-span-3">Modified</div>
                      <div className="col-span-1">Actions</div>
                    </div>

                    {/* Items */}
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-12 gap-4 px-3 py-2 border-b border-gray-100 hover:bg-gray-50"
                      >
                        <div 
                          className="col-span-6 flex items-center space-x-2 cursor-pointer"
                          onClick={() => item.folder ? navigateToFolder(item) : undefined}
                        >
                          <span className="text-lg">
                            {item.folder ? '📁' : '📄'}
                          </span>
                          <span className={`text-sm ${item.folder ? 'text-blue-600 hover:text-blue-800' : 'text-gray-900'}`}>
                            {item.name}
                          </span>
                          {item.folder && <span className="text-gray-400">→</span>}
                        </div>
                        
                        <div className="col-span-2 text-sm text-gray-500">
                          {formatFileSize(item.size)}
                        </div>
                        
                        <div className="col-span-3 text-sm text-gray-500">
                          {formatDate(item.lastModifiedDateTime)}
                        </div>
                        
                        <div className="col-span-1">
                          {item.file && (
                            <button
                              onClick={() => handleDownload(item)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                              title="Download file"
                            >
                              ⬇️
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 text-sm font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharePointFileBrowser;