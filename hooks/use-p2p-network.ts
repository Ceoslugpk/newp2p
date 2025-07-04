"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface Peer {
  id: string
  connection: RTCPeerConnection | null
  dataChannel: RTCDataChannel | null
  status: "connecting" | "connected" | "disconnected" | "failed"
}

interface FileTransfer {
  id: string
  fileName: string
  fileSize: number
  progress: number
  status: "pending" | "transferring" | "completed" | "failed"
  peerId: string
}

interface UseP2PNetworkReturn {
  peers: Map<string, Peer>
  isConnected: boolean
  connectionStatus: string
  fileTransfers: FileTransfer[]
  shareFile: (file: File) => Promise<string>
  requestFile: (shareId: string) => Promise<void>
  sendMessage: (peerId: string, message: any) => void
  connect: () => void
  disconnect: () => void
}

const SIGNALING_SERVER_URL = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || "wss://localhost:8080"

// TURN servers configuration
const TURN_SERVERS = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
  {
    urls: "stun:stun1.l.google.com:19302",
  },
]

export function useP2PNetwork(): UseP2PNetworkReturn {
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map())
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("Disconnected")
  const [fileTransfers, setFileTransfers] = useState<FileTransfer[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const localPeerIdRef = useRef<string>("")
  const sharedFilesRef = useRef<Map<string, File>>(new Map())

  // Create peer connection with TURN servers
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: TURN_SERVERS,
    })

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState)
    }

    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState)
    }

    return pc
  }, [])

  // Connect to signaling server
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setConnectionStatus("Connecting...")

    try {
      const ws = new WebSocket(SIGNALING_SERVER_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("Connected to signaling server")
        setIsConnected(true)
        setConnectionStatus("Connected")
      }

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data)
          await handleSignalingMessage(message)
        } catch (error) {
          console.error("Error handling signaling message:", error)
        }
      }

      ws.onclose = () => {
        console.log("Disconnected from signaling server")
        setIsConnected(false)
        setConnectionStatus("Disconnected")

        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            connect()
          }
        }, 5000)
      }

      ws.onerror = (error) => {
        console.error("WebSocket error:", error)
        setConnectionStatus("Connection Error")
      }
    } catch (error) {
      console.error("Failed to connect to signaling server:", error)
      setConnectionStatus("Connection Failed")
    }
  }, [])

  // Handle signaling messages
  const handleSignalingMessage = useCallback(async (message: any) => {
    switch (message.type) {
      case "peer-id":
        localPeerIdRef.current = message.peerId
        console.log("Received peer ID:", message.peerId)
        break

      case "offer":
        await handleOffer(message)
        break

      case "answer":
        await handleAnswer(message)
        break

      case "ice-candidate":
        await handleIceCandidate(message)
        break

      case "file-request":
        handleFileRequest(message)
        break

      case "file-response":
        handleFileResponse(message)
        break

      case "file-not-found":
        console.log("File not found:", message.shareId)
        break

      default:
        console.log("Unknown message type:", message.type)
    }
  }, [])

  // Handle WebRTC offer
  const handleOffer = useCallback(
    async (message: any) => {
      const pc = createPeerConnection()

      // Set up data channel handlers
      pc.ondatachannel = (event) => {
        const dataChannel = event.channel
        setupDataChannel(dataChannel, message.fromPeerId)
      }

      // Set up ICE candidate handling
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: "ice-candidate",
              candidate: event.candidate,
              targetPeerId: message.fromPeerId,
            }),
          )
        }
      }

      try {
        await pc.setRemoteDescription(message.offer)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        // Send answer
        if (wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: "answer",
              answer: answer,
              targetPeerId: message.fromPeerId,
            }),
          )
        }

        // Update peers
        setPeers((prev) => {
          const newPeers = new Map(prev)
          newPeers.set(message.fromPeerId, {
            id: message.fromPeerId,
            connection: pc,
            dataChannel: null,
            status: "connecting",
          })
          return newPeers
        })
      } catch (error) {
        console.error("Error handling offer:", error)
      }
    },
    [createPeerConnection],
  )

  // Handle WebRTC answer
  const handleAnswer = useCallback(
    async (message: any) => {
      const peer = peers.get(message.fromPeerId)
      if (peer?.connection) {
        try {
          await peer.connection.setRemoteDescription(message.answer)
        } catch (error) {
          console.error("Error handling answer:", error)
        }
      }
    },
    [peers],
  )

  // Handle ICE candidate
  const handleIceCandidate = useCallback(
    async (message: any) => {
      const peer = peers.get(message.fromPeerId)
      if (peer?.connection) {
        try {
          await peer.connection.addIceCandidate(message.candidate)
        } catch (error) {
          console.error("Error adding ICE candidate:", error)
        }
      }
    },
    [peers],
  )

  // Set up data channel
  const setupDataChannel = useCallback((dataChannel: RTCDataChannel, peerId: string) => {
    dataChannel.onopen = () => {
      console.log("Data channel opened with peer:", peerId)
      setPeers((prev) => {
        const newPeers = new Map(prev)
        const peer = newPeers.get(peerId)
        if (peer) {
          peer.dataChannel = dataChannel
          peer.status = "connected"
        }
        return newPeers
      })
    }

    dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleDataChannelMessage(data, peerId)
      } catch (error) {
        // Handle binary data (file chunks)
        handleFileChunk(event.data, peerId)
      }
    }

    dataChannel.onclose = () => {
      console.log("Data channel closed with peer:", peerId)
      setPeers((prev) => {
        const newPeers = new Map(prev)
        const peer = newPeers.get(peerId)
        if (peer) {
          peer.status = "disconnected"
        }
        return newPeers
      })
    }

    dataChannel.onerror = (error) => {
      console.error("Data channel error with peer:", peerId, error)
    }
  }, [])

  // Handle data channel messages
  const handleDataChannelMessage = useCallback((data: any, peerId: string) => {
    switch (data.type) {
      case "file-info":
        // Handle file transfer initiation
        console.log("Received file info from peer:", peerId, data)
        break

      case "file-chunk":
        // Handle file chunk
        handleFileChunk(data.chunk, peerId)
        break

      default:
        console.log("Unknown data channel message:", data)
    }
  }, [])

  // Handle file chunks
  const handleFileChunk = useCallback((chunk: ArrayBuffer, peerId: string) => {
    // Implementation for handling file chunks
    console.log("Received file chunk from peer:", peerId, chunk.byteLength, "bytes")
  }, [])

  // Handle file request
  const handleFileRequest = useCallback((message: any) => {
    const file = sharedFilesRef.current.get(message.shareId)

    if (file && wsRef.current) {
      // Send file response
      wsRef.current.send(
        JSON.stringify({
          type: "file-response",
          shareId: message.shareId,
          available: true,
          requesterPeerId: message.requesterPeerId,
          fileInfo: {
            name: file.name,
            size: file.size,
            type: file.type,
          },
        }),
      )
    }
  }, [])

  // Handle file response
  const handleFileResponse = useCallback(async (message: any) => {
    if (message.available) {
      // Initiate P2P connection with file provider
      await initiateConnection(message.providerPeerId)
    }
  }, [])

  // Initiate P2P connection
  const initiateConnection = useCallback(
    async (targetPeerId: string) => {
      const pc = createPeerConnection()

      // Create data channel
      const dataChannel = pc.createDataChannel("fileTransfer", {
        ordered: true,
      })

      setupDataChannel(dataChannel, targetPeerId)

      // Set up ICE candidate handling
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: "ice-candidate",
              candidate: event.candidate,
              targetPeerId: targetPeerId,
            }),
          )
        }
      }

      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        // Send offer
        if (wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: "offer",
              offer: offer,
              targetPeerId: targetPeerId,
            }),
          )
        }

        // Update peers
        setPeers((prev) => {
          const newPeers = new Map(prev)
          newPeers.set(targetPeerId, {
            id: targetPeerId,
            connection: pc,
            dataChannel: dataChannel,
            status: "connecting",
          })
          return newPeers
        })
      } catch (error) {
        console.error("Error initiating connection:", error)
      }
    },
    [createPeerConnection, setupDataChannel],
  )

  // Share a file
  const shareFile = useCallback(async (file: File): Promise<string> => {
    const shareId = Math.random().toString(36).substr(2, 9)
    sharedFilesRef.current.set(shareId, file)

    console.log("File shared with ID:", shareId)
    return shareId
  }, [])

  // Request a file
  const requestFile = useCallback(async (shareId: string) => {
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "file-request",
          shareId: shareId,
        }),
      )
    }
  }, [])

  // Send message to peer
  const sendMessage = useCallback(
    (peerId: string, message: any) => {
      const peer = peers.get(peerId)
      if (peer?.dataChannel?.readyState === "open") {
        peer.dataChannel.send(JSON.stringify(message))
      }
    },
    [peers],
  )

  // Disconnect from network
  const disconnect = useCallback(() => {
    // Close all peer connections
    peers.forEach((peer) => {
      peer.connection?.close()
    })

    // Close WebSocket connection
    wsRef.current?.close()

    // Reset state
    setPeers(new Map())
    setIsConnected(false)
    setConnectionStatus("Disconnected")
    sharedFilesRef.current.clear()
  }, [peers])

  // Auto-connect on mount
  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    peers,
    isConnected,
    connectionStatus,
    fileTransfers,
    shareFile,
    requestFile,
    sendMessage,
    connect,
    disconnect,
  }
}
