"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface Transfer {
  id: string
  fileName: string
  fileSize: number
  type: "upload" | "download"
  status: "pending" | "active" | "paused" | "completed" | "failed"
  progress: number
  speed: number
  peers: number
  startTime: number
  estimatedTime?: number
  chunks: TransferChunk[]
}

interface TransferChunk {
  index: number
  size: number
  status: "pending" | "downloading" | "completed" | "failed"
  peerId?: string
  attempts: number
}

export function useTransferManager() {
  const [activeTransfers, setActiveTransfers] = useState<Transfer[]>([])
  const [completedTransfers, setCompletedTransfers] = useState<Transfer[]>([])
  const transfersRef = useRef<Map<string, Transfer>>(new Map())
  const speedCalculationRef = useRef<Map<string, { bytes: number; timestamp: number }[]>>(new Map())

  // Load transfers from localStorage on mount
  useEffect(() => {
    const savedTransfers = localStorage.getItem("p2p-transfers")
    if (savedTransfers) {
      try {
        const transfers = JSON.parse(savedTransfers)
        setCompletedTransfers(transfers.completed || [])
      } catch (error) {
        console.error("Error loading saved transfers:", error)
      }
    }
  }, [])

  // Save completed transfers to localStorage
  useEffect(() => {
    localStorage.setItem(
      "p2p-transfers",
      JSON.stringify({
        completed: completedTransfers,
      }),
    )
  }, [completedTransfers])

  // Update active transfers periodically
  useEffect(() => {
    const interval = setInterval(() => {
      updateTransferSpeeds()
      updateActiveTransfers()
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const createTransfer = useCallback(
    (fileName: string, fileSize: number, type: "upload" | "download", totalChunks: number): string => {
      const transferId = generateTransferId()

      const chunks: TransferChunk[] = Array.from({ length: totalChunks }, (_, index) => ({
        index,
        size:
          index === totalChunks - 1
            ? fileSize - index * Math.floor(fileSize / totalChunks)
            : Math.floor(fileSize / totalChunks),
        status: "pending",
        attempts: 0,
      }))

      const transfer: Transfer = {
        id: transferId,
        fileName,
        fileSize,
        type,
        status: "pending",
        progress: 0,
        speed: 0,
        peers: 0,
        startTime: Date.now(),
        chunks,
      }

      transfersRef.current.set(transferId, transfer)
      setActiveTransfers((prev) => [...prev, transfer])
      speedCalculationRef.current.set(transferId, [])

      return transferId
    },
    [],
  )

  const updateChunkStatus = useCallback(
    (transferId: string, chunkIndex: number, status: TransferChunk["status"], peerId?: string) => {
      const transfer = transfersRef.current.get(transferId)
      if (!transfer) return

      const chunk = transfer.chunks[chunkIndex]
      if (chunk) {
        chunk.status = status
        if (peerId) chunk.peerId = peerId

        if (status === "completed") {
          // Update transfer progress
          const completedChunks = transfer.chunks.filter((c) => c.status === "completed").length
          transfer.progress = (completedChunks / transfer.chunks.length) * 100

          // Record bytes for speed calculation
          recordBytesTransferred(transferId, chunk.size)

          // Check if transfer is complete
          if (completedChunks === transfer.chunks.length) {
            completeTransfer(transferId)
          }
        } else if (status === "failed") {
          chunk.attempts++

          // Retry failed chunks up to 3 times
          if (chunk.attempts < 3) {
            setTimeout(() => {
              updateChunkStatus(transferId, chunkIndex, "pending")
            }, 2000 * chunk.attempts) // Exponential backoff
          }
        }

        updateActiveTransfers()
      }
    },
    [],
  )

  const recordBytesTransferred = useCallback((transferId: string, bytes: number) => {
    const speedData = speedCalculationRef.current.get(transferId) || []
    const now = Date.now()

    speedData.push({ bytes, timestamp: now })

    // Keep only last 10 seconds of data
    const cutoff = now - 10000
    const recentData = speedData.filter((d) => d.timestamp > cutoff)

    speedCalculationRef.current.set(transferId, recentData)
  }, [])

  const updateTransferSpeeds = useCallback(() => {
    transfersRef.current.forEach((transfer, transferId) => {
      if (transfer.status === "active") {
        const speedData = speedCalculationRef.current.get(transferId) || []

        if (speedData.length > 1) {
          const now = Date.now()
          const recentData = speedData.filter((d) => d.timestamp > now - 5000) // Last 5 seconds

          if (recentData.length > 0) {
            const totalBytes = recentData.reduce((sum, d) => sum + d.bytes, 0)
            const timeSpan = (now - recentData[0].timestamp) / 1000 // Convert to seconds

            transfer.speed = timeSpan > 0 ? totalBytes / timeSpan : 0

            // Calculate estimated time
            const remainingBytes = transfer.fileSize * (1 - transfer.progress / 100)
            transfer.estimatedTime = transfer.speed > 0 ? remainingBytes / transfer.speed : undefined
          }
        }
      }
    })
  }, [])

  const updateActiveTransfers = useCallback(() => {
    const active = Array.from(transfersRef.current.values()).filter(
      (t) => t.status === "pending" || t.status === "active" || t.status === "paused",
    )
    setActiveTransfers(active)
  }, [])

  const completeTransfer = useCallback(
    (transferId: string) => {
      const transfer = transfersRef.current.get(transferId)
      if (!transfer) return

      transfer.status = "completed"
      transfer.progress = 100

      // Move to completed transfers
      setCompletedTransfers((prev) => [transfer, ...prev.slice(0, 49)]) // Keep last 50

      // Remove from active transfers
      transfersRef.current.delete(transferId)
      speedCalculationRef.current.delete(transferId)

      updateActiveTransfers()
    },
    [updateActiveTransfers],
  )

  const pauseTransfer = useCallback(
    (transferId: string) => {
      const transfer = transfersRef.current.get(transferId)
      if (transfer && transfer.status === "active") {
        transfer.status = "paused"
        updateActiveTransfers()
      }
    },
    [updateActiveTransfers],
  )

  const resumeTransfer = useCallback(
    (transferId: string) => {
      const transfer = transfersRef.current.get(transferId)
      if (transfer && transfer.status === "paused") {
        transfer.status = "active"

        // Resume pending chunks
        transfer.chunks.forEach((chunk, index) => {
          if (chunk.status === "pending") {
            // Trigger chunk download/upload
            setTimeout(() => {
              updateChunkStatus(transferId, index, "downloading")
            }, Math.random() * 1000)
          }
        })

        updateActiveTransfers()
      }
    },
    [updateActiveTransfers, updateChunkStatus],
  )

  const cancelTransfer = useCallback(
    (transferId: string) => {
      const transfer = transfersRef.current.get(transferId)
      if (transfer) {
        transfer.status = "failed"

        // Move to completed transfers as failed
        setCompletedTransfers((prev) => [transfer, ...prev.slice(0, 49)])

        // Clean up
        transfersRef.current.delete(transferId)
        speedCalculationRef.current.delete(transferId)

        updateActiveTransfers()
      }
    },
    [updateActiveTransfers],
  )

  const startTransfer = useCallback(
    (transferId: string) => {
      const transfer = transfersRef.current.get(transferId)
      if (transfer && transfer.status === "pending") {
        transfer.status = "active"

        // Start downloading/uploading chunks with more realistic timing
        transfer.chunks.forEach((chunk, index) => {
          setTimeout(() => {
            updateChunkStatus(transferId, index, "downloading")

            // Simulate chunk completion with variable timing
            const chunkTime = Math.random() * 3000 + 500 // 0.5-3.5 seconds per chunk
            setTimeout(() => {
              updateChunkStatus(transferId, index, "completed")
            }, chunkTime)
          }, index * 100) // Stagger chunk starts by 100ms
        })

        updateActiveTransfers()
      }
    },
    [updateActiveTransfers, updateChunkStatus],
  )

  return {
    activeTransfers,
    completedTransfers,
    createTransfer,
    updateChunkStatus,
    pauseTransfer,
    resumeTransfer,
    cancelTransfer,
    startTransfer,
  }
}

function generateTransferId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
