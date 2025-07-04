const WebSocket = require("ws")
const http = require("http")
const fs = require("fs")
const path = require("path")

// Configuration
const PORT = process.env.PORT || 8080
const NODE_ENV = process.env.NODE_ENV || "development"

// Logging setup
const logDir = path.join(__dirname, "..", "logs")
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

const logFile = path.join(logDir, "signaling-server.log")

function log(message, level = "INFO") {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] [${level}] ${message}\n`

  console.log(logMessage.trim())

  // Write to log file in production
  if (NODE_ENV === "production") {
    fs.appendFileSync(logFile, logMessage)
  }
}

function error(message) {
  log(message, "ERROR")
}

function warn(message) {
  log(message, "WARN")
}

function info(message) {
  log(message, "INFO")
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
        connections: wss.clients.size,
        uptime: process.uptime(),
      }),
    )
    return
  }

  // CORS headers for WebSocket upgrade
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  })
  res.end("P2P File Sharing Signaling Server")
})

// Create WebSocket server
const wss = new WebSocket.Server({
  server,
  path: "/ws",
  perMessageDeflate: false,
})

// Store active connections
const peers = new Map()
const rooms = new Map()

// Connection statistics
let totalConnections = 0
let activeConnections = 0

// Cleanup inactive connections
function cleanupConnections() {
  const now = Date.now()
  const timeout = 30000 // 30 seconds

  for (const [peerId, peer] of peers.entries()) {
    if (now - peer.lastSeen > timeout) {
      info(`Cleaning up inactive peer: ${peerId}`)
      peers.delete(peerId)

      // Remove from all rooms
      for (const [roomId, room] of rooms.entries()) {
        if (room.has(peerId)) {
          room.delete(peerId)
          if (room.size === 0) {
            rooms.delete(roomId)
          }
        }
      }
    }
  }
}

// Run cleanup every 30 seconds
setInterval(cleanupConnections, 30000)

// WebSocket connection handler
wss.on("connection", (ws, req) => {
  totalConnections++
  activeConnections++

  const clientIP = req.headers["x-forwarded-for"] || req.connection.remoteAddress
  info(`New connection from ${clientIP}. Total: ${activeConnections}`)

  let peerId = null
  let currentRoom = null

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "welcome",
      message: "Connected to P2P signaling server",
    }),
  )

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString())

      switch (message.type) {
        case "register":
          peerId = message.peerId
          peers.set(peerId, {
            ws: ws,
            lastSeen: Date.now(),
            ip: clientIP,
          })
          info(`Peer registered: ${peerId}`)

          // Send confirmation
          ws.send(
            JSON.stringify({
              type: "registered",
              peerId: peerId,
            }),
          )
          break

        case "join-room":
          if (!peerId) {
            error("Peer not registered")
            return
          }

          const roomId = message.roomId
          currentRoom = roomId

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set())
          }

          rooms.get(roomId).add(peerId)
          info(`Peer ${peerId} joined room ${roomId}`)

          // Notify other peers in the room
          const roomPeers = Array.from(rooms.get(roomId)).filter((id) => id !== peerId)
          ws.send(
            JSON.stringify({
              type: "room-joined",
              roomId: roomId,
              peers: roomPeers,
            }),
          )

          // Notify existing peers about new peer
          roomPeers.forEach((targetPeerId) => {
            const targetPeer = peers.get(targetPeerId)
            if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
              targetPeer.ws.send(
                JSON.stringify({
                  type: "peer-joined",
                  peerId: peerId,
                  roomId: roomId,
                }),
              )
            }
          })
          break

        case "offer":
        case "answer":
        case "ice-candidate":
          if (!peerId) {
            error("Peer not registered")
            return
          }

          const targetPeerId = message.targetPeerId
          const targetPeer = peers.get(targetPeerId)

          if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            targetPeer.ws.send(
              JSON.stringify({
                ...message,
                fromPeerId: peerId,
              }),
            )
            info(`Relayed ${message.type} from ${peerId} to ${targetPeerId}`)
          } else {
            warn(`Target peer ${targetPeerId} not found or disconnected`)
            ws.send(
              JSON.stringify({
                type: "error",
                message: `Peer ${targetPeerId} not available`,
              }),
            )
          }
          break

        case "file-request":
          if (!peerId) {
            error("Peer not registered")
            return
          }

          const shareId = message.shareId
          info(`File request for share ${shareId} from peer ${peerId}`)

          // Broadcast file request to all peers in all rooms
          let found = false
          for (const [roomId, room] of rooms.entries()) {
            for (const roomPeerId of room) {
              if (roomPeerId !== peerId) {
                const roomPeer = peers.get(roomPeerId)
                if (roomPeer && roomPeer.ws.readyState === WebSocket.OPEN) {
                  roomPeer.ws.send(
                    JSON.stringify({
                      type: "file-request",
                      shareId: shareId,
                      requesterId: peerId,
                    }),
                  )
                  found = true
                }
              }
            }
          }

          if (!found) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "No peers available to serve file",
              }),
            )
          }
          break

        case "file-available":
          if (!peerId) {
            error("Peer not registered")
            return
          }

          const requesterId = message.requesterId
          const requesterPeer = peers.get(requesterId)

          if (requesterPeer && requesterPeer.ws.readyState === WebSocket.OPEN) {
            requesterPeer.ws.send(
              JSON.stringify({
                type: "file-available",
                shareId: message.shareId,
                providerId: peerId,
                fileName: message.fileName,
                fileSize: message.fileSize,
              }),
            )
            info(`File available notification sent from ${peerId} to ${requesterId}`)
          }
          break

        case "ping":
          if (peerId) {
            peers.get(peerId).lastSeen = Date.now()
          }
          ws.send(JSON.stringify({ type: "pong" }))
          break

        default:
          warn(`Unknown message type: ${message.type}`)
      }
    } catch (err) {
      error(`Error processing message: ${err.message}`)
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
        }),
      )
    }
  })

  ws.on("close", (code, reason) => {
    activeConnections--
    info(`Connection closed from ${clientIP}. Code: ${code}, Reason: ${reason}. Active: ${activeConnections}`)

    if (peerId) {
      peers.delete(peerId)

      // Remove from rooms and notify other peers
      if (currentRoom && rooms.has(currentRoom)) {
        rooms.get(currentRoom).delete(peerId)

        // Notify other peers in the room
        for (const roomPeerId of rooms.get(currentRoom)) {
          const roomPeer = peers.get(roomPeerId)
          if (roomPeer && roomPeer.ws.readyState === WebSocket.OPEN) {
            roomPeer.ws.send(
              JSON.stringify({
                type: "peer-left",
                peerId: peerId,
                roomId: currentRoom,
              }),
            )
          }
        }

        // Clean up empty room
        if (rooms.get(currentRoom).size === 0) {
          rooms.delete(currentRoom)
        }
      }
    }
  })

  ws.on("error", (err) => {
    error(`WebSocket error from ${clientIP}: ${err.message}`)
  })

  // Send periodic ping to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping()
    } else {
      clearInterval(pingInterval)
    }
  }, 30000)
})

// Error handling
wss.on("error", (err) => {
  error(`WebSocket server error: ${err.message}`)
})

server.on("error", (err) => {
  error(`HTTP server error: ${err.message}`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  info("Received SIGTERM, shutting down gracefully")

  wss.clients.forEach((ws) => {
    ws.close(1000, "Server shutting down")
  })

  server.close(() => {
    info("Server closed")
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  info("Received SIGINT, shutting down gracefully")

  wss.clients.forEach((ws) => {
    ws.close(1000, "Server shutting down")
  })

  server.close(() => {
    info("Server closed")
    process.exit(0)
  })
})

// Start server
server.listen(PORT, "0.0.0.0", () => {
  info(`P2P Signaling Server started on port ${PORT}`)
  info(`Environment: ${NODE_ENV}`)
  info(`WebSocket endpoint: ws://localhost:${PORT}/ws`)
  info(`Health check: http://localhost:${PORT}/health`)
})

// Log server statistics every 5 minutes
setInterval(() => {
  info(
    `Server stats - Active connections: ${activeConnections}, Total connections: ${totalConnections}, Active rooms: ${rooms.size}`,
  )
}, 300000)
