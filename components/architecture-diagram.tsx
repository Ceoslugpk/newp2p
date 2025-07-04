"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Globe, Monitor, Smartphone, Network, Shield, Database, Cloud, ArrowRight, ArrowDown } from "lucide-react"

export default function ArchitectureDiagram() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>P2P File Sharing Architecture</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {/* Client Layer */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Client Applications
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold">Web Client</h4>
                </div>
                <ul className="text-sm space-y-1">
                  <li>• React + TypeScript</li>
                  <li>• WebRTC Data Channels</li>
                  <li>• Web Crypto API</li>
                  <li>• Service Workers</li>
                  <li>• Progressive Web App</li>
                </ul>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold">Desktop Client</h4>
                </div>
                <ul className="text-sm space-y-1">
                  <li>• Tauri (Rust + Web)</li>
                  <li>• Native P2P protocols</li>
                  <li>• File system integration</li>
                  <li>• Background processing</li>
                  <li>• System notifications</li>
                </ul>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="w-5 h-5 text-purple-600" />
                  <h4 className="font-semibold">Mobile Client</h4>
                </div>
                <ul className="text-sm space-y-1">
                  <li>• React Native</li>
                  <li>• Limited P2P support</li>
                  <li>• Battery optimization</li>
                  <li>• Push notifications</li>
                  <li>• File picker integration</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Arrow Down */}
          <div className="flex justify-center">
            <ArrowDown className="w-6 h-6 text-gray-400" />
          </div>

          {/* P2P Network Layer */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Network className="w-5 h-5" />
              P2P Network Layer
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
                <h4 className="font-semibold mb-2">Peer Discovery</h4>
                <ul className="text-sm space-y-1">
                  <li>• Distributed Hash Table (DHT)</li>
                  <li>• Kademlia routing protocol</li>
                  <li>• Bootstrap node network</li>
                  <li>• Peer reputation system</li>
                  <li>• NAT traversal (STUN/TURN)</li>
                </ul>
              </div>

              <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
                <h4 className="font-semibold mb-2">Data Transfer</h4>
                <ul className="text-sm space-y-1">
                  <li>• WebRTC data channels</li>
                  <li>• File chunking & verification</li>
                  <li>• Parallel multi-peer downloads</li>
                  <li>• Rarest-first piece selection</li>
                  <li>• Bandwidth optimization</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Arrow Down */}
          <div className="flex justify-center">
            <ArrowDown className="w-6 h-6 text-gray-400" />
          </div>

          {/* Infrastructure Layer */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Cloud className="w-5 h-5" />
              Minimal Infrastructure
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Network className="w-4 h-4" />
                  <h5 className="font-medium text-sm">Signaling Server</h5>
                </div>
                <ul className="text-xs space-y-1">
                  <li>• WebSocket connections</li>
                  <li>• Peer coordination</li>
                  <li>• ICE candidate exchange</li>
                  <li>• Connection establishment</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4" />
                  <h5 className="font-medium text-sm">STUN/TURN</h5>
                </div>
                <ul className="text-xs space-y-1">
                  <li>• NAT type detection</li>
                  <li>• Public IP discovery</li>
                  <li>• Relay fallback</li>
                  <li>• Connection assistance</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4" />
                  <h5 className="font-medium text-sm">Bootstrap Nodes</h5>
                </div>
                <ul className="text-xs space-y-1">
                  <li>• DHT seed nodes</li>
                  <li>• Initial peer discovery</li>
                  <li>• Network health monitoring</li>
                  <li>• Peer list maintenance</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4" />
                  <h5 className="font-medium text-sm">Web Hosting</h5>
                </div>
                <ul className="text-xs space-y-1">
                  <li>• Static site hosting</li>
                  <li>• Global CDN</li>
                  <li>• SSL/TLS certificates</li>
                  <li>• Progressive Web App</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Data Flow */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Data Flow Process</h3>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
              {[
                { step: "1", title: "File Upload", desc: "User selects file" },
                { step: "2", title: "Chunking", desc: "File split into pieces" },
                { step: "3", title: "Encryption", desc: "AES-256 encryption" },
                { step: "4", title: "Share Link", desc: "Generate secure link" },
                { step: "5", title: "Peer Discovery", desc: "Find available peers" },
                { step: "6", title: "Transfer", desc: "P2P data transfer" },
              ].map((item, index) => (
                <div key={index} className="text-center">
                  <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto mb-2 text-sm font-semibold">
                    {item.step}
                  </div>
                  <h5 className="font-medium text-sm">{item.title}</h5>
                  <p className="text-xs text-gray-600">{item.desc}</p>
                  {index < 5 && <ArrowRight className="w-4 h-4 text-gray-400 mx-auto mt-2 hidden md:block" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
