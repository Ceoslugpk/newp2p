"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { useP2PNetwork } from "@/hooks/use-p2p-network"

interface FileInfo {
  name: string
  size: number
  type: string
}

export default function DownloadPage() {
  const params = useParams()
  const shareId = params.shareId as string

  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadStatus, setDownloadStatus] = useState<
    "idle" | "searching" | "connecting" | "downloading" | "completed" | "error"
  >("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [downloadedFile, setDownloadedFile] = useState<Blob | null>(null)

  const { isConnected, connectionStatus, requestFile, peers } = useP2PNetwork()

  // Start file request when connected
  useEffect(() => {
    if (isConnected && shareId && downloadStatus === "idle") {
      handleDownload()
    }
  }, [isConnected, shareId, downloadStatus])

  const handleDownload = async () => {
    if (!shareId) {
      setErrorMessage("Invalid share ID")
      setDownloadStatus("error")
      return
    }

    try {
      setDownloadStatus("searching")
      setErrorMessage("")

      // Request file from network
      await requestFile(shareId)

      // Set timeout for file search
      const searchTimeout = setTimeout(() => {
        if (downloadStatus === "searching") {
          setErrorMessage("File not found or no peers available")
          setDownloadStatus("error")
        }
      }, 30000) // 30 second timeout

      // Clear timeout if we find the file
      return () => clearTimeout(searchTimeout)
    } catch (error) {
      console.error("Download error:", error)
      setErrorMessage("Failed to request file")
      setDownloadStatus("error")
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return "🖼️"
    if (fileType.startsWith("video/")) return "🎥"
    if (fileType.startsWith("audio/")) return "🎵"
    if (fileType.includes("pdf")) return "📄"
    if (fileType.includes("zip") || fileType.includes("rar")) return "📦"
    return "📄"
  }

  const downloadFile = () => {
    if (downloadedFile && fileInfo) {
      const url = URL.createObjectURL(downloadedFile)
      const a = document.createElement("a")
      a.href = url
      a.download = fileInfo.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const getStatusMessage = () => {
    switch (downloadStatus) {
      case "idle":
        return "Initializing..."
      case "searching":
        return "Searching for file in P2P network..."
      case "connecting":
        return "Connecting to peer..."
      case "downloading":
        return "Downloading file..."
      case "completed":
        return "Download completed!"
      case "error":
        return errorMessage || "An error occurred"
      default:
        return "Unknown status"
    }
  }

  const getStatusIcon = () => {
    switch (downloadStatus) {
      case "idle":
      case "searching":
      case "connecting":
      case "downloading":
        return <Loader2 className="h-4 w-4 animate-spin" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto pt-20">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">P2P File Download</CardTitle>
            <CardDescription>
              Share ID: <code className="bg-gray-100 px-2 py-1 rounded text-sm">{shareId}</code>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Connection Status */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Network Status: {connectionStatus} | Connected Peers: {peers.size}
              </AlertDescription>
            </Alert>

            {/* File Information */}
            {fileInfo && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="text-3xl">{getFileIcon(fileInfo.type)}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{fileInfo.name}</h3>
                    <p className="text-sm text-gray-600">
                      {formatFileSize(fileInfo.size)} • {fileInfo.type}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Download Status */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                {getStatusIcon()}
                <span className="text-sm font-medium text-gray-700">{getStatusMessage()}</span>
              </div>

              {/* Progress Bar */}
              {(downloadStatus === "downloading" || downloadStatus === "completed") && (
                <div className="space-y-2">
                  <Progress value={downloadProgress} className="w-full" />
                  <p className="text-xs text-gray-600 text-center">{downloadProgress}% completed</p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {downloadStatus === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              {downloadStatus === "completed" && downloadedFile ? (
                <Button onClick={downloadFile} className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Save File
                </Button>
              ) : downloadStatus === "error" ? (
                <Button onClick={handleDownload} variant="outline" className="flex-1 bg-transparent">
                  Try Again
                </Button>
              ) : (
                <Button disabled className="flex-1">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {downloadStatus === "idle"
                    ? "Initializing..."
                    : downloadStatus === "searching"
                      ? "Searching..."
                      : downloadStatus === "connecting"
                        ? "Connecting..."
                        : "Downloading..."}
                </Button>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">How P2P Download Works:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Your browser connects to other peers in the network</li>
                <li>• Files are transferred directly between browsers</li>
                <li>• No files are stored on our servers</li>
                <li>• The file sharer must be online for download to work</li>
              </ul>
            </div>

            {/* Technical Details */}
            <details className="text-sm text-gray-600">
              <summary className="cursor-pointer font-medium">Technical Details</summary>
              <div className="mt-2 space-y-1">
                <p>Share ID: {shareId}</p>
                <p>Network Status: {connectionStatus}</p>
                <p>Connected Peers: {peers.size}</p>
                <p>WebRTC Support: {typeof RTCPeerConnection !== "undefined" ? "Yes" : "No"}</p>
              </div>
            </details>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
