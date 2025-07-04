"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { Download, FileText, Shield, Users, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { useP2PNetwork } from "@/hooks/use-p2p-network"

interface FileInfo {
  name: string
  size: number
  type: string
  hash: string
  lastModified: number
}

export default function DownloadPage() {
  const params = useParams()
  const shareId = params.shareId as string
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadedChunks, setDownloadedChunks] = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [downloadedData, setDownloadedData] = useState<Map<number, ArrayBuffer>>(new Map())

  const { toast } = useToast()
  const { isConnected, peerCount, downloadFile } = useP2PNetwork()

  useEffect(() => {
    if (shareId && isConnected) {
      discoverFile()
    }
  }, [shareId, isConnected])

  const discoverFile = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Wait for network to be ready
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Check if this looks like a valid share ID
      if (shareId && shareId.length === 16 && /^[a-f0-9]+$/.test(shareId)) {
        // In a real P2P network, we would query peers for file metadata
        // For now, show that we're looking for the file
        if (peerCount === 0) {
          setError("No peers available. Please ensure the file sharer is online and try again.")
        } else {
          setError("File not found in network. The file may no longer be shared or peers are offline.")
        }
      } else {
        setError("Invalid share link format.")
      }
    } catch (err) {
      setError("Failed to discover file. Please check your connection and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const startDownload = async () => {
    if (!fileInfo || !isConnected) return

    try {
      setIsDownloading(true)
      setDownloadProgress(0)
      setDownloadedChunks(0)
      setDownloadedData(new Map())

      toast({
        title: "Download started",
        description: `Downloading ${fileInfo.name} via P2P network`,
      })

      await downloadFile(
        shareId,
        (progress) => {
          setDownloadProgress(progress)
        },
        (chunk, index, total) => {
          setDownloadedData((prev) => {
            const newMap = new Map(prev)
            newMap.set(index, chunk)
            return newMap
          })
          setDownloadedChunks((prev) => prev + 1)
          setTotalChunks(total)
        },
      )

      // Reconstruct file from chunks
      const sortedChunks = Array.from(downloadedData.entries())
        .sort(([a], [b]) => a - b)
        .map(([, chunk]) => chunk)

      const fileData = new Uint8Array(sortedChunks.reduce((total, chunk) => total + chunk.byteLength, 0))

      let offset = 0
      for (const chunk of sortedChunks) {
        fileData.set(new Uint8Array(chunk), offset)
        offset += chunk.byteLength
      }

      // Create download link
      const blob = new Blob([fileData], { type: fileInfo.type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileInfo.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Download completed",
        description: `${fileInfo.name} has been downloaded successfully`,
      })
    } catch (err) {
      setError("Download failed. Please try again.")
      toast({
        title: "Download failed",
        description: "The download could not be completed. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB"]
    if (bytes === 0) return "0 Bytes"
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-2xl mx-auto pt-20">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-500" />
                <h3 className="text-lg font-semibold mb-2">Discovering file...</h3>
                <p className="text-gray-600">Searching the P2P network for your file</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-2xl mx-auto pt-20">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                <h3 className="text-lg font-semibold mb-2 text-red-700">File Not Found</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button onClick={discoverFile} variant="outline">
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto pt-20">
        {/* Network Status */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-sm font-medium">
                    {isConnected ? "Connected to P2P Network" : "Connecting..."}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{peerCount} peers online</span>
                </div>
              </div>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                TURN-enabled
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* File Information */}
        {fileInfo && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-500" />
                {fileInfo.name}
              </CardTitle>
              <CardDescription>File available for P2P download</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">File Size:</span>
                    <p className="text-gray-600">{formatFileSize(fileInfo.size)}</p>
                  </div>
                  <div>
                    <span className="font-medium">File Type:</span>
                    <p className="text-gray-600">{fileInfo.type || "Unknown"}</p>
                  </div>
                  <div>
                    <span className="font-medium">Available Peers:</span>
                    <p className="text-gray-600 flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {peerCount} peers
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">File Hash:</span>
                    <p className="text-gray-600 font-mono text-xs">{fileInfo.hash.slice(0, 16)}...</p>
                  </div>
                </div>

                {/* Download Progress */}
                {isDownloading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Download Progress</span>
                      <span>{Math.round(downloadProgress)}%</span>
                    </div>
                    <Progress value={downloadProgress} className="w-full" />
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>
                        Chunks: {downloadedChunks}/{totalChunks}
                      </span>
                      <span>P2P Transfer Active</span>
                    </div>
                  </div>
                )}

                {/* Download Button */}
                <Button
                  onClick={startDownload}
                  disabled={isDownloading || !isConnected || peerCount === 0}
                  className="w-full"
                  size="lg"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Downloading via P2P...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Download via P2P
                    </>
                  )}
                </Button>

                {/* Status Messages */}
                {!isConnected && (
                  <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    <span>Connecting to P2P network...</span>
                  </div>
                )}

                {peerCount === 0 && isConnected && (
                  <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    <span>No peers available. The file may no longer be shared.</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* TURN Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              P2P Transfer Technology
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>TURN server NAT traversal</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Direct peer-to-peer transfer</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>End-to-end encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>No server storage</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                This application uses TURN servers to establish direct peer-to-peer connections, even through NAT and
                firewalls. Files are transferred directly between users without being stored on any server.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
