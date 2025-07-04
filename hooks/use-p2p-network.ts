"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface PeerConnection {
  id: string
  connection: RTCPeerConnection
  dataChannel?: RTCDataChannel
  status: "connecting" | "connected" | "disconnected"
}

interface FileTransfer {
  id: string
  fileName: string
  fileSize: number
  progress: number
  status: "pending" | "transferring" | "completed" | "failed"
  peerId: string
}

export function useP2PNetwork() {
  const [isConnected, setIsConnected] = useState(false)
  const [peers, setPeers] = useState<PeerConnection[]>([])
  const [transfers, setTransfers] = useState<FileTransfer[]>([])
  const [signalingStatus, setSignalingStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected")

  const wsRef = useRef<WebSocket | null>(null)
  const clientIdRef = useRef<string>("")
  const roomIdRef = useRef<string>("")

  // TURN servers configuration
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
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
    iceCandidatePoolSize: 10,
  }

  const connectToSignalingServer = useCallback(() => {
    const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || "ws://localhost:8080"

    setSignalingStatus("connecting")

    try {
      wsRef.current = new WebSocket(signalingUrl)

      wsRef.current.onopen = () => {
        console.log("Connected to signaling server")
        setSignalingStatus("connected")
        setIsConnected(true)
      }

      wsRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data)
        handleSignalingMessage(message)
      }

      wsRef.current.onclose = () => {
        console.log("Disconnected from signaling server")
        setSignalingStatus("disconnected")
        setIsConnected(false)

        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            connectToSignalingServer()
          }
        }, 3000)
      }

      wsRef.current.onerror = (error) => {
        console.error("Signaling server error:", error)
        setSignalingStatus("disconnected")
      }
    } catch (error) {
      console.error("Failed to connect to signaling server:", error)
      setSignalingStatus("disconnected")
    }
  }, [])

  const handleSignalingMessage = useCallback(async (message: any) => {
    switch (message.type) {
      case "connected":
        clientIdRef.current = message.clientId
        break

      case "room-joined":
        roomIdRef.current = message.roomId
        // Create connections to existing peers
        for (const peerId of message.peers) {
          await createPeerConnection(peerId, true)
        }
        break

      case "peer-joined":
        await createPeerConnection(message.peerId, false)
        break

      case "peer-left":
      case "peer-disconnected":
        removePeerConnection(message.peerId)
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
    }
  }, [])

  const createPeerConnection = useCallback(
    async (peerId: string, isInitiator: boolean) => {
      const peerConnection = new RTCPeerConnection(rtcConfig)

      const newPeer: PeerConnection = {
        id: peerId,
        connection: peerConnection,
        status: "connecting",
      }

      // Set up data channel
      if (isInitiator) {
        const dataChannel = peerConnection.createDataChannel("fileTransfer", {
          ordered: true,
        })

        dataChannel.onopen = () => {
          console.log(`Data channel opened with peer ${peerId}`)
          setPeers((prev) =>
            prev.map((p) => (p.id === peerId ? { ...p, status: "connected" as const, dataChannel } : p)),
          )
        }

        dataChannel.onmessage = (event) => {
          handleDataChannelMessage(peerId, event.data)
        }

        newPeer.dataChannel = dataChannel
      } else {
        peerConnection.ondatachannel = (event) => {
          const dataChannel = event.channel

          dataChannel.onopen = () => {
            console.log(`Data channel received from peer ${peerId}`)
            setPeers((prev) =>
              prev.map((p) => (p.id === peerId ? { ...p, status: "connected" as const, dataChannel } : p)),
            )
          }

          dataChannel.onmessage = (event) => {
            handleDataChannelMessage(peerId, event.data)
          }

          setPeers((prev) => prev.map((p) => (p.id === peerId ? { ...p, dataChannel } : p)))
        }
      }

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: "ice-candidate",
              targetId: peerId,
              candidate: event.candidate,
            }),
          )
        }
      }

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState
        console.log(`Peer ${peerId} connection state: ${state}`)

        setPeers((prev) =>
          prev.map((p) =>
            p.id === peerId
              ? {
                  ...p,
                  status:
                    state === "connected"
                      ? "connected"
                      : state === "failed" || state === "disconnected"
                        ? "disconnected"
                        : "connecting",
                }
              : p,
          ),
        )
      }

      setPeers((prev) => [...prev.filter((p) => p.id !== peerId), newPeer])

      // Create offer if initiator
      if (isInitiator) {
        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)

        if (wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: "offer",
              targetId: peerId,
              offer: offer,
            }),
          )
        }
      }
    },
    [rtcConfig],
  )

  const handleOffer = useCallback(
    async (message: any) => {
      const peer = peers.find((p) => p.id === message.fromId)
      if (!peer) return

      await peer.connection.setRemoteDescription(message.offer)
      const answer = await peer.connection.createAnswer()
      await peer.connection.setLocalDescription(answer)

      if (wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: "answer",
            targetId: message.fromId,
            answer: answer,
          }),
        )
      }
    },
    [peers],
  )

  const handleAnswer = useCallback(
    async (message: any) => {
      const peer = peers.find((p) => p.id === message.fromId)
      if (!peer) return

      await peer.connection.setRemoteDescription(message.answer)
    },
    [peers],
  )

  const handleIceCandidate = useCallback(
    async (message: any) => {
      const peer = peers.find((p) => p.id === message.fromId)
      if (!peer) return

      await peer.connection.addIceCandidate(message.candidate)
    },
    [peers],
  )

  const removePeerConnection = useCallback((peerId: string) => {
    setPeers((prev) => {
      const peer = prev.find((p) => p.id === peerId)
      if (peer) {
        peer.connection.close()
        peer.dataChannel?.close()
      }
      return prev.filter((p) => p.id !== peerId)
    })
  }, [])

  const handleDataChannelMessage = useCallback((peerId: string, data: any) => {
    try {
      const message = JSON.parse(data)

      switch (message.type) {
        case "file-chunk":
          handleFileChunk(peerId, message)
          break
        case "file-complete":
          handleFileComplete(peerId, message)
          break
        case "file-error":
          handleFileError(peerId, message)
          break
      }
    } catch (error) {
      console.error("Error parsing data channel message:", error)
    }
  }, [])

  const handleFileChunk = useCallback((peerId: string, message: any) => {
    setTransfers((prev) =>
      prev.map((t) =>
        t.id === message.transferId
          ? {
              ...t,
              progress: message.progress,
              status: "transferring" as const,
            }
          : t,
      ),
    )
  }, [])

  const handleFileComplete = useCallback((peerId: string, message: any) => {
    setTransfers((prev) =>
      prev.map((t) =>
        t.id === message.transferId
          ? {
              ...t,
              progress: 100,
              status: "completed" as const,
            }
          : t,
      ),
    )
  }, [])

  const handleFileError = useCallback((peerId: string, message: any) => {
    setTransfers((prev) =>
      prev.map((t) =>
        t.id === message.transferId
          ? {
              ...t,
              status: "failed" as const,
            }
          : t,
      ),
    )
  }, [])

  const handleFileRequest = useCallback((message: any) => {
    // Handle incoming file requests
    console.log("File request received:", message)
  }, [])

  const handleFileResponse = useCallback((message: any) => {
    // Handle file responses
    console.log("File response received:", message)
  }, [])

  const joinRoom = useCallback((roomId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "join-room",
          roomId: roomId,
        }),
      )
    }
  }, [])

  const sendFile = useCallback(
    async (file: File, targetPeerId?: string) => {
      const transferId = Math.random().toString(36).substr(2, 9)

      const newTransfer: FileTransfer = {
        id: transferId,
        fileName: file.name,
        fileSize: file.size,
        progress: 0,
        status: "pending",
        peerId: targetPeerId || "",
      }

      setTransfers((prev) => [...prev, newTransfer])

      // If no specific peer, send to all connected peers
      const targetPeers = targetPeerId
        ? peers.filter((p) => p.id === targetPeerId && p.status === "connected")
        : peers.filter((p) => p.status === "connected")

      for (const peer of targetPeers) {
        if (peer.dataChannel && peer.dataChannel.readyState === "open") {
          await sendFileToDataChannel(peer.dataChannel, file, transferId)
        }
      }
    },
    [peers],
  )

  const sendFileToDataChannel = useCallback(async (dataChannel: RTCDataChannel, file: File, transferId: string) => {
    const chunkSize = 16384 // 16KB chunks
    const totalChunks = Math.ceil(file.size / chunkSize)
    let chunkIndex = 0

    // Send file metadata
    dataChannel.send(
      JSON.stringify({
        type: "file-start",
        transferId: transferId,
        fileName: file.name,
        fileSize: file.size,
        totalChunks: totalChunks,
      }),
    )

    const reader = new FileReader()

    const sendNextChunk = () => {
      const start = chunkIndex * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      const chunk = file.slice(start, end)

      reader.onload = (e) => {
        if (e.target?.result) {
          dataChannel.send(
            JSON.stringify({
              type: "file-chunk",
              transferId: transferId,
              chunkIndex: chunkIndex,
              data: Array.from(new Uint8Array(e.target.result as ArrayBuffer)),
              progress: Math.round((chunkIndex / totalChunks) * 100),
            }),
          )

          chunkIndex++

          if (chunkIndex < totalChunks) {
            setTimeout(sendNextChunk, 10) // Small delay to prevent overwhelming
          } else {
            // File transfer complete
            dataChannel.send(
              JSON.stringify({
                type: "file-complete",
                transferId: transferId,
              }),
            )

            setTransfers((prev) =>
              prev.map((t) =>
                t.id === transferId
                  ? {
                      ...t,
                      progress: 100,
                      status: "completed" as const,
                    }
                  : t,
              ),
            )
          }
        }
      }

      reader.onerror = () => {
        dataChannel.send(
          JSON.stringify({
            type: "file-error",
            transferId: transferId,
            error: "Failed to read file chunk",
          }),
        )

        setTransfers((prev) =>
          prev.map((t) =>
            t.id === transferId
              ? {
                  ...t,
                  status: "failed" as const,
                }
              : t,
          ),
        )
      }

      reader.readAsArrayBuffer(chunk)
    }

    sendNextChunk()
  }, [])

  // Initialize connection on mount
  useEffect(() => {
    connectToSignalingServer()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }

      // Close all peer connections
      peers.forEach((peer) => {
        peer.connection.close()
        peer.dataChannel?.close()
      })
    }
  }, [connectToSignalingServer])

  return {
    isConnected,
    signalingStatus,
    peers: peers.filter((p) => p.status === "connected"),
    transfers,
    joinRoom,
    sendFile,
    connectToSignalingServer,
  }
}
