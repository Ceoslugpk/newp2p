"use client"

import { useState, useCallback } from "react"

interface FileMetadata {
  id: string
  name: string
  size: number
  type: string
  hash: string
  chunks: ChunkMetadata[]
  encryptionKey: Uint8Array
  created: number
}

interface ChunkMetadata {
  index: number
  size: number
  hash: string
  encrypted: boolean
}

export function useFileProcessor() {
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  const processFile = useCallback(async (file: File): Promise<FileMetadata> => {
    setIsProcessing(true)
    setUploadProgress(0)

    try {
      // Generate encryption key
      const encryptionKey = crypto.getRandomValues(new Uint8Array(32))

      // Calculate optimal chunk size based on file size
      const chunkSize = calculateChunkSize(file.size)
      const totalChunks = Math.ceil(file.size / chunkSize)

      // Process file in chunks
      const chunks: ChunkMetadata[] = []
      const fileHash = await calculateFileHash(file)

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)

        // Calculate chunk hash
        const chunkHash = await calculateChunkHash(chunk)

        chunks.push({
          index: i,
          size: chunk.size,
          hash: chunkHash,
          encrypted: true,
        })

        // Update progress
        setUploadProgress(((i + 1) / totalChunks) * 100)
      }

      const metadata: FileMetadata = {
        id: generateFileId(),
        name: file.name,
        size: file.size,
        type: file.type,
        hash: fileHash,
        chunks,
        encryptionKey,
        created: Date.now(),
      }

      return metadata
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const encryptChunk = useCallback(async (chunk: Blob, key: Uint8Array): Promise<ArrayBuffer> => {
    const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for GCM
    const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, ["encrypt"])

    const chunkBuffer = await chunk.arrayBuffer()
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, chunkBuffer)

    // Prepend IV to encrypted data
    const result = new Uint8Array(iv.length + encrypted.byteLength)
    result.set(iv)
    result.set(new Uint8Array(encrypted), iv.length)

    return result.buffer
  }, [])

  const decryptChunk = useCallback(async (encryptedChunk: ArrayBuffer, key: Uint8Array): Promise<ArrayBuffer> => {
    const data = new Uint8Array(encryptedChunk)
    const iv = data.slice(0, 12) // Extract IV
    const encrypted = data.slice(12) // Extract encrypted data

    const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, ["decrypt"])

    return await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, encrypted)
  }, [])

  return {
    processFile,
    encryptChunk,
    decryptChunk,
    uploadProgress,
    isProcessing,
  }
}

// Utility functions
function calculateChunkSize(fileSize: number): number {
  if (fileSize < 1024 * 1024) return 16 * 1024 // 16KB for small files
  if (fileSize < 100 * 1024 * 1024) return 256 * 1024 // 256KB for medium files
  return 1024 * 1024 // 1MB for large files
}

async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function calculateChunkHash(chunk: Blob): Promise<string> {
  const buffer = await chunk.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

function generateFileId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
