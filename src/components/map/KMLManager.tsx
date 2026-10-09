import { useState, useEffect, useCallback, useRef } from 'react'
import { LuUpload, LuFile, LuTrash2, LuCheck, LuX, LuFolderOpen } from 'react-icons/lu'
import { cn } from '../../lib/utils'
import type { KMLFile } from '../../store/kml'

const DB_NAME = 'hydropower-kml'
const DB_VERSION = 1
const STORE_NAME = 'kml-files'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getAllKML(): Promise<KMLFile[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result as KMLFile[])
    req.onerror = () => reject(req.error)
  })
}

async function saveKML(file: KMLFile): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(file)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function deleteKML(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

const LAST_KML_KEY = 'hydropower-kml-last'

interface KMLManagerProps {
  onSelect: (kml: KMLFile | null) => void
  selectedId: string | null
  onFilesLoaded?: (files: Array<{ id: string; content: string }>) => void
}

export function KMLManager({ onSelect, selectedId, onFilesLoaded }: KMLManagerProps) {
  const [files, setFiles] = useState<KMLFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const didAutoSelect = useRef(false)

  const loadFiles = useCallback(async () => {
    try {
      const all = await getAllKML()
      const sorted = all.sort((a, b) => b.addedAt - a.addedAt)
      setFiles(sorted)
      onFilesLoaded?.(sorted.map((f) => ({ id: f.id, content: f.content })))

      if (!didAutoSelect.current) {
        didAutoSelect.current = true
        const lastId = localStorage.getItem(LAST_KML_KEY)
        const match = sorted.find((f) => f.id === lastId) || sorted[0]
        if (match) onSelect(match)
      }
    } catch {
      console.error('Failed to load KML files')
    }
  }, [onSelect, onFilesLoaded])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  useEffect(() => {
    if (selectedId) localStorage.setItem(LAST_KML_KEY, selectedId)
  }, [selectedId])

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return
    for (const file of Array.from(fileList)) {
      if (!file.name.endsWith('.kml')) continue
      const content = await file.text()
      const id = `${file.name}-${Date.now()}`
      await saveKML({
        id,
        name: file.name,
        content,
        size: file.size,
        addedAt: Date.now(),
      })
    }
    await loadFiles()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleDelete = async (id: string) => {
    await deleteKML(id)
    if (selectedId === id) onSelect(null)
    await loadFiles()
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept=".kml"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {files.length === 0 && !isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-tx3/20 bg-s2/30 text-[0.72rem] font-semibold text-tx3 transition-colors hover:border-ac/40 hover:text-ac"
        >
          <LuUpload size={14} />
          Drop KML file here
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex h-10 w-full items-center gap-2 rounded-2xl border-2 border-tx3/15 bg-s1 px-3 text-[0.72rem] font-semibold text-tx transition-colors hover:border-ac/30"
          >
            <LuFolderOpen size={14} className="text-ac" />
            <span className="flex-1 text-left">
              {selectedId ? files.find((f) => f.id === selectedId)?.name || 'KML loaded' : `${files.length} KML file${files.length !== 1 ? 's' : ''}`}
            </span>
            <span className={cn('transition-transform', isOpen && 'rotate-180')}>▾</span>
          </button>

          {isOpen && (
            <div className="absolute top-12 left-0 z-50 w-full overflow-hidden rounded-2xl border-2 border-tx3/15 bg-s1 shadow-xl">
              {/* drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={cn(
                  'mx-3 mt-3 flex h-16 items-center justify-center rounded-xl border-2 border-dashed transition-colors',
                  isDragOver ? 'border-ac/50 bg-ac/5' : 'border-tx3/15 bg-s2/20',
                )}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-[0.64rem] font-medium text-tx3 transition-colors hover:text-ac"
                >
                  <LuUpload size={12} />
                  {isDragOver ? 'Drop to add' : 'Add file'}
                </button>
              </div>

              {/* file list */}
              <div className="max-h-48 overflow-y-auto p-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className={cn(
                      'group flex items-center gap-2 rounded-xl px-3 py-2 transition-colors',
                      selectedId === file.id ? 'bg-ac/10' : 'hover:bg-s2/50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(selectedId === file.id ? null : file)}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      <LuFile size={14} className={selectedId === file.id ? 'text-ac' : 'text-tx3'} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[0.68rem] font-semibold text-tx">{file.name}</div>
                        <div className="text-[0.56rem] text-tx3">{formatSize(file.size)}</div>
                      </div>
                      {selectedId === file.id && <LuCheck size={14} className="shrink-0 text-ac" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(file.id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-tx3 opacity-0 transition-all hover:bg-rd/10 hover:text-rd group-hover:opacity-100"
                    >
                      <LuTrash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* close */}
              <div className="border-t border-tx3/10 p-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-8 w-full items-center justify-center gap-1 rounded-xl text-[0.62rem] font-semibold text-tx3 transition-colors hover:bg-s2/50 hover:text-tx"
                >
                  <LuX size={12} /> Close
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export type { KMLFile }
