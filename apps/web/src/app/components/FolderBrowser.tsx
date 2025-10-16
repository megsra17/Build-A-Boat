import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Folder, ArrowLeft, Upload } from 'lucide-react';

interface Media {
  Id: string;
  Url: string;
  label?: string | null;
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

  const loadCurrentDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load folders
      const folderRes = await fetch(`${apiUrl}/admin/media/folders?prefix=${currentPath}`, {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      });
      
      if (folderRes.ok) {
        const folderData = await folderRes.json();
        setFolders(folderData.folders || []);
      }

      // Load files in current folder
      if (currentPath) {
        const fileRes = await fetch(`${apiUrl}/admin/media/folder/${currentPath}`, {
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
        });
        
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          
          // Convert to Media format
          const mediaItems: Media[] = fileData.files.map((file: { Key: string; Url: string }) => ({
            Id: file.Key,
            Url: file.Url,
            label: file.Key.split('/').pop()
          }));
          setMedia(mediaItems);
        }
      } else {
        // Root level - load all media for backward compatibility
        const mediaRes = await fetch(`${apiUrl}/admin/media`, {
          headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
        });
        
        if (mediaRes.ok) {
          const mediaData = await mediaRes.json();
          const mediaArray = Array.isArray(mediaData) ? mediaData : (mediaData.items || []);
          setMedia(mediaArray);
        }
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
    setCurrentPath(folderPath.replace(/\/$/, '')); // Remove trailing slash
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

      const uploadPath = currentPath ? `${apiUrl}/admin/media/upload/${currentPath}` : `${apiUrl}/admin/media/upload`;
      
      const res = await fetch(uploadPath, {
        method: 'POST',
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Upload failed: ${res.status} ${errorText}`);
      }

      const uploadedMedia = await res.json();
      
      // Add to current media list and auto-select
      setMedia(prev => [uploadedMedia, ...prev]);
      onSelect(uploadedMedia);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    
    setError(null);
    setUploading(true);
    
    try {
      // Create a folder by uploading a small transparent PNG image
      // S3 doesn't have true folders, so we create a placeholder image to establish the folder
      const folderPath = currentPath ? `${currentPath}/${newFolderName.trim()}` : newFolderName.trim();
      
      // Create a 1x1 transparent PNG image as a placeholder
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 1, 1); // Transparent pixel
      }
      
      // Convert canvas to blob
      const placeholderBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob || new Blob());
        }, 'image/png');
      });
      
      const formData = new FormData();
      formData.append('file', placeholderBlob, '.folder-placeholder.png');

      const uploadPath = `${apiUrl}/admin/media/upload/${folderPath}`;
      
      const res = await fetch(uploadPath, {
        method: 'POST',
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to create folder: ${res.status} ${errorText}`);
      }

      // Reload the current directory to show the new folder
      await loadCurrentDirectory();
      
      setNewFolderName('');
      setShowNewFolder(false);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
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
            <h2 className="text-lg font-semibold">Media Browser</h2>
            <div className="flex items-center gap-2 text-sm text-white/60">
              <span>/</span>
              {currentPath.split('/').filter(Boolean).map((segment, index, array) => (
                <React.Fragment key={index}>
                  <button
                    type="button"
                    onClick={() => navigateToFolder(array.slice(0, index + 1).join('/'))}
                    className="hover:text-amber-400"
                  >
                    {segment}
                  </button>
                  {index < array.length - 1 && <span>/</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
          <button type="button" onClick={onClose} className="size-8 rounded-full border border-white/20 hover:bg-white/10">
            ×
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-600/20 border border-red-600 text-red-300 rounded">
            {error}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-6 p-4 rounded-lg border border-white/10 bg-black/20">
          {currentPath && (
            <button
              type="button"
              onClick={navigateUp}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 text-white px-3 py-2 hover:bg-white/10"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
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
                disabled={uploading}
              />
              <button
                type="button"
                onClick={createFolder}
                disabled={uploading || !newFolderName.trim()}
                className="px-3 py-2 bg-amber-500 text-black rounded-md hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewFolder(false);
                  setNewFolderName('');
                }}
                disabled={uploading}
                className="px-3 py-2 border border-white/20 rounded-md hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin size-8 border-2 border-amber-500 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              
              {/* Folders */}
              {folders.map((folder) => (
                <button
                  key={folder}
                  type="button"
                  onClick={() => navigateToFolder(folder)}
                  className="aspect-square rounded-lg border border-white/10 hover:border-amber-400 bg-black/20 flex flex-col items-center justify-center p-4 text-center"
                >
                  <Folder className="size-8 text-amber-400 mb-2" />
                  <span className="text-sm text-white/80 truncate w-full">
                    {folder.split('/').pop()}
                  </span>
                </button>
              ))}

              {/* Images */}
              {media.map((m) => (
                <button
                  key={m.Id}
                  type="button"
                  onClick={() => onSelect(m)}
                  className="aspect-square rounded-lg border border-white/10 hover:border-amber-400 overflow-hidden"
                  title={m.label ?? ''}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={m.Url} 
                    alt={m.label ?? ''} 
                    className="w-full h-full object-cover" 
                  />
                </button>
              ))}

              {/* Empty State */}
              {!loading && folders.length === 0 && media.length === 0 && (
                <div className="col-span-full text-center text-white/60 py-12">
                  <Folder className="size-16 text-white/20 mx-auto mb-4" />
                  <p>This folder is empty</p>
                  <p className="text-sm mt-2">Upload images or create folders to get started</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}