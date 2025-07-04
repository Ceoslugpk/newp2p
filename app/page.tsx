"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Share2, Shield, Zap } from "lucide-react"
import FileShareInterface from "@/components/file-share-interface"
import PeerNetworkStatus from "@/components/peer-network-status"
import TransferManager from "@/components/transfer-manager"

export default function P2PFileShareApp() {
  const [activeTab, setActiveTab] = useState("share")

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">P2P File Share</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Decentralized file sharing with end-to-end encryption
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="share">Share Files</TabsTrigger>
            <TabsTrigger value="transfers">Active Transfers</TabsTrigger>
            <TabsTrigger value="network">Network Status</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          {/* File Sharing Interface */}
          <TabsContent value="share" className="space-y-6">
            <FileShareInterface />
          </TabsContent>

          {/* Active Transfers */}
          <TabsContent value="transfers" className="space-y-6">
            <TransferManager />
          </TabsContent>

          {/* Network Status */}
          <TabsContent value="network" className="space-y-6">
            <PeerNetworkStatus />
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Share2 className="w-5 h-5" />
                    How It Works
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">
                    Files are shared directly between peers using WebRTC technology. No central server stores your files
                    - they transfer directly from your device to the recipient's device with end-to-end encryption.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Security Features
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• AES-256-GCM encryption</li>
                    <li>• ECDH key exchange</li>
                    <li>• File integrity verification</li>
                    <li>• Peer authentication</li>
                    <li>• No server storage</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Benefits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Unlimited file sizes</li>
                    <li>• No storage costs</li>
                    <li>• Enhanced privacy</li>
                    <li>• Faster transfers</li>
                    <li>• Works offline</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
