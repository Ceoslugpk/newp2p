"use client"

import type React from "react"
import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { Upload, FileText, Shield, Copy, CheckCircle, Users, Loader2, X, Share2 } from "lucide-react"
import { useP2PNetwork } from "@/hooks/use-p2p-network"

export default function FileShareInterface() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [shareLinks, setShareLinks] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { createShare, isConnected, peerCount } = useP2PNetwork()

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setSelectedFiles((prev) => [...prev, ...files])
  }, [])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files)
    setSelectedFiles((prev) => [...prev, ...files])
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }, [])

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const shareFiles = useCallback(async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select files to share",
        variant: "destructive",
      })
      return
    }

    if (!isConnected) {
      toast({
        title: "Not connected",
        description: "Please wait for P2P network connection",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    const newShareLinks: string[] = []

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        setUploadProgress(((i + 1) / selectedFiles.length) * 100)

        // Read file as ArrayBuffer
        const fileData = await file.arrayBuffer()

        // Create file metadata
        const fileMetadata = {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          hash: await calculateFileHash(fileData),
        }

        // Create P2P share with actual file data
        const shareId = await createShare(fileMetadata, fileData)
        const shareLink = `${window.location.origin}/download/${shareId}`
        newShareLinks.push(shareLink)

        toast({
          title: "File shared successfully",
          description: `${file.name} is now available for download`,
        })
      }

      setShareLinks(newShareLinks)
      setSelectedFiles([])
    } catch (error) {
      console.error("Error sharing files:", error)
      toast({
        title: "Share failed",
        description: "Failed to share files. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
      setUploadProgress(0)
    }
  }, [selectedFiles, createShare, isConnected, toast])

  const copyToClipboard = useCallback(
    async (link: string) => {
      try {
        await navigator.clipboard.writeText(link)
        toast({
          title: "Link copied",
          description: "Share link copied to clipboard",
        })
      } catch (error) {
        toast({
          title: "Copy failed",
          description: "Failed to copy link to clipboard",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  const formatFileSize = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB"]
    if (bytes === 0) return "0 Bytes"
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Network Status */}
      <Card>
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
              TURN-enabled P2P
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Share Files
          </CardTitle>
          <CardDescription>
            Upload files to share directly with other peers through TURN-enabled P2P connections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-blue-500" />
            <h4 className="text-xl font-semibold mb-2">Drop files here to share</h4>
            <p className="text-gray-600 mb-4">or click to browse</p>
            <Button variant="outline">Select Files</Button>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Selected Files ({selectedFiles.length})</h4>
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-gray-600">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Processing Progress */}
              {isProcessing && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Processing and sharing files...</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              )}

              {/* Share Button */}
              <div className="mt-4">
                <Button onClick={shareFiles} disabled={isProcessing || !isConnected} className="w-full">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 mr-2" />
                      Share Files via P2P
                    </>
                  )}
                </Button>
                {!isConnected && (
                  <p className="text-sm text-gray-500 mt-2 text-center">Waiting for P2P network connection...</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Share Links */}
      {shareLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Files Shared Successfully
            </CardTitle>
            <CardDescription>Share these links to allow others to download your files via P2P</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {shareLinks.map((link, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <Input value={link} readOnly className="flex-1 bg-white" />
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(link)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Real P2P Transfer:</strong> Files are transferred directly between peers using TURN servers for
                NAT traversal. Keep this tab open to continue seeding files to other users.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Utility function to calculate file hash
async function calculateFileHash(fileData: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", fileData)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}
