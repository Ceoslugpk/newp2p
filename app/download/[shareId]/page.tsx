"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, FileText, AlertCircle } from "lucide-react"

interface DownloadPageProps {
  params: {
    shareId: string
  }
}

export default function DownloadPage({ params }: DownloadPageProps) {
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    // Simulate fetching file info
    const timer = setTimeout(() => {
      if (params.shareId) {
        setFileInfo({
          name: "example-file.pdf",
          size: 2.5 * 1024 * 1024, // 2.5 MB
        })
      } else {
        setError("Invalid share ID")
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [params.shareId])

  const handleDownload = async () => {
    if (!fileInfo) return

    setIsDownloading(true)
    setDownloadProgress(0)

    // Simulate download progress
    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsDownloading(false)
          return 100
        }
        return prev + 5
      })
    }, 100)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Download className="w-6 h-6" />
                Download File
              </CardTitle>
              <CardDescription>Share ID: {params.shareId}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {fileInfo && (
                <>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <FileText className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="font-medium">{fileInfo.name}</p>
                      <p className="text-sm text-gray-600">{(fileInfo.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>

                  {isDownloading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Downloading...</span>
                        <span>{downloadProgress}%</span>
                      </div>
                      <Progress value={downloadProgress} />
                    </div>
                  )}

                  <Button onClick={handleDownload} disabled={isDownloading} className="w-full">
                    {isDownloading ? "Downloading..." : "Download File"}
                  </Button>
                </>
              )}

              {!fileInfo && !error && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading file information...</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-center mt-6">
            <Button asChild variant="outline">
              <a href="/">← Back to Home</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
