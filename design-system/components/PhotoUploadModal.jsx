import { useState, useRef } from 'react'
import { Upload, X, Check, Image as ImageIcon } from 'lucide-react'

export default function PhotoUploadModal({
  isOpen,
  onClose,
  targetId,
  targetName = 'User',
  onPhotoSaved,
}) {
  const [preview, setPreview] = useState(null)
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        // Resize to 256x256 max
        const canvas = document.createElement('canvas')
        const MAX_SIZE = 256
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width
            width = MAX_SIZE
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height
            height = MAX_SIZE
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setPreview(dataUrl)
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    if (preview && targetId) {
      localStorage.setItem(`vitalis_avatar_${targetId}`, preview)
      if (onPhotoSaved) onPhotoSaved(preview)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Profile Photo</h3>
            <p className="text-xs text-slate-500 mt-0.5">Upload local preview for {targetName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl mb-4 bg-slate-50/50 dark:bg-slate-800/30">
          {preview ? (
            <img src={preview} alt="Preview" className="w-24 h-24 rounded-2xl object-cover shadow-md mb-2" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2">
              <ImageIcon size={32} />
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-vitalis-ghost py-2 px-4 text-xs mt-2"
          >
            <Upload size={14} />
            <span>Choose Image</span>
          </button>
          <span className="text-[10px] text-slate-400 mt-2">JPG, PNG max 256×256px</span>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 mb-4">
          Note: This photo is stored in your client browser as a verified local avatar preview (Zero-PHI compliant).
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!preview}
            onClick={handleSave}
            className="flex-1 btn-vitalis-pill justify-center py-2.5 text-xs disabled:opacity-40"
          >
            <Check size={14} />
            <span>Save Photo</span>
          </button>
        </div>
      </div>
    </div>
  )
}
