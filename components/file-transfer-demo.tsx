"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Download, Users, Shield, Wifi, FileText, Play, Pause, CheckCircle } from "lucide-react"

export default function FileTransferDemo() {
  const [isTransferring, setIsTransferring] = useState(false)
  const [progress, setProgress] = useState(0)
  const [peers, setPeers] = useState(0)
  const [speed, setSpeed] = useState("0 MB/s")
  const [status, setStatus] = useState("Ready")

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isTransferring) {
      interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = Math.min(prev + Math.random() * 5, 100)

          // Simulate peer connections
          setPeers(Math.floor(Math.random() * 8) + 1)

          // Simulate transfer speed
          const speeds = ["1.2 MB/s", "2.4 MB/s", "3.1 MB/s", "1.8 MB/s", "2.9 MB/s"]
          setSpeed(speeds[Math.floor(Math.random() * speeds.length)])

          if (newProgress >= 100) {
            setStatus("Complete")
            setIsTransferring(false)
            return 100
          }

          setStatus("Transferring")
          return newProgress
        })
      }, 500)
    }

    return () => clearInterval(interval)
  }, [isTransferring])

  const startTransfer = () => {
    setIsTransferring(true)
    setProgress(0)
    setStatus("Connecting")
    setPeers(1)
  }

  const pauseTransfer = () => {
    setIsTransferring(false)
    setStatus("Paused")
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          P2P File Transfer Demo
        </CardTitle>
        <CardDescription>Interactive demonstration of peer-to-peer file sharing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Info */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="font-semibold">presentation.pptx</h4>
              <p className="text-sm text-gray-600">45.2 MB • PowerPoint Presentation</p>
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Encrypted
            </Badge>
          </div>
        </div>

        {/* Transfer Progress */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Transfer Progress</span>
            <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="w-full" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  status === "Complete"
                    ? "bg-green-500"
                    : status === "Transferring"
                      ? "bg-blue-500 animate-pulse"
                      : status === "Paused"
                        ? "bg-yellow-500"
                        : "bg-gray-400"
                }`}
              />
              <span>{status}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{peers} peers</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="w-4 h-4" />
              <span>{speed}</span>
            </div>
            <div className="flex items-center gap-1">
              <Wifi className="w-4 h-4" />
              <span>P2P Direct</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {!isTransferring && progress < 100 && (
            <Button onClick={startTransfer} className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              {progress > 0 ? "Resume" : "Start"} Transfer
            </Button>
          )}
          {isTransferring && (
            <Button onClick={pauseTransfer} variant="outline" className="flex items-center gap-2 bg-transparent">
              <Pause className="w-4 h-4" />
              Pause
            </Button>
          )}
          {progress >= 100 && (
            <Button variant="outline" className="flex items-center gap-2 bg-transparent">
              <CheckCircle className="w-4 h-4" />
              Transfer Complete
            </Button>
          )}
        </div>

        {/* Peer Status */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Connected Peers
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {Array.from({ length: Math.min(peers, 4) }, (_, i) => (
              <div key={i} className="flex items-center justify-between bg-white p-2 rounded">
                <span>Peer {i + 1}</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-xs text-gray-600">{(Math.random() * 2 + 0.5).toFixed(1)} MB/s</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Info */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Security Features
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>End-to-end encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Peer authentication</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>File integrity verification</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>No server storage</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
