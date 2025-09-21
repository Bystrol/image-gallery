import { useState, useRef, DragEvent } from 'react'
import './App.css'
import { lambdaApi } from './api/config'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile)
      setUploadSuccess(false)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)
    setUploadSuccess(false)
    try {
      const formData = new FormData()
      formData.append('image', file)
      await lambdaApi.post('/upload', formData)
      setUploadSuccess(true)
      setTimeout(() => {
        setFile(null)
        setUploadSuccess(false)
      }, 2000)
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="app">
      <div className="upload-container">
        <h1>Image Upload</h1>
        
        <div 
          className={`drop-zone ${isDragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openFileDialog}
        >
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*"
            onChange={handleFileInputChange}
            className="file-input"
          />
          
          <div className="drop-zone-content">
            {file ? (
              <div className="file-preview">
                <div className="file-icon">📁</div>
                <div className="file-info">
                  <div className="file-name">{file.name}</div>
                  <div className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
              </div>
            ) : (
              <>
                <div className="upload-icon">☁️</div>
                <div className="upload-text">
                  <strong>Drop your image here</strong> or click to browse
                </div>
                <div className="upload-hint">
                  Supports: JPG, PNG, GIF, WebP
                </div>
              </>
            )}
          </div>
        </div>

        {file && (
          <div className="upload-actions">
            <button 
              className={`upload-btn ${isUploading ? 'uploading' : ''} ${uploadSuccess ? 'success' : ''}`}
              onClick={handleUpload} 
              disabled={isUploading}
            >
              <span className="btn-content">
                {uploadSuccess ? (
                  <>
                    <span className="btn-icon">✅</span>
                    Upload Successful!
                  </>
                ) : isUploading ? (
                  <>
                    <span className="btn-spinner"></span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">⬆️</span>
                    Upload Image
                  </>
                )}
              </span>
            </button>
            
            <button 
              className="clear-btn"
              onClick={() => {
                setFile(null)
                setUploadSuccess(false)
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
              disabled={isUploading}
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
