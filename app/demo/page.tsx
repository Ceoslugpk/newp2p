"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Network, Server, Shield, Zap, Users, Globe } from "lucide-react"

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">P2P File Share - Technical Demo</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Explore the architecture and capabilities of our decentralized file sharing system
          </p>
        </div>

        <Tabs defaultValue="architecture" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="architecture">Architecture</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="architecture" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-5 h-5" />
                  System Architecture
                </CardTitle>
                <CardDescription>How our P2P file sharing system works</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Traditional File Sharing</h3>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="flex items-center justify-center mb-2">
                        <Server className="w-8 h-8 text-red-600" />
                      </div>
                      <p className="text-sm text-center">
                        Files uploaded to central server, then downloaded by recipients
                      </p>
                    </div>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• Server storage costs</li>
                      <li>• Bandwidth limitations</li>
                      <li>• Single point of failure</li>
                      <li>• Privacy concerns</li>
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold">P2P File Sharing</h3>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center justify-center mb-2">
                        <Users className="w-8 h-8 text-green-600" />
                      </div>
                      <p className="text-sm text-center">Direct connection between sender and receiver</p>
                    </div>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• No server storage needed</li>
                      <li>• Maximum transfer speeds</li>
                      <li>• Decentralized architecture</li>
                      <li>• Enhanced privacy</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="network" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Network Status
                </CardTitle>
                <CardDescription>Current P2P network information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">12</div>
                    <div className="text-sm text-gray-600">Active Peers</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">5</div>
                    <div className="text-sm text-gray-600">Active Transfers</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">847</div>
                    <div className="text-sm text-gray-600">Files Shared Today</div>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-semibold mb-3">Connection Types</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">WebRTC Direct</span>
                      <Badge variant="secondary">8 connections</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">TURN Relay</span>
                      <Badge variant="secondary">3 connections</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">STUN Assisted</span>
                      <Badge variant="secondary">1 connection</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Features
                </CardTitle>
                <CardDescription>How we protect your files and privacy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">End-to-End Encryption</h4>
                    <p className="text-sm text-gray-600">
                      Files are encrypted before leaving your device and only decrypted by the recipient
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">No Server Storage</h4>
                    <p className="text-sm text-gray-600">
                      Files never touch our servers - they go directly between devices
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">Temporary Links</h4>
                    <p className="text-sm text-gray-600">
                      Share links expire automatically to prevent unauthorized access
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">Identity Verification</h4>
                    <p className="text-sm text-gray-600">Cryptographic signatures ensure file authenticity</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Performance Metrics
                </CardTitle>
                <CardDescription>Real-time performance data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3">Transfer Speeds</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Average Speed</span>
                          <span>15.2 MB/s</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: "76%" }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Peak Speed</span>
                          <span>45.8 MB/s</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: "92%" }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Connection Quality</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Latency</span>
                        <Badge variant="secondary">23ms</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Packet Loss</span>
                        <Badge variant="secondary">0.1%</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Connection Success Rate</span>
                        <Badge variant="secondary">98.7%</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-center mt-8">
          <Button asChild>
            <a href="/">← Back to File Sharing</a>
          </Button>
        </div>
      </div>
    </div>
  )
}
