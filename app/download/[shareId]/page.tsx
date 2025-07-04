"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, FileIcon, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { useP2PNetwork } from "@/hooks/use-p2p-network"

interface FileInfo {
  name: string
  size: number
  type: string
  shareId: string
}

export default function DownloadPage() {
  const params = useParams()
  const shareId = params.shareId as string

  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadStatus, setDownloadStatus] = useState<
    "searching" | "found" | "downloading" | "completed" | "failed" | "not-found"
  >("searching")
  const [error, setError] = useState<string>("")

  const { isConnected, signalingStatus, peers, joinRoom, connectToSignalingServer } = useP2PNetwork()

  useEffect(() => {
    if (shareId) {
      // Join a room based on the share ID to find peers with the file
      joinRoom(`share-${shareId}`)

      // Start searching for the file
      searchForFile(shareId)
    }
  }, [shareId, joinRoom])

  const searchForFile = async (shareId: string) => {
    setDownloadStatus("searching")
    setError("")

    // In a real implementation, this would query peers for the file
    // For now, we'll simulate the search process

    setTimeout(() => {
      // Simulate file not found for demo
      setDownloadStatus("not-found")
      setError("File not found. The file may have expired or the sharer is offline.")
    }, 3000)
  }

  const handleDownload = async () => {
    if (!fileInfo) return

    setDownloadStatus("downloading")
    setDownloadProgress(0)

    try {
      // In a real implementation, this would initiate P2P file transfer
      // For now, we'll simulate the download process

      const interval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            setDownloadStatus("completed")
            return 100
          }
          return prev + 10
        })
      }, 500)
    } catch (error) {
      setDownloadStatus("failed")
      setError("Download failed. Please try again.")
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getStatusIcon = () => {
    switch (downloadStatus) {
      case "searching":
        return <Loader2 className="h-5 w-5 animate-spin" />
      case "found":
        return <FileIcon className="h-5 w-5" />
      case "downloading":
        return <Download className="h-5 w-5" />
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "failed":
      case "not-found":
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <FileIcon className="h-5 w-5" />
    }
  }

  const getStatusMessage = () => {
    switch (downloadStatus) {
      case "searching":
        return "Searching for file..."
      case "found":
        return "File found! Ready to download."
      case "downloading":
        return "Downloading file..."
      case "completed":
        return "Download completed successfully!"
      case "failed":
        return "Download failed."
      case "not-found":
        return "File not found."
      default:
        return "Unknown status"
    }
  }

  if (signalingStatus === "disconnected") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Connection Error
            </CardTitle>
            <CardDescription>Unable to connect to the P2P network</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Cannot connect to the signaling server. Please check your internet connection and try again.
              </AlertDescription>
            </Alert>
            <Button onClick={connectToSignalingServer} className="w-full">
              Retry Connection
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">P2P File Download</h1>
          <p className="text-gray-600">Secure peer-to-peer file sharing</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              File Download
            </CardTitle>
            <CardDescription>Share ID: {shareId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">{getStatusMessage()}</p>
                <p className="text-sm text-gray-500">Connected peers: {peers.length}</p>
              </div>
            </div>

            {fileInfo && (
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <FileIcon className="h-8 w-8 text-blue-500" />
                    <div>
                      <h3 className="font-medium">{fileInfo.name}</h3>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(fileInfo.size)} • {fileInfo.type}
                      </p>
                    </div>
                  </div>
                </div>

                {downloadStatus === "downloading" && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Download Progress</span>
                      <span>{downloadProgress}%</span>
                    </div>
                    <Progress value={downloadProgress} className="w-full" />
                  </div>
                )}

                {downloadStatus === "found" && (
                  <Button onClick={handleDownload} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                )}

                {downloadStatus === "completed" && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>File downloaded successfully! Check your downloads folder.</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {downloadStatus === "not-found" && (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">File Not Found</h3>
                <p className="text-gray-500 mb-4">
                  The file you're looking for is not available. This could happen if:
                </p>
                <ul className="text-sm text-gray-500 text-left max-w-md mx-auto space-y-1">
                  <li>• The file has expired</li>
                  <li>• The person sharing the file is offline</li>
                  <li>• The share link is invalid</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-gray-500">Powered by peer-to-peer technology • No central servers required</p>
        </div>
      </div>
    </div>
  )
}
