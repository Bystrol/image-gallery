import { useState } from 'react'
import './App.css'
import { lambdaApi } from './api/config'

function App() {
  const [file, setFile] = useState<File | null>(null)

  const handleUpload = async () => {
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    await lambdaApi.post('/upload', formData)
  }

  return (
    <>
   <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
   {file && <button onClick={handleUpload}>Upload</button>}
   </>
  )
}

export default App
