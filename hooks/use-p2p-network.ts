"use client"

import { useState, useEffect, useRef, useCallback } from "react"

export interface PeerConnection {
  id: string
  connection: RTCPeerConnection
  dataChannel?: RTCDataChannel
  status: "connecting" | "connected" | "disconnected" | "failed"
}

export interface NetworkStatus {
  signaling: "connecting" | "connected" | "disconnected" | "error"
  peers: PeerConnection[]
  isOnline: boolean
}

export interface FileTransfer {
  id: string
  fileName: string
  fileSize: number
  progress: number
  status: "pending" | "transferring" | "completed" | "failed"
  peerId: string
}

export function useP2PNetwork() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    signaling: "disconnected",
    peers: [],
    isOnline: false,
  })

  const [transfers, setTransfers] = useState<FileTransfer[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const peersRef = useRef<Map<string, PeerConnection>>(new Map())
  const myPeerIdRef = useRef<string>("")
  const currentRoomRef = useRef<string>("")
  const pendingFilesRef = useRef<Map<string, File>>(new Map())

  // Generate unique peer ID
  const generatePeerId = useCallback(() => {
    return `peer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // ICE servers configuration with TURN servers
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
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
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ]

  // Create peer connection
  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
    })

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${peerId}:`, pc.iceConnectionState)

      setNetworkStatus((prev) => ({
        ...prev,
        peers: prev.peers.map((peer) =>
          peer.id === peerId
            ? {
                ...peer,
                status:
                  pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed"
                    ? "connected"
                    : pc.iceConnectionState === "failed"
                      ? "failed"
                      : "connecting",
              }
            : peer,
        ),
      }))
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "ice-candidate",
            targetPeerId: peerId,
            candidate: event.candidate,
          }),
        )
      }
    }

    return pc
  }, [])

  // Handle incoming data channel
  const handleDataChannel = useCallback((channel: RTCDataChannel, peerId: string) => {
    let receivedData: ArrayBuffer[] = []
    let expectedSize = 0
    let fileName = ""
    let transferId = ""

    channel.onopen = () => {
      console.log(`Data channel opened with ${peerId}`)
    }

    channel.onmessage = (event) => {
      if (typeof event.data === "string") {
        // Control message
        const message = JSON.parse(event.data)

        if (message.type === "file-info") {
          fileName = message.fileName
          expectedSize = message.fileSize
          transferId = message.transferId
          receivedData = []

          setTransfers((prev) => [
            ...prev,
            {
              id: transferId,
              fileName,
              fileSize: expectedSize,
              progress: 0,
              status: "transferring",
              peerId,
            },
          ])
        } else if (message.type === "file-end") {
          // Reconstruct file
          const blob = new Blob(receivedData)
          const url = URL.createObjectURL(blob)

          // Trigger download
          const a = document.createElement("a")
          a.href = url
          a.download = fileName
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)

          setTransfers((prev) =>
            prev.map((t) => (t.id === transferId ? { ...t, status: "completed", progress: 100 } : t)),
          )
        }
      } else {
        // File data chunk
        receivedData.push(event.data)
        const currentSize = receivedData.reduce((sum, chunk) => sum + chunk.byteLength, 0)
        const progress = expectedSize > 0 ? (currentSize / expectedSize) * 100 : 0

        setTransfers((prev) => prev.map((t) => (t.id === transferId ? { ...t, progress } : t)))
      }
    }

    channel.onerror = (error) => {
      console.error(`Data channel error with ${peerId}:`, error)
      setTransfers((prev) => prev.map((t) => (t.peerId === peerId ? { ...t, status: "failed" } : t)))
    }
  }, [])

  // Connect to signaling server
  const connectToSignaling = useCallback(() => {
    const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || "ws://localhost:8080/ws"

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setNetworkStatus((prev) => ({ ...prev, signaling: "connecting" }))

    try {
      wsRef.current = new WebSocket(signalingUrl)

      wsRef.current.onopen = () => {
        console.log("Connected to signaling server")
        setNetworkStatus((prev) => ({ ...prev, signaling: "connected", isOnline: true }))

        // Register with server
        myPeerIdRef.current = generatePeerId()
        wsRef.current?.send(
          JSON.stringify({
            type: "register",
            peerId: myPeerIdRef.current,
          }),
        )
      }

      wsRef.current.onmessage = async (event) => {
        const message = JSON.parse(event.data)

        switch (message.type) {
          case "welcome":
            console.log("Received welcome from signaling server")
            break

          case "registered":
            console.log("Registered with peer ID:", message.peerId)
            break

          case "peer-joined":
            console.log("Peer joined:", message.peerId)
            // Create offer for new peer
            const pc = createPeerConnection(message.peerId)
            peersRef.current.set(message.peerId, {
              id: message.peerId,
              connection: pc,
              status: "connecting",
            })

            // Create data channel
            const dataChannel = pc.createDataChannel("fileTransfer", {
              ordered: true,
            })

            peersRef.current.get(message.peerId)!.dataChannel = dataChannel

            // Set up data channel handlers
            handleDataChannel(dataChannel, message.peerId)

            // Create and send offer
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)

            wsRef.current?.send(
              JSON.stringify({
                type: "offer",
                targetPeerId: message.peerId,
                offer: offer,
              }),
            )

            setNetworkStatus((prev) => ({
              ...prev,
              peers: [
                ...prev.peers,
                {
                  id: message.peerId,
                  connection: pc,
                  dataChannel,
                  status: "connecting",
                },
              ],
            }))
            break

          case "offer":
            console.log("Received offer from:", message.fromPeerId)
            const answerPc = createPeerConnection(message.fromPeerId)
            peersRef.current.set(message.fromPeerId, {
              id: message.fromPeerId,
              connection: answerPc,
              status: "connecting",
            })

            // Handle incoming data channel
            answerPc.ondatachannel = (event) => {
              const channel = event.channel
              peersRef.current.get(message.fromPeerId)!.dataChannel = channel
              handleDataChannel(channel, message.fromPeerId)
            }

            await answerPc.setRemoteDescription(message.offer)
            const answer = await answerPc.createAnswer()
            await answerPc.setLocalDescription(answer)

            wsRef.current?.send(
              JSON.stringify({
                type: "answer",
                targetPeerId: message.fromPeerId,
                answer: answer,
              }),
            )

            setNetworkStatus((prev) => ({
              ...prev,
              peers: [
                ...prev.peers,
                {
                  id: message.fromPeerId,
                  connection: answerPc,
                  status: "connecting",
                },
              ],
            }))
            break

          case "answer":
            console.log("Received answer from:", message.fromPeerId)
            const peer = peersRef.current.get(message.fromPeerId)
            if (peer) {
              await peer.connection.setRemoteDescription(message.answer)
            }
            break

          case "ice-candidate":
            console.log("Received ICE candidate from:", message.fromPeerId)
            const candidatePeer = peersRef.current.get(message.fromPeerId)
            if (candidatePeer) {
              await candidatePeer.connection.addIceCandidate(message.candidate)
            }
            break

          case "file-request":
            console.log("Received file request for:", message.shareId)
            // Check if we have this file
            const file = pendingFilesRef.current.get(message.shareId)
            if (file) {
              wsRef.current?.send(
                JSON.stringify({
                  type: "file-available",
                  shareId: message.shareId,
                  requesterId: message.requesterId,
                  fileName: file.name,
                  fileSize: file.size,
                }),
              )
            }
            break

          case "file-available":
            console.log("File available from:", message.providerId)
            // Initiate connection to file provider
            if (!peersRef.current.has(message.providerId)) {
              const providerPc = createPeerConnection(message.providerId)
              peersRef.current.set(message.providerId, {
                id: message.providerId,
                connection: providerPc,
                status: "connecting",
              })

              // Create data channel for file transfer
              const fileChannel = providerPc.createDataChannel("fileTransfer", {
                ordered: true,
              })

              peersRef.current.get(message.providerId)!.dataChannel = fileChannel
              handleDataChannel(fileChannel, message.providerId)

              // Create offer
              const fileOffer = await providerPc.createOffer()
              await providerPc.setLocalDescription(fileOffer)

              wsRef.current?.send(
                JSON.stringify({
                  type: "offer",
                  targetPeerId: message.providerId,
                  offer: fileOffer,
                }),
              )
            }
            break

          case "peer-left":
            console.log("Peer left:", message.peerId)
            const leftPeer = peersRef.current.get(message.peerId)
            if (leftPeer) {
              leftPeer.connection.close()
              peersRef.current.delete(message.peerId)
            }

            setNetworkStatus((prev) => ({
              ...prev,
              peers: prev.peers.filter((p) => p.id !== message.peerId),
            }))
            break

          case "error":
            console.error("Signaling error:", message.message)
            break
        }
      }

      wsRef.current.onclose = () => {
        console.log("Disconnected from signaling server")
        setNetworkStatus((prev) => ({
          ...prev,
          signaling: "disconnected",
          isOnline: false,
          peers: [],
        }))

        // Clean up peer connections
        peersRef.current.forEach((peer) => {
          peer.connection.close()
        })
        peersRef.current.clear()

        // Attempt to reconnect after 5 seconds
        setTimeout(connectToSignaling, 5000)
      }

      wsRef.current.onerror = (error) => {
        console.error("Signaling server error:", error)
        setNetworkStatus((prev) => ({ ...prev, signaling: "error" }))
      }
    } catch (error) {
      console.error("Failed to connect to signaling server:", error)
      setNetworkStatus((prev) => ({ ...prev, signaling: "error" }))
    }
  }, [generatePeerId, createPeerConnection, handleDataChannel])

  // Join a room
  const joinRoom = useCallback((roomId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      currentRoomRef.current = roomId
      wsRef.current.send(
        JSON.stringify({
          type: "join-room",
          roomId: roomId,
        }),
      )
    }
  }, [])

  // Share files
  const shareFiles = useCallback((files: File[]): string[] => {
    const shareIds: string[] = []

    files.forEach((file) => {
      const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      pendingFilesRef.current.set(shareId, file)
      shareIds.push(shareId)
    })

    return shareIds
  }, [])

  // Request file download
  const requestFile = useCallback((shareId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "file-request",
          shareId: shareId,
        }),
      )
    }
  }, [])

  // Send file to peer
  const sendFileToPeer = useCallback(async (peerId: string, shareId: string) => {
    const peer = peersRef.current.get(peerId)
    const file = pendingFilesRef.current.get(shareId)

    if (!peer?.dataChannel || !file || peer.dataChannel.readyState !== "open") {
      console.error("Cannot send file: peer not connected or file not found")
      return
    }

    const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Send file info
    peer.dataChannel.send(
      JSON.stringify({
        type: "file-info",
        fileName: file.name,
        fileSize: file.size,
        transferId: transferId,
      }),
    )

    // Send file in chunks
    const chunkSize = 16384 // 16KB chunks
    const reader = new FileReader()
    let offset = 0

    const sendChunk = () => {
      const slice = file.slice(offset, offset + chunkSize)
      reader.readAsArrayBuffer(slice)
    }

    reader.onload = (event) => {
      if (event.target?.result && peer.dataChannel?.readyState === "open") {
        peer.dataChannel.send(event.target.result as ArrayBuffer)
        offset += chunkSize

        if (offset < file.size) {
          sendChunk()
        } else {
          // Send end marker
          peer.dataChannel.send(
            JSON.stringify({
              type: "file-end",
              transferId: transferId,
            }),
          )
        }
      }
    }

    sendChunk()
  }, [])

  // Initialize connection on mount
  useEffect(() => {
    connectToSignaling()

    // Join default room
    const defaultRoom = "global"
    setTimeout(() => joinRoom(defaultRoom), 1000)

    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close()
      }

      peersRef.current.forEach((peer) => {
        peer.connection.close()
      })
      peersRef.current.clear()
    }
  }, [connectToSignaling, joinRoom])

  return {
    networkStatus,
    transfers,
    shareFiles,
    requestFile,
    sendFileToPeer,
    joinRoom,
    myPeerId: myPeerIdRef.current,
  }
}
