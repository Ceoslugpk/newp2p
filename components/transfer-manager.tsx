"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { FileText, Download, Upload, Users, Pause, Play, X, CheckCircle, AlertCircle } from "lucide-react"
import { useTransferManager } from "@/hooks/use-transfer-manager"

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
}

export default function TransferManager() {
  const { activeTransfers, completedTransfers, pauseTransfer, resumeTransfer, cancelTransfer } = useTransferManager()

  const formatFileSize = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB"]
    if (bytes === 0) return "0 Bytes"
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number) => {
    return formatFileSize(bytesPerSecond) + "/s"
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
  }

  const getStatusColor = (status: Transfer["status"]) => {
    switch (status) {
      case "active":
        return "bg-blue-500"
      case "completed":
        return "bg-green-500"
      case "failed":
        return "bg-red-500"
      case "paused":
        return "bg-yellow-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusIcon = (status: Transfer["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-600" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Active Transfers */}
      <Card>
        <CardHeader>
          <CardTitle>Active Transfers</CardTitle>
          <CardDescription>Currently uploading and downloading files</CardDescription>
        </CardHeader>
        <CardContent>
          {activeTransfers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No active transfers</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeTransfers.map((transfer) => (
                <div key={transfer.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {transfer.type === "upload" ? (
                        <Upload className="w-5 h-5 text-blue-500" />
                      ) : (
                        <Download className="w-5 h-5 text-green-500" />
                      )}
                      <div>
                        <h4 className="font-medium">{transfer.fileName}</h4>
                        <p className="text-sm text-gray-600">{formatFileSize(transfer.fileSize)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {transfer.status}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {transfer.status === "active" ? (
                          <Button variant="ghost" size="sm" onClick={() => pauseTransfer(transfer.id)}>
                            <Pause className="w-4 h-4" />
                          </Button>
                        ) : transfer.status === "paused" ? (
                          <Button variant="ghost" size="sm" onClick={() => resumeTransfer(transfer.id)}>
                            <Play className="w-4 h-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelTransfer(transfer.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{Math.round(transfer.progress)}% complete</span>
                      <div className="flex items-center gap-4 text-gray-600">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {transfer.peers} peers
                        </span>
                        <span>{formatSpeed(transfer.speed)}</span>
                        {transfer.estimatedTime && <span>ETA: {formatTime(transfer.estimatedTime)}</span>}
                      </div>
                    </div>
                    <Progress value={transfer.progress} className="w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer History */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer History</CardTitle>
          <CardDescription>Recently completed and failed transfers</CardDescription>
        </CardHeader>
        <CardContent>
          {completedTransfers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No transfer history</p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedTransfers.map((transfer) => (
                <div key={transfer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {transfer.type === "upload" ? (
                      <Upload className="w-4 h-4 text-blue-500" />
                    ) : (
                      <Download className="w-4 h-4 text-green-500" />
                    )}
                    <div>
                      <p className="font-medium">{transfer.fileName}</p>
                      <p className="text-sm text-gray-600">
                        {formatFileSize(transfer.fileSize)} • {new Date(transfer.startTime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(transfer.status)}
                    <Badge variant={transfer.status === "completed" ? "default" : "destructive"} className="capitalize">
                      {transfer.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {activeTransfers.filter((t) => t.type === "upload").length}
              </div>
              <p className="text-sm text-gray-600">Active Uploads</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {activeTransfers.filter((t) => t.type === "download").length}
              </div>
              <p className="text-sm text-gray-600">Active Downloads</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {completedTransfers.filter((t) => t.status === "completed").length}
              </div>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
