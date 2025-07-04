const WebSocket = require("ws")
const fs = require("fs")
const path = require("path")

const PORT = process.env.PORT || 8080
const LOG_DIR = path.join(__dirname, "..", "logs")

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

// Store active connections
const connections = new Map()
const rooms = new Map()

wss.on("connection", (ws, req) => {
  const clientId = generateId()
  connections.set(clientId, ws)

  log(`Client ${clientId} connected from ${req.socket.remoteAddress}`)

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString())
      handleMessage(clientId, message)
    } catch (error) {
      log(`Error parsing message from ${clientId}: ${error.message}`)
    }
  })

  ws.on("close", () => {
    log(`Client ${clientId} disconnected`)
    connections.delete(clientId)

    // Remove from all rooms
    for (const [roomId, clients] of rooms.entries()) {
      if (clients.has(clientId)) {
        clients.delete(clientId)
        if (clients.size === 0) {
          rooms.delete(roomId)
        } else {
          // Notify other clients in room
          broadcastToRoom(
            roomId,
            {
              type: "peer-disconnected",
              peerId: clientId,
            },
            clientId,
          )
        }
      }
    }
  })

  ws.on("error", (error) => {
    log(`WebSocket error for client ${clientId}: ${error.message}`)
  })

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "connected",
      clientId: clientId,
    }),
  )
})

function handleMessage(clientId, message) {
  log(`Message from ${clientId}: ${message.type}`)

  switch (message.type) {
    case "join-room":
      joinRoom(clientId, message.roomId)
      break

    case "leave-room":
      leaveRoom(clientId, message.roomId)
      break

    case "offer":
    case "answer":
    case "ice-candidate":
      relayMessage(clientId, message)
      break

    case "file-request":
      handleFileRequest(clientId, message)
      break

    case "file-response":
      handleFileResponse(clientId, message)
      break

    default:
      log(`Unknown message type: ${message.type}`)
  }
}

function joinRoom(clientId, roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set())
  }

  const room = rooms.get(roomId)
  room.add(clientId)

  log(`Client ${clientId} joined room ${roomId}`)

  // Send list of existing peers
  const peers = Array.from(room).filter((id) => id !== clientId)
  const ws = connections.get(clientId)

  if (ws) {
    ws.send(
      JSON.stringify({
        type: "room-joined",
        roomId: roomId,
        peers: peers,
      }),
    )

    // Notify other peers
    broadcastToRoom(
      roomId,
      {
        type: "peer-joined",
        peerId: clientId,
      },
      clientId,
    )
  }
}

function leaveRoom(clientId, roomId) {
  if (rooms.has(roomId)) {
    const room = rooms.get(roomId)
    room.delete(clientId)

    if (room.size === 0) {
      rooms.delete(roomId)
    } else {
      broadcastToRoom(
        roomId,
        {
          type: "peer-left",
          peerId: clientId,
        },
        clientId,
      )
    }

    log(`Client ${clientId} left room ${roomId}`)
  }
}

function relayMessage(fromClientId, message) {
  const targetId = message.targetId
  const targetWs = connections.get(targetId)

  if (targetWs) {
    targetWs.send(
      JSON.stringify({
        ...message,
        fromId: fromClientId,
      }),
    )
  } else {
    log(`Target client ${targetId} not found for relay`)
  }
}

function handleFileRequest(clientId, message) {
  log(`File request from ${clientId} for share ${message.shareId}`)

  // Broadcast file request to all peers in the room
  const roomId = message.roomId || "global"
  broadcastToRoom(
    roomId,
    {
      type: "file-request",
      shareId: message.shareId,
      requesterId: clientId,
    },
    clientId,
  )
}

function handleFileResponse(clientId, message) {
  log(`File response from ${clientId} for share ${message.shareId}`)

  // Send response to requester
  const requesterWs = connections.get(message.requesterId)
  if (requesterWs) {
    requesterWs.send(
      JSON.stringify({
        type: "file-response",
        shareId: message.shareId,
        providerId: clientId,
        available: message.available,
        fileInfo: message.fileInfo,
      }),
    )
  }
}

function broadcastToRoom(roomId, message, excludeId = null) {
  if (rooms.has(roomId)) {
    const room = rooms.get(roomId)
    for (const clientId of room) {
      if (clientId !== excludeId) {
        const ws = connections.get(clientId)
        if (ws) {
          ws.send(JSON.stringify(message))
        }
      }
    }
  }
}

function generateId() {
  return Math.random().toString(36).substr(2, 9)
}

log(`Signaling server started on port ${PORT}`)

// Health check endpoint
const http = require("http")
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        status: "healthy",
        connections: connections.size,
        rooms: rooms.size,
        timestamp: new Date().toISOString(),
      }),
    )
  } else {
    res.writeHead(404)
    res.end("Not Found")
  }
})

server.listen(PORT + 1, () => {
  log(`Health check server started on port ${PORT + 1}`)
})
