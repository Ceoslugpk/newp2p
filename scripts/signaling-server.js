// Enhanced WebSocket Signaling Server with TURN support
const WebSocket = require("ws")
const crypto = require("crypto")

class SignalingServer {
  constructor(port = 8080) {
    this.port = port
    this.peers = new Map() // peerId -> { ws, region, lastSeen, files }
    this.fileShares = new Map() // shareId -> { peerId, metadata, created }

    this.wss = new WebSocket.Server({
      port: this.port,
      perMessageDeflate: false,
    })

    this.setupServer()
    console.log(`🚀 P2P Signaling Server running on port ${this.port}`)
    console.log(`📡 TURN-enabled WebRTC signaling active`)
  }

  setupServer() {
    this.wss.on("connection", (ws, req) => {
      const clientIP = req.socket.remoteAddress
      console.log(`🔗 New peer connection from ${clientIP}`)

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString())
          this.handleMessage(ws, message)
        } catch (error) {
          console.error("❌ Invalid message format:", error)
          this.sendError(ws, "Invalid message format")
        }
      })

      ws.on("close", () => {
        this.handleDisconnection(ws)
      })

      ws.on("error", (error) => {
        console.error("❌ WebSocket error:", error)
      })

      // Send welcome with TURN server info
      this.send(ws, {
        type: "welcome",
        message: "Connected to TURN-enabled P2P signaling server",
        turnServers: [
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
      })
    })

    // Cleanup inactive peers every 30 seconds
    setInterval(() => {
      this.cleanupInactivePeers()
    }, 30000)

    // Log server stats every 5 minutes
    setInterval(() => {
      this.logStats()
    }, 300000)
  }

  handleMessage(ws, message) {
    switch (message.type) {
      case "register":
        this.handleRegister(ws, message)
        break
      case "discover-peers":
        this.handleDiscoverPeers(ws, message)
        break
      case "offer":
        this.handleOffer(ws, message)
        break
      case "answer":
        this.handleAnswer(ws, message)
        break
      case "ice-candidate":
        this.handleIceCandidate(ws, message)
        break
      case "share-file":
        this.handleShareFile(ws, message)
        break
      case "find-file":
        this.handleFindFile(ws, message)
        break
      case "file-request":
        this.handleFileRequest(ws, message)
        break
      case "heartbeat":
        this.handleHeartbeat(ws, message)
        break
      default:
        console.log("❓ Unknown message type:", message.type)
        this.sendError(ws, "Unknown message type")
    }
  }

  handleRegister(ws, message) {
    const { peerId, region } = message

    if (!peerId || !region) {
      this.sendError(ws, "Missing peerId or region")
      return
    }

    // Store peer information
    this.peers.set(peerId, {
      ws,
      region,
      lastSeen: Date.now(),
      files: new Set(),
    })

    ws.peerId = peerId

    console.log(`✅ Peer ${peerId} registered from region ${region}`)

    this.send(ws, {
      type: "registered",
      peerId,
      peerCount: this.peers.size,
      turnEnabled: true,
    })
  }

  handleDiscoverPeers(ws, message) {
    const { peerId } = message
    const peer = this.peers.get(peerId)

    if (!peer) {
      this.sendError(ws, "Peer not registered")
      return
    }

    // Get list of other peers, prioritizing same region
    const otherPeers = Array.from(this.peers.entries())
      .filter(([id, _]) => id !== peerId)
      .map(([id, peerData]) => ({
        id,
        region: peerData.region,
        sameRegion: peerData.region === peer.region,
        lastSeen: peerData.lastSeen,
      }))
      .sort((a, b) => {
        // Prioritize same region and recently active peers
        if (a.sameRegion && !b.sameRegion) return -1
        if (!a.sameRegion && b.sameRegion) return 1
        return b.lastSeen - a.lastSeen
      })
      .slice(0, 20) // Limit to 20 peers
      .map((p) => p.id)

    console.log(`🔍 Peer discovery for ${peerId}: found ${otherPeers.length} peers`)

    this.send(ws, {
      type: "peer-list",
      peers: otherPeers,
    })
  }

  handleOffer(ws, message) {
    const { from, to, offer } = message
    const targetPeer = this.peers.get(to)

    if (!targetPeer) {
      this.sendError(ws, "Target peer not found")
      return
    }

    console.log(`📤 Relaying offer from ${from} to ${to}`)

    this.send(targetPeer.ws, {
      type: "offer",
      from,
      to,
      offer,
    })
  }

  handleAnswer(ws, message) {
    const { from, to, answer } = message
    const targetPeer = this.peers.get(to)

    if (!targetPeer) {
      this.sendError(ws, "Target peer not found")
      return
    }

    console.log(`📥 Relaying answer from ${from} to ${to}`)

    this.send(targetPeer.ws, {
      type: "answer",
      from,
      to,
      answer,
    })
  }

  handleIceCandidate(ws, message) {
    const { from, to, candidate } = message
    const targetPeer = this.peers.get(to)

    if (!targetPeer) {
      this.sendError(ws, "Target peer not found")
      return
    }

    // Log TURN relay candidates
    if (candidate && candidate.candidate && candidate.candidate.includes("relay")) {
      console.log(`🔄 TURN relay candidate from ${from} to ${to}`)
    }

    this.send(targetPeer.ws, {
      type: "ice-candidate",
      from,
      to,
      candidate,
    })
  }

  handleShareFile(ws, message) {
    const { peerId, shareId, metadata } = message
    const peer = this.peers.get(peerId)

    if (!peer) {
      this.sendError(ws, "Peer not registered")
      return
    }

    // Store file share information
    this.fileShares.set(shareId, {
      peerId,
      metadata,
      created: Date.now(),
    })

    // Add to peer's file list
    peer.files.add(shareId)

    console.log(`📁 File ${metadata.name} shared by peer ${peerId} (${shareId})`)

    this.send(ws, {
      type: "file-shared",
      shareId,
      message: "File successfully shared",
    })

    // Notify other peers about new file
    this.broadcast(
      {
        type: "file-available",
        shareId,
        metadata,
        peerId,
      },
      peerId,
    )
  }

  handleFindFile(ws, message) {
    const { shareId } = message
    const fileShare = this.fileShares.get(shareId)

    if (!fileShare) {
      this.send(ws, {
        type: "file-not-found",
        shareId,
      })
      return
    }

    // Check if the sharing peer is still online
    const sharingPeer = this.peers.get(fileShare.peerId)
    if (!sharingPeer) {
      this.fileShares.delete(shareId)
      this.send(ws, {
        type: "file-not-found",
        shareId,
        reason: "Sharing peer offline",
      })
      return
    }

    // Find other peers who might have the file
    const seeders = Array.from(this.peers.entries())
      .filter(([peerId, peer]) => peer.files.has(shareId))
      .map(([peerId, _]) => peerId)

    console.log(`🔍 File found: ${shareId}, ${seeders.length} seeders available`)

    this.send(ws, {
      type: "file-found",
      shareId,
      metadata: fileShare.metadata,
      seeders,
      created: fileShare.created,
    })
  }

  handleFileRequest(ws, message) {
    const { shareId, from } = message
    const fileShare = this.fileShares.get(shareId)

    if (fileShare) {
      const sharingPeer = this.peers.get(fileShare.peerId)
      if (sharingPeer) {
        console.log(`📋 File request for ${shareId} from ${from}`)
        this.send(sharingPeer.ws, {
          type: "file-request",
          shareId,
          from,
        })
      }
    }
  }

  handleHeartbeat(ws, message) {
    const { peerId } = message
    const peer = this.peers.get(peerId)

    if (peer) {
      peer.lastSeen = Date.now()
      this.send(ws, {
        type: "heartbeat-ack",
        timestamp: Date.now(),
      })
    }
  }

  handleDisconnection(ws) {
    if (ws.peerId) {
      console.log(`🔌 Peer ${ws.peerId} disconnected`)

      // Remove peer's file shares
      const peer = this.peers.get(ws.peerId)
      if (peer) {
        peer.files.forEach((shareId) => {
          const fileShare = this.fileShares.get(shareId)
          if (fileShare && fileShare.peerId === ws.peerId) {
            this.fileShares.delete(shareId)
            console.log(`🗑️ Removed file share: ${shareId}`)
          }
        })
      }

      // Remove peer
      this.peers.delete(ws.peerId)
    }
  }

  cleanupInactivePeers() {
    const now = Date.now()
    const timeout = 60000 // 1 minute timeout

    this.peers.forEach((peer, peerId) => {
      if (now - peer.lastSeen > timeout) {
        console.log(`🧹 Removing inactive peer ${peerId}`)

        // Close WebSocket connection
        if (peer.ws.readyState === WebSocket.OPEN) {
          peer.ws.close()
        }

        // Remove peer
        this.peers.delete(peerId)

        // Clean up file shares
        peer.files.forEach((shareId) => {
          const fileShare = this.fileShares.get(shareId)
          if (fileShare && fileShare.peerId === peerId) {
            this.fileShares.delete(shareId)
          }
        })
      }
    })

    // Clean up old file shares (24 hours)
    const fileTimeout = 24 * 60 * 60 * 1000
    this.fileShares.forEach((fileShare, shareId) => {
      if (now - fileShare.created > fileTimeout) {
        this.fileShares.delete(shareId)
      }
    })
  }

  logStats() {
    console.log("📊 === Server Statistics ===")
    console.log(`🔗 Connected peers: ${this.peers.size}`)
    console.log(`📁 Active file shares: ${this.fileShares.size}`)

    // Regional distribution
    const regions = {}
    this.peers.forEach((peer) => {
      regions[peer.region] = (regions[peer.region] || 0) + 1
    })
    console.log("🌍 Regional distribution:", regions)
    console.log("========================")
  }

  send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  sendError(ws, error) {
    this.send(ws, {
      type: "error",
      error,
    })
  }

  broadcast(message, excludePeerId = null) {
    this.peers.forEach((peer, peerId) => {
      if (peerId !== excludePeerId) {
        this.send(peer.ws, message)
      }
    })
  }
}

// Start the signaling server
const server = new SignalingServer(process.env.PORT || 8080)

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("🛑 Shutting down signaling server...")
  server.wss.close(() => {
    console.log("✅ Server closed")
    process.exit(0)
  })
})

module.exports = SignalingServer
