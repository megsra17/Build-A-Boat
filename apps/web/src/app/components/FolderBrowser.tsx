import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Folder, ArrowLeft, Upload } from 'lucide-react';

interface Media {
  id: string;
  url: string;
  label?: string | null;
  fileName?: string;
  contentType?: string;
  uploadedAt?: string;
  w?: number | null;
  h?: number | null;
}

interface FolderBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (media: Media) => void;
  apiUrl: string;
  jwt: string | null;
}

export default function FolderBrowser({ isOpen, onClose, onSelect, apiUrl, jwt }: FolderBrowserProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [folders, setFolders] = useState<string[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const loadCurrentDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Always load folders for current path
      const folderRes = await fetch(`${apiUrl}/admin/media/folders?prefix=${currentPath}`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      });
      
      if (folderRes.ok) {
        const folderData = await folderRes.json();
        console.log('Folder API response:', folderData);
        const cleanFolders = (folderData.folders || []).map((folder: string) => folder.replace(/\/+$/, ''));
        setFolders(cleanFolders);
      } else {
        setFolders([]);
      }

      // Only load media if we're in a subfolder (not at root)
      if (currentPath) {
        const fileRes = await fetch(`${apiUrl}/admin/media/folder/${currentPath}`, {
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
        });
        
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          console.log('Files in folder:', fileData);
          
          const mediaItems: Media[] = (fileData.files || []).map((file: { Key: string; Url: string }) => ({
            id: file.Key,
            url: file.Url,
            label: file.Key.split('/').pop()
          }));
          setMedia(mediaItems);
        } else {
          setMedia([]);
        }
      } else {
        // At root level - show no media, only folders
        setMedia([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  }, [currentPath, apiUrl, jwt]);

  // Load folders and files for current path
  useEffect(() => {
    if (!isOpen) return;
    loadCurrentDirectory();
  }, [isOpen, currentPath, loadCurrentDirectory]);

  const navigateToFolder = (folderPath: string) => {
    // Clean up the folder path - remove trailing slashes for consistency
    const cleanPath = folderPath.replace(/\/+$/, '');
    setCurrentPath(cleanPath);
  };

  const navigateUp = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/');
    setCurrentPath(parentPath);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Try the folder-specific endpoint first, fall back to regular upload if it fails
      let uploadPath;
      let useRegularUpload = false;
      
      if (currentPath && typeof currentPath === 'string' && currentPath.trim()) {
        // Try folder-specific upload first
        const encodedPath = currentPath.split('/').map(part => encodeURIComponent(part)).join('/');
        uploadPath = `${apiUrl}/admin/media/upload/${encodedPath}`;
      } else {
        uploadPath = `${apiUrl}/admin/media/upload`;
        useRegularUpload = true;
      }
      
      console.log('Upload path:', uploadPath);
      console.log('Current path:', currentPath);
      
      let res = await fetch(uploadPath, {
        method: 'POST',
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
        body: formData,
      });

      // If folder upload fails with 500, try regular upload
      if (!res.ok && !useRegularUpload && res.status === 500) {
        console.log('Folder upload failed, trying regular upload...');
        
        // Create new FormData for retry
        const retryFormData = new FormData();
        retryFormData.append('file', file);
        
        res = await fetch(`${apiUrl}/admin/media/upload`, {
          method: 'POST',
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
          body: retryFormData,
        });
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Upload error:', errorText);
        
        // If both folder and regular uploads fail, suggest using the simple media picker
        if (res.status === 500) {
          throw new Error(`Upload failed: Database error. Try using the simple media picker instead of the folder browser, or check S3 permissions.`);
        }
        
        throw new Error(`Upload failed: ${res.status} ${errorText}`);
      }

      const uploadedMedia = await res.json();
      console.log('Upload successful:', uploadedMedia);
      
      // Add to current media list and auto-select
      setMedia(prev => [uploadedMedia, ...prev]);
      onSelect(uploadedMedia);
      
      // Reload the directory to refresh the view
      await loadCurrentDirectory();
      
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    
    setError(null);
    
    try {
      // For S3, folders are just path prefixes, so we can navigate to the folder immediately
      // The folder will be created when the first file is uploaded to it
      const folderPath = currentPath ? `${currentPath}/${newFolderName.trim()}` : newFolderName.trim();
      
      // Navigate to the new folder path
      setCurrentPath(folderPath);
      
      setNewFolderName('');
      setShowNewFolder(false);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));

    if (!imageFile) {
      setError('Please drop an image file (JPEG, PNG, GIF, WebP)');
      return;
    }

    // Upload the dragged file
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      
      let uploadPath;
      
      if (currentPath && typeof currentPath === 'string' && currentPath.trim()) {
        const encodedPath = currentPath.split('/').map(part => encodeURIComponent(part)).join('/');
        uploadPath = `${apiUrl}/admin/media/upload/${encodedPath}`;
      } else {
        uploadPath = `${apiUrl}/admin/media/upload`;
      }
      
      let res = await fetch(uploadPath, {
        method: 'POST',
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
        body: formData,
      });

      // If folder upload fails with 500, try regular upload
      if (!res.ok && currentPath) {
        const retryFormData = new FormData();
        retryFormData.append('file', imageFile);
        
        res = await fetch(`${apiUrl}/admin/media/upload`, {
          method: 'POST',
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
          body: retryFormData,
        });
      }

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Upload failed: ${res.status} ${errorText}`);
      }

      const uploadedMedia = await res.json();
      
      // Add to media list and auto-select
      setMedia(prev => [uploadedMedia, ...prev]);
      onSelect(uploadedMedia);
      
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex">
      <div className="m-auto w-[90vw] max-w-6xl rounded-xl border border-white/10 bg-[#141414] p-6 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">
              {currentPath && typeof currentPath === 'string' ? currentPath.split('/').pop() : 'Media Browser'}
            </h2>
            <div className="flex items-center gap-2 text-sm text-white/60">
              <button
                type="button"
                onClick={() => setCurrentPath('')}
                className="hover:text-amber-400 text-white/80"
              >
                Root
              </button>
              {currentPath && typeof currentPath === 'string' && (
                <>
                  <span>/</span>
                  {currentPath.split('/').filter(Boolean).map((segment, index, array) => (
                    <React.Fragment key={index}>
                      <button
                        type="button"
                        onClick={() => navigateToFolder(array.slice(0, index + 1).join('/'))}
                        className="hover:text-amber-400 text-white/80"
                      >
                        {segment}
                      </button>
                      {index < array.length - 1 && <span>/</span>}
                    </React.Fragment>
                  ))}
                </>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="size-8 rounded-full border border-white/20 hover:bg-white/10">
            ×
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-600/20 border border-red-600 text-red-300 rounded-lg">
            <p className="font-medium mb-2">Upload Error</p>
            <p className="text-sm mb-3">{error}</p>
            {error.includes('Database error') && (
              <div className="text-xs text-red-200 bg-red-900/30 p-3 rounded">
                <p className="font-medium mb-1">Quick Fix Options:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Use the simple media picker (non-folder) for now</li>
                  <li>Check S3 bucket permissions for public read access</li>
                  <li>Check CloudFront distribution settings</li>
                  <li>Verify database connection and constraints</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-6 p-4 rounded-lg border border-white/10 bg-black/20">
          {currentPath && typeof currentPath === 'string' && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={navigateUp}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 text-white px-3 py-2 hover:bg-white/10"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
              <div className="text-sm text-white/60">
                Current folder: <span className="text-amber-400 font-medium">{currentPath.split('/').pop() || currentPath}</span>
              </div>
            </div>
          )}
          
          <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-medium px-4 py-2">
            <Upload className="size-4" />
            {uploading ? "Uploading..." : "Upload Here"}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => setShowNewFolder(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 text-amber-300 px-3 py-2 hover:bg-amber-500/10"
          >
            <Plus className="size-4" />
            New Folder
          </button>

        </div>

        {/* New Folder Input */}
        {showNewFolder && (
          <div className="mb-4 p-3 rounded-lg border border-white/10 bg-black/20">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    createFolder();
                  }
                  if (e.key === 'Escape') {
                    setShowNewFolder(false);
                  }
                }}
                className="flex-1 rounded-md bg-black/40 border border-white/15 px-3 py-2 outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                className="px-3 py-2 bg-amber-500 text-black rounded-md hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewFolder(false);
                  setNewFolderName('');
                }}
                className="px-3 py-2 border border-white/20 rounded-md hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div 
          className="flex-1 overflow-auto relative"
          onDragOver={handleDragOver}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Only set to false if we're leaving the content area entirely
            if (e.currentTarget === e.target) {
              setDragActive(false);
            }
          }}
          onDrop={handleDrop}
        >
          {dragActive && (
            <div className="absolute inset-0 z-40 bg-amber-400/20 border-2 border-dashed border-amber-400 rounded-lg flex items-center justify-center">
              <div className="text-center pointer-events-none">
                <p className="text-lg font-semibold text-amber-300">Drop images here to upload</p>
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin size-8 border-2 border-amber-500 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              
              {/* Folders */}
              {folders
                .filter(folder => {
                  if (!folder || typeof folder !== 'string') return false;
                  
                  // At root: show all top-level folders
                  if (!currentPath) {
                    return !folder.includes('/');
                  }
                  
                  // In a subfolder: show direct children only
                  const cleanCurrentPath = currentPath.replace(/\/+$/, '');
                  const cleanFolder = folder.replace(/\/+$/, '');
                  const folderDepth = cleanFolder.split('/').length;
                  const currentDepth = cleanCurrentPath.split('/').length;
                  
                  return cleanFolder.startsWith(cleanCurrentPath + '/') && folderDepth === currentDepth + 1;
                })
                .map((folder) => {
                  if (!folder || typeof folder !== 'string') return null;
                  
                  const cleanFolder = folder.replace(/\/+$/, '');
                  const folderName = cleanFolder.split('/').pop() || cleanFolder || 'Unknown';
                  
                  return (
                    <button
                      key={cleanFolder}
                      type="button"
                      onClick={() => navigateToFolder(cleanFolder)}
                      className="aspect-square rounded-lg border border-white/10 hover:border-amber-400 bg-black/20 flex flex-col items-center justify-center p-4 text-center"
                    >
                      <Folder className="size-8 text-amber-400 mb-2" />
                      <span className="text-sm text-white/80 truncate w-full">
                        {folderName}
                      </span>
                    </button>
                  );
                })
                .filter(Boolean)}

              {/* Images */}
              {media.map((m) => {
                console.log('Rendering media item:', { id: m.id, url: m.url, label: m.label });
                const fileName = m.fileName || m.label || m.id.split('/').pop() || 'Unnamed';
                return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelect(m)}
                  className="aspect-square rounded-lg border border-white/10 hover:border-amber-400 overflow-hidden relative group flex flex-col"
                  title={fileName}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={m.url} 
                    alt={m.label ?? ''} 
                    className="w-full flex-1 object-contain bg-black/20" 
                    onLoad={() => console.log('Image loaded successfully:', m.url)}
                    onError={(e) => {
                      console.error('Failed to load image:', m.url);
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3Ctext x="50" y="50" font-size="12" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3EFailed to load%3C/text%3E%3C/svg%3E';
                    }}
                  />
                  <div className="p-1 bg-black/80 text-xs text-white/90 truncate w-full">
                    {fileName}
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
                </button>
              );
              })}

              {/* Empty State */}
              {!loading && folders.length === 0 && media.length === 0 && (
                <div className="col-span-full text-center text-white/60 py-12">
                  <Folder className="size-16 text-white/20 mx-auto mb-4" />
                  {currentPath && typeof currentPath === 'string' ? (
                    <>
                      <p className="text-lg text-white/80 mb-2">
                        Folder: <span className="text-amber-400 font-medium">{currentPath.split('/').pop()}</span>
                      </p>
                      <p className="text-sm mb-2">Path: /{currentPath}</p>
                      <p className="text-sm">This folder is empty - upload images or create subfolders to get started</p>
                    </>
                  ) : (
                    <>
                      <p>No folders or media found</p>
                      <p className="text-sm mt-2">Create folders or upload images to get started</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}