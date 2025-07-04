"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, Share2, Download, Shield, Zap, Globe, Copy, CheckCircle, AlertCircle } from "lucide-react"
import { useP2PNetwork } from "@/hooks/use-p2p-network"

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [shareLink, setShareLink] = useState<string>("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const { isConnected, signalingStatus, peers, joinRoom, sendFile } = useP2PNetwork()

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setShareLink("")
      setUploadProgress(0)
    }
  }

  const handleShare = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Generate a unique share ID
      const shareId = Math.random().toString(36).substr(2, 9)

      // Join a room for this file share
      joinRoom(`share-${shareId}`)

      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            setIsUploading(false)

            // Generate share link
            const link = `${window.location.origin}/download/${shareId}`
            setShareLink(link)

            return 100
          }
          return prev + 10
        })
      }, 200)
    } catch (error) {
      console.error("Error sharing file:", error)
      setIsUploading(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy link:", error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">P2P File Share</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    signalingStatus === "connected"
                      ? "bg-green-500"
                      : signalingStatus === "connecting"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                />
                <span className="text-sm text-gray-600">
                  {signalingStatus === "connected"
                    ? "Connected"
                    : signalingStatus === "connecting"
                      ? "Connecting"
                      : "Disconnected"}
                </span>
              </div>
              <span className="text-sm text-gray-600">Peers: {peers.length}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Share Files Securely with P2P Technology</h2>
          <p className="text-xl text-gray-600 mb-8">
            No servers, no limits, no tracking. Direct peer-to-peer file sharing.
          </p>
        </div>

        {/* Connection Status */}
        {signalingStatus !== "connected" && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {signalingStatus === "connecting"
                ? "Connecting to P2P network..."
                : "Unable to connect to P2P network. Please check your connection."}
            </AlertDescription>
          </Alert>
        )}

        {/* File Upload Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Share a File
            </CardTitle>
            <CardDescription>Select a file to share with others via peer-to-peer connection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Choose File</Label>
              <Input id="file-upload" type="file" onChange={handleFileSelect} disabled={isUploading} />
            </div>

            {selectedFile && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <Button onClick={handleShare} disabled={isUploading || signalingStatus !== "connected"}>
                    {isUploading ? "Preparing..." : "Share File"}
                  </Button>
                </div>
              </div>
            )}

            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Preparing file for sharing</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            {shareLink && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p>File is ready to share! Send this link to recipients:</p>
                    <div className="flex items-center gap-2">
                      <Input value={shareLink} readOnly className="flex-1" />
                      <Button size="sm" onClick={copyToClipboard} variant={linkCopied ? "default" : "outline"}>
                        {linkCopied ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                Secure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Direct peer-to-peer connections with end-to-end encryption. No data passes through our servers.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Fast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Direct connections mean faster transfers. No upload to servers, no download delays.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                Decentralized
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                No central servers to fail or be compromised. The network is as strong as its users.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How it Works */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>Simple, secure, and decentralized file sharing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Upload className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-medium mb-2">1. Select & Share</h3>
                <p className="text-sm text-gray-600">Choose your file and get a secure share link</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Share2 className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-medium mb-2">2. Send Link</h3>
                <p className="text-sm text-gray-600">Share the link with anyone you want to receive the file</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Download className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-medium mb-2">3. Direct Transfer</h3>
                <p className="text-sm text-gray-600">Files transfer directly between devices, no servers involved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
