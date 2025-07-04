const WebSocket = require("ws")
const fs = require("fs")
const path = require("path")

// Configuration
const PORT = process.env.PORT || 8080
const LOG_DIR = path.join(__dirname, "../logs")

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

// Logging function
function log(message) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`

  console.log(logMessage.trim())

  // Write to log file
  fs.appendFileSync(path.join(LOG_DIR, "signaling.log"), logMessage)
}

// Create WebSocket server
const wss = new WebSocket.Server({
  port: PORT,
  path: "/ws",
})

// Store connected peers
const peers = new Map()
const rooms = new Map()

log(`Signaling server starting on port ${PORT}`)

wss.on("connection", (ws, req) => {
  const clientIP = req.socket.remoteAddress
  const peerId = generatePeerId()

  log(`New peer connected: ${peerId} from ${clientIP}`)

  // Store peer connection
  peers.set(peerId, {
    ws: ws,
    id: peerId,
    ip: clientIP,
    connectedAt: new Date(),
    rooms: new Set(),
  })

  // Send peer ID to client
  ws.send(
    JSON.stringify({
      type: "peer-id",
      peerId: peerId,
    }),
  )

  // Handle messages
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString())
      handleMessage(peerId, message)
    } catch (error) {
      log(`Error parsing message from ${peerId}: ${error.message}`)
    }
  })

  // Handle disconnection
  ws.on("close", () => {
    log(`Peer disconnected: ${peerId}`)

    const peer = peers.get(peerId)
    if (peer) {
      // Leave all rooms
      peer.rooms.forEach((roomId) => {
        leaveRoom(peerId, roomId)
      })

      // Remove peer
      peers.delete(peerId)
    }
  })

  // Handle errors
  ws.on("error", (error) => {
    log(`WebSocket error for peer ${peerId}: ${error.message}`)
  })
})

// Generate unique peer ID
function generatePeerId() {
  return Math.random().toString(36).substr(2, 9)
}

// Handle incoming messages
function handleMessage(peerId, message) {
  const peer = peers.get(peerId)
  if (!peer) {
    log(`Message from unknown peer: ${peerId}`)
    return
  }

  log(`Message from ${peerId}: ${message.type}`)

  switch (message.type) {
    case "join-room":
      joinRoom(peerId, message.roomId)
      break

    case "leave-room":
      leaveRoom(peerId, message.roomId)
      break

    case "offer":
    case "answer":
    case "ice-candidate":
      relayMessage(peerId, message)
      break

    case "file-request":
      handleFileRequest(peerId, message)
      break

    case "file-response":
      handleFileResponse(peerId, message)
      break

    case "ping":
      peer.ws.send(JSON.stringify({ type: "pong" }))
      break

    default:
      log(`Unknown message type from ${peerId}: ${message.type}`)
  }
}

// Join a room
function joinRoom(peerId, roomId) {
  const peer = peers.get(peerId)
  if (!peer) return

  // Create room if it doesn't exist
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set())
  }

  const room = rooms.get(roomId)
  room.add(peerId)
  peer.rooms.add(roomId)

  log(`Peer ${peerId} joined room ${roomId}`)

  // Notify other peers in the room
  const otherPeers = Array.from(room).filter((id) => id !== peerId)

  peer.ws.send(
    JSON.stringify({
      type: "room-joined",
      roomId: roomId,
      peers: otherPeers,
    }),
  )

  // Notify other peers about new peer
  otherPeers.forEach((otherPeerId) => {
    const otherPeer = peers.get(otherPeerId)
    if (otherPeer) {
      otherPeer.ws.send(
        JSON.stringify({
          type: "peer-joined",
          roomId: roomId,
          peerId: peerId,
        }),
      )
    }
  })
}

// Leave a room
function leaveRoom(peerId, roomId) {
  const peer = peers.get(peerId)
  if (!peer) return

  const room = rooms.get(roomId)
  if (room) {
    room.delete(peerId)
    peer.rooms.delete(roomId)

    log(`Peer ${peerId} left room ${roomId}`)

    // Notify other peers
    room.forEach((otherPeerId) => {
      const otherPeer = peers.get(otherPeerId)
      if (otherPeer) {
        otherPeer.ws.send(
          JSON.stringify({
            type: "peer-left",
            roomId: roomId,
            peerId: peerId,
          }),
        )
      }
    })

    // Remove room if empty
    if (room.size === 0) {
      rooms.delete(roomId)
      log(`Room ${roomId} removed (empty)`)
    }
  }
}

// Relay message to target peer
function relayMessage(fromPeerId, message) {
  const targetPeer = peers.get(message.targetPeerId)

  if (targetPeer) {
    targetPeer.ws.send(
      JSON.stringify({
        ...message,
        fromPeerId: fromPeerId,
      }),
    )

    log(`Relayed ${message.type} from ${fromPeerId} to ${message.targetPeerId}`)
  } else {
    log(`Target peer not found: ${message.targetPeerId}`)

    // Notify sender that target is not available
    const senderPeer = peers.get(fromPeerId)
    if (senderPeer) {
      senderPeer.ws.send(
        JSON.stringify({
          type: "error",
          message: "Target peer not found",
          targetPeerId: message.targetPeerId,
        }),
      )
    }
  }
}

// Handle file request
function handleFileRequest(peerId, message) {
  log(`File request from ${peerId} for share ${message.shareId}`)

  // Find peer with the requested file
  const targetPeer = findPeerWithFile(message.shareId)

  if (targetPeer) {
    targetPeer.ws.send(
      JSON.stringify({
        type: "file-request",
        shareId: message.shareId,
        requesterPeerId: peerId,
      }),
    )

    log(`File request forwarded to ${targetPeer.id}`)
  } else {
    // File not found
    const requesterPeer = peers.get(peerId)
    if (requesterPeer) {
      requesterPeer.ws.send(
        JSON.stringify({
          type: "file-not-found",
          shareId: message.shareId,
        }),
      )
    }

    log(`File not found for share ${message.shareId}`)
  }
}

// Handle file response
function handleFileResponse(peerId, message) {
  const requesterPeer = peers.get(message.requesterPeerId)

  if (requesterPeer) {
    requesterPeer.ws.send(
      JSON.stringify({
        type: "file-response",
        shareId: message.shareId,
        available: message.available,
        providerPeerId: peerId,
        fileInfo: message.fileInfo,
      }),
    )

    log(`File response sent to ${message.requesterPeerId}`)
  }
}

// Find peer with specific file
function findPeerWithFile(shareId) {
  // This is a simplified implementation
  // In a real system, you'd maintain a registry of shared files
  for (const [peerId, peer] of peers) {
    // For now, we'll assume any connected peer might have the file
    // This should be replaced with actual file registry logic
    return peer
  }
  return null
}

// Health check endpoint
wss.on("listening", () => {
  log(`Signaling server listening on port ${PORT}`)

  // Start periodic cleanup
  setInterval(cleanupInactivePeers, 30000) // Every 30 seconds

  // Start statistics logging
  setInterval(logStatistics, 60000) // Every minute
})

// Cleanup inactive peers
function cleanupInactivePeers() {
  const now = new Date()
  const timeout = 5 * 60 * 1000 // 5 minutes

  for (const [peerId, peer] of peers) {
    if (now - peer.connectedAt > timeout && peer.ws.readyState !== WebSocket.OPEN) {
      log(`Cleaning up inactive peer: ${peerId}`)

      // Leave all rooms
      peer.rooms.forEach((roomId) => {
        leaveRoom(peerId, roomId)
      })

      // Remove peer
      peers.delete(peerId)
    }
  }
}

// Log statistics
function logStatistics() {
  const stats = {
    connectedPeers: peers.size,
    activeRooms: rooms.size,
    totalRoomMembers: Array.from(rooms.values()).reduce((sum, room) => sum + room.size, 0),
  }

  log(`Statistics: ${JSON.stringify(stats)}`)
}

// Handle server shutdown
process.on("SIGTERM", () => {
  log("Received SIGTERM, shutting down gracefully")

  // Close all connections
  peers.forEach((peer, peerId) => {
    peer.ws.close()
  })

  wss.close(() => {
    log("Signaling server shut down")
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  log("Received SIGINT, shutting down gracefully")

  // Close all connections
  peers.forEach((peer, peerId) => {
    peer.ws.close()
  })

  wss.close(() => {
    log("Signaling server shut down")
    process.exit(0)
  })
})

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  log(`Uncaught exception: ${error.message}`)
  log(error.stack)
})

process.on("unhandledRejection", (reason, promise) => {
  log(`Unhandled rejection at: ${promise}, reason: ${reason}`)
})

log("Signaling server initialized")
