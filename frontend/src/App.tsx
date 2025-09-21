import { useState } from 'react'
import './App.css'
import { lambdaApi } from './api/config'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      await lambdaApi.post('/upload', formData)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <>
      <h1>Hello World</h1>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      {file && <button onClick={handleUpload} disabled={isUploading}>{isUploading ? 'Uploading...' : 'Upload'}</button>}
    </>
  )
}

export default App
