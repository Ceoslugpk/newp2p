"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Network, Users, Shield, Activity, RefreshCw } from "lucide-react"
import { useP2PNetwork } from "@/hooks/use-p2p-network"

export default function PeerNetworkStatus() {
  const { isConnected, peerCount, connectionType, networkStats, connectedPeers, refreshNetwork } = useP2PNetwork()

  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshNetwork()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const formatBytes = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB"]
    if (bytes === 0) return "0 Bytes"
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  const getConnectionTypeColor = (type: string) => {
    switch (type) {
      case "direct":
        return "bg-green-100 text-green-800"
      case "relay":
        return "bg-yellow-100 text-yellow-800"
      case "disconnected":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getRegionFlag = (region: string) => {
    const flags: { [key: string]: string } = {
      "us-east": "🇺🇸",
      "us-west": "🇺🇸",
      "eu-west": "🇪🇺",
      "eu-central": "🇪🇺",
      "asia-pacific": "🌏",
      "south-america": "🌎",
    }
    return flags[region] || "🌍"
  }

  return (
    <div className="space-y-6">
      {/* Network Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{isConnected ? "Online" : "Offline"}</div>
                <p className="text-sm text-gray-600">Network Status</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">{peerCount}</div>
                <p className="text-sm text-gray-600">Connected Peers</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">{formatBytes(networkStats.bytesUploaded)}</div>
                <p className="text-sm text-gray-600">Uploaded</p>
              </div>
              <Activity className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-600">{formatBytes(networkStats.bytesDownloaded)}</div>
                <p className="text-sm text-gray-600">Downloaded</p>
              </div>
              <Activity className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connection Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="w-5 h-5" />
                Connection Details
              </CardTitle>
              <CardDescription>Your P2P network connection information</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Connection Type</span>
                <Badge className={getConnectionTypeColor(connectionType)}>{connectionType}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">NAT Traversal</span>
                <Badge variant="secondary">{isConnected ? "Successful" : "Pending"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Encryption</span>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  AES-256-GCM
                </Badge>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Upload Speed</span>
                <span className="text-sm">{formatBytes(networkStats.uploadSpeed)}/s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Download Speed</span>
                <span className="text-sm">{formatBytes(networkStats.downloadSpeed)}/s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Latency</span>
                <span className="text-sm">{Math.round(networkStats.latency)}ms</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Peers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Connected Peers ({connectedPeers.length})
          </CardTitle>
          <CardDescription>Other users you're currently connected to</CardDescription>
        </CardHeader>
        <CardContent>
          {connectedPeers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No peers connected</p>
              <p className="text-sm">Share a file or download from others to connect</p>
            </div>
          ) : (
            <div className="space-y-3">
              {connectedPeers.map((peer) => (
                <div key={peer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Peer {peer.id.slice(0, 8)}...</p>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <span>{getRegionFlag(peer.region)}</span>
                        <span>{peer.region}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {peer.connectionType}
                      </Badge>
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    </div>
                    <p className="text-xs text-gray-600">{formatBytes(peer.bandwidth)}/s</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Network Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Network Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Connection Quality</span>
                <span className="text-sm">{Math.round(networkStats.connectionQuality * 100)}%</span>
              </div>
              <Progress value={networkStats.connectionQuality * 100} className="w-full" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Network Stability</span>
                <span className="text-sm">{Math.round(networkStats.stability * 100)}%</span>
              </div>
              <Progress value={networkStats.stability * 100} className="w-full" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Peer Discovery Success</span>
                <span className="text-sm">{Math.round(networkStats.discoverySuccess * 100)}%</span>
              </div>
              <Progress value={networkStats.discoverySuccess * 100} className="w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
