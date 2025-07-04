"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { useP2PNetwork } from "@/hooks/use-p2p-network"

interface FileInfo {
  name: string
  size: number
  shareId: string
}

export default function DownloadPage() {
  const params = useParams()
  const shareId = params.shareId as string
  const { networkStatus, transfers, requestFile } = useP2PNetwork()
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [downloadStatus, setDownloadStatus] = useState<
    "idle" | "searching" | "found" | "downloading" | "completed" | "failed"
  >("idle")
  const [error, setError] = useState<string | null>(null)

  // Find active transfer for this share
  const activeTransfer = transfers.find((t) => t.id.includes(shareId))

  useEffect(() => {
    if (shareId && networkStatus.isOnline) {
      setDownloadStatus("searching")
      setError(null)

      // Request the file from the network
      requestFile(shareId)

      // Set timeout for file discovery
      const timeout = setTimeout(() => {
        if (downloadStatus === "searching") {
          setDownloadStatus("failed")
          setError("File not found in the network. The sharing peer may be offline.")
        }
      }, 30000) // 30 second timeout

      return () => clearTimeout(timeout)
    }
  }, [shareId, networkStatus.isOnline, requestFile])

  // Update status based on transfer progress
  useEffect(() => {
    if (activeTransfer) {
      switch (activeTransfer.status) {
        case "pending":
          setDownloadStatus("found")
          setFileInfo({
            name: activeTransfer.fileName,
            size: activeTransfer.fileSize,
            shareId: shareId,
          })
          break
        case "transferring":
          setDownloadStatus("downloading")
          break
        case "completed":
          setDownloadStatus("completed")
          break
        case "failed":
          setDownloadStatus("failed")
          setError("File transfer failed. Please try again.")
          break
      }
    }
  }, [activeTransfer, shareId])

  const handleDownload = () => {
    if (fileInfo) {
      requestFile(shareId)
      setDownloadStatus("downloading")
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getStatusIcon = () => {
    switch (downloadStatus) {
      case "searching":
        return <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      case "found":
        return <Download className="h-6 w-6 text-green-500" />
      case "downloading":
        return <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      case "completed":
        return <CheckCircle className="h-6 w-6 text-green-500" />
      case "failed":
        return <AlertCircle className="h-6 w-6 text-red-500" />
      default:
        return <Download className="h-6 w-6 text-gray-500" />
    }
  }

  const getStatusMessage = () => {
    switch (downloadStatus) {
      case "idle":
        return "Connecting to P2P network..."
      case "searching":
        return "Searching for file in the network..."
      case "found":
        return "File found! Ready to download."
      case "downloading":
        return "Downloading file via P2P..."
      case "completed":
        return "Download completed successfully!"
      case "failed":
        return "Download failed."
      default:
        return "Unknown status"
    }
  }

  if (!networkStatus.isOnline) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <AlertCircle className="h-6 w-6 text-red-500" />
              Connection Error
            </CardTitle>
            <CardDescription>Unable to connect to the P2P network</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please check your internet connection and try again. The signaling server may be temporarily
                unavailable.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {getStatusIcon()}
            P2P File Download
          </CardTitle>
          <CardDescription>Share ID: {shareId}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Network Status */}
          <div className="flex items-center justify-between text-sm">
            <span>Network Status:</span>
            <span
              className={`font-medium ${networkStatus.signaling === "connected" ? "text-green-600" : "text-red-600"}`}
            >
              {networkStatus.signaling === "connected" ? "Connected" : "Disconnected"}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span>Connected Peers:</span>
            <span className="font-medium">{networkStatus.peers.length}</span>
          </div>

          {/* File Information */}
          {fileInfo && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium text-gray-900 mb-2">File Details</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Name:</span>
                  <span className="font-medium">{fileInfo.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Size:</span>
                  <span className="font-medium">{formatFileSize(fileInfo.size)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Status Message */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">{getStatusMessage()}</p>

            {/* Progress Bar */}
            {activeTransfer && downloadStatus === "downloading" && (
              <div className="space-y-2">
                <Progress value={activeTransfer.progress} className="w-full" />
                <p className="text-xs text-gray-500">{Math.round(activeTransfer.progress)}% completed</p>
              </div>
            )}
          </div>

          {/* Action Button */}
          {downloadStatus === "found" && (
            <Button onClick={handleDownload} className="w-full" size="lg">
              <Download className="h-4 w-4 mr-2" />
              Download via P2P
            </Button>
          )}

          {downloadStatus === "searching" && (
            <Button disabled className="w-full" size="lg">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Searching for file...
            </Button>
          )}

          {downloadStatus === "downloading" && (
            <Button disabled className="w-full" size="lg">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Downloading...
            </Button>
          )}

          {downloadStatus === "completed" && (
            <Button disabled className="w-full" size="lg">
              <CheckCircle className="h-4 w-4 mr-2" />
              Download Completed
            </Button>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Help Text */}
          <div className="text-xs text-gray-500 text-center space-y-1">
            <p>Files are transferred directly between peers without server storage.</p>
            <p>The sharing peer must be online for the download to work.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
