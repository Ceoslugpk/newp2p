"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, Download, Share2, Users, Shield, Zap } from "lucide-react"

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [shareId, setShareId] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleShare = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setUploadProgress(0)

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsUploading(false)
          setShareId(Math.random().toString(36).substring(2, 15))
          return 100
        }
        return prev + 10
      })
    }, 200)
  }

  const handleDownload = () => {
    if (shareId) {
      window.open(`/download/${shareId}`, "_blank")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">P2P File Share</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Share files directly between devices using peer-to-peer technology. No servers, no limits, just secure
            direct transfers.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardHeader className="text-center">
              <Shield className="w-12 h-12 mx-auto text-blue-600 mb-2" />
              <CardTitle>Secure</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                End-to-end encryption ensures your files stay private during transfer
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Zap className="w-12 h-12 mx-auto text-green-600 mb-2" />
              <CardTitle>Fast</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Direct peer-to-peer connections for maximum transfer speeds
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Users className="w-12 h-12 mx-auto text-purple-600 mb-2" />
              <CardTitle>Decentralized</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                No central servers - files transfer directly between devices
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Main Interface */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Share a File
              </CardTitle>
              <CardDescription>Select a file to share with others</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Choose File</Label>
                <Input id="file-upload" type="file" onChange={handleFileSelect} className="mt-1" />
              </div>

              {selectedFile && (
                <Alert>
                  <AlertDescription>
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </AlertDescription>
                </Alert>
              )}

              {isUploading && (
                <div className="space-y-2">
                  <Label>Upload Progress</Label>
                  <Progress value={uploadProgress} />
                  <p className="text-sm text-gray-600">{uploadProgress}% complete</p>
                </div>
              )}

              {shareId && (
                <Alert>
                  <Share2 className="h-4 w-4" />
                  <AlertDescription>
                    Share ID: <strong>{shareId}</strong>
                    <br />
                    Share this ID with others to let them download your file.
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={handleShare} disabled={!selectedFile || isUploading} className="w-full">
                {isUploading ? "Sharing..." : "Share File"}
              </Button>
            </CardContent>
          </Card>

          {/* Download Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Download a File
              </CardTitle>
              <CardDescription>Enter a share ID to download a file</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="share-id">Share ID</Label>
                <Input
                  id="share-id"
                  placeholder="Enter share ID..."
                  value={shareId}
                  onChange={(e) => setShareId(e.target.value)}
                  className="mt-1"
                />
              </div>

              <Button onClick={handleDownload} disabled={!shareId} className="w-full bg-transparent" variant="outline">
                Download File
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Demo Link */}
        <div className="text-center mt-12">
          <Button asChild variant="outline">
            <a href="/demo">View Technical Demo</a>
          </Button>
        </div>
      </div>
    </div>
  )
}
