// P2P Network Simulation Script
// Simulates peer-to-peer file sharing network behavior for testing and optimization

class P2PNetworkSimulator {
  constructor(config = {}) {
    this.peers = new Map()
    this.files = new Map()
    this.connections = new Map()
    this.config = {
      maxPeers: config.maxPeers || 1000,
      chunkSize: config.chunkSize || 256 * 1024, // 256KB
      connectionTimeout: config.connectionTimeout || 30000,
      maxConnectionsPerPeer: config.maxConnectionsPerPeer || 8,
      ...config,
    }
    this.stats = {
      totalTransfers: 0,
      successfulTransfers: 0,
      failedTransfers: 0,
      totalBytesTransferred: 0,
      averageSpeed: 0,
    }
  }

  // Create a new peer in the network
  createPeer(id, options = {}) {
    const peer = {
      id,
      ip: this.generateRandomIP(),
      port: Math.floor(Math.random() * 65535) + 1024,
      natType: options.natType || this.randomNATType(),
      bandwidth: options.bandwidth || this.randomBandwidth(),
      uptime: options.uptime || Math.random() * 0.3 + 0.7, // 70-100% uptime
      files: new Set(),
      connections: new Set(),
      downloadQueue: [],
      uploadQueue: [],
      reputation: 1.0,
      lastSeen: Date.now(),
      geographic_region: options.region || this.randomRegion(),
    }

    this.peers.set(id, peer)
    console.log(`Created peer ${id} in ${peer.geographic_region} with ${peer.natType} NAT`)
    return peer
  }

  // Simulate file sharing
  shareFile(peerId, fileInfo) {
    const peer = this.peers.get(peerId)
    if (!peer) throw new Error(`Peer ${peerId} not found`)

    const file = {
      id: fileInfo.id || this.generateFileId(),
      name: fileInfo.name,
      size: fileInfo.size,
      hash: fileInfo.hash || this.generateFileHash(),
      chunks: Math.ceil(fileInfo.size / this.config.chunkSize),
      seeders: new Set([peerId]),
      leechers: new Set(),
      created: Date.now(),
      ...fileInfo,
    }

    this.files.set(file.id, file)
    peer.files.add(file.id)

    console.log(`Peer ${peerId} sharing file ${file.name} (${this.formatBytes(file.size)})`)
    return file
  }

  // Simulate peer discovery for a file
  discoverPeers(fileId, requestingPeerId, maxPeers = 50) {
    const file = this.files.get(fileId)
    if (!file) return []

    const requestingPeer = this.peers.get(requestingPeerId)
    const availablePeers = []

    // Find peers that have the file
    for (const peerId of file.seeders) {
      const peer = this.peers.get(peerId)
      if (peer && peer.id !== requestingPeerId && this.isPeerOnline(peer)) {
        // Calculate connection probability based on NAT types and geography
        const connectionProbability = this.calculateConnectionProbability(requestingPeer, peer)
        if (Math.random() < connectionProbability) {
          availablePeers.push({
            id: peer.id,
            ip: peer.ip,
            port: peer.port,
            bandwidth: peer.bandwidth,
            reputation: peer.reputation,
            distance: this.calculateDistance(requestingPeer, peer),
          })
        }
      }
    }

    // Sort by reputation and distance, return top peers
    return availablePeers.sort((a, b) => b.reputation - a.reputation || a.distance - b.distance).slice(0, maxPeers)
  }

  // Simulate file download
  async downloadFile(fileId, downloaderId) {
    const file = this.files.get(fileId)
    const downloader = this.peers.get(downloaderId)

    if (!file || !downloader) {
      throw new Error("File or peer not found")
    }

    console.log(`Peer ${downloaderId} starting download of ${file.name}`)

    // Discover peers
    const availablePeers = this.discoverPeers(fileId, downloaderId)
    if (availablePeers.length === 0) {
      console.log(`No peers available for file ${fileId}`)
      this.stats.failedTransfers++
      return false
    }

    // Simulate download process
    const downloadSession = {
      fileId,
      downloaderId,
      peers: availablePeers.slice(0, this.config.maxConnectionsPerPeer),
      chunksDownloaded: 0,
      totalChunks: file.chunks,
      startTime: Date.now(),
      bytesDownloaded: 0,
    }

    // Add to leechers
    file.leechers.add(downloaderId)

    // Simulate chunk-by-chunk download
    for (let chunk = 0; chunk < file.chunks; chunk++) {
      const peer = this.selectBestPeer(downloadSession.peers)
      const chunkSize = Math.min(this.config.chunkSize, file.size - chunk * this.config.chunkSize)

      // Simulate network delay and transfer time
      const transferTime = this.simulateChunkTransfer(peer, chunkSize)
      await this.sleep(transferTime)

      downloadSession.chunksDownloaded++
      downloadSession.bytesDownloaded += chunkSize

      // Update progress
      const progress = (downloadSession.chunksDownloaded / downloadSession.totalChunks) * 100
      if (chunk % 10 === 0) {
        // Log every 10 chunks
        console.log(
          `Download progress: ${progress.toFixed(1)}% (${downloadSession.chunksDownloaded}/${downloadSession.totalChunks} chunks)`,
        )
      }
    }

    // Complete download
    const duration = Date.now() - downloadSession.startTime
    const speed = downloadSession.bytesDownloaded / 1024 / 1024 / (duration / 1000) // MB/s

    file.leechers.delete(downloaderId)
    file.seeders.add(downloaderId)
    downloader.files.add(fileId)

    this.stats.totalTransfers++
    this.stats.successfulTransfers++
    this.stats.totalBytesTransferred += downloadSession.bytesDownloaded
    this.stats.averageSpeed = (this.stats.averageSpeed + speed) / 2

    console.log(`Download completed in ${duration}ms at ${speed.toFixed(2)} MB/s`)
    return true
  }

  // Helper methods
  generateRandomIP() {
    return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`
  }

  randomNATType() {
    const types = ["full_cone", "restricted", "port_restricted", "symmetric"]
    return types[Math.floor(Math.random() * types.length)]
  }

  randomBandwidth() {
    // Simulate various connection speeds (Mbps)
    const speeds = [1, 5, 10, 25, 50, 100, 250, 500, 1000]
    return speeds[Math.floor(Math.random() * speeds.length)]
  }

  randomRegion() {
    const regions = ["us-east", "us-west", "eu-west", "eu-central", "asia-pacific", "south-america"]
    return regions[Math.floor(Math.random() * regions.length)]
  }

  generateFileId() {
    return Math.random().toString(36).substring(2, 15)
  }

  generateFileHash() {
    return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
  }

  isPeerOnline(peer) {
    return Math.random() < peer.uptime
  }

  calculateConnectionProbability(peer1, peer2) {
    let probability = 0.8 // Base probability

    // NAT traversal success rates
    const natSuccessRates = {
      full_cone: 0.95,
      restricted: 0.85,
      port_restricted: 0.75,
      symmetric: 0.4,
    }

    probability *= Math.min(natSuccessRates[peer1.natType], natSuccessRates[peer2.natType])

    // Geographic distance factor
    if (peer1.geographic_region === peer2.geographic_region) {
      probability *= 1.1 // Boost for same region
    } else {
      probability *= 0.9 // Slight penalty for different regions
    }

    return Math.min(probability, 1.0)
  }

  calculateDistance(peer1, peer2) {
    // Simplified distance calculation based on region
    if (peer1.geographic_region === peer2.geographic_region) return 1
    return Math.random() * 10 + 2 // 2-12 arbitrary distance units
  }

  selectBestPeer(peers) {
    // Select peer based on bandwidth and reputation
    return peers.reduce((best, current) => {
      const bestScore = best.bandwidth * best.reputation
      const currentScore = current.bandwidth * current.reputation
      return currentScore > bestScore ? current : best
    })
  }

  simulateChunkTransfer(peer, chunkSize) {
    // Simulate transfer time based on bandwidth and network conditions
    const baseTime = (chunkSize / 1024 / 1024 / (peer.bandwidth / 8)) * 1000 // Convert to ms
    const networkJitter = Math.random() * 0.5 + 0.75 // 75-125% of base time
    return Math.floor(baseTime * networkJitter)
  }

  formatBytes(bytes) {
    const sizes = ["Bytes", "KB", "MB", "GB"]
    if (bytes === 0) return "0 Bytes"
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Generate network statistics
  getNetworkStats() {
    const totalPeers = this.peers.size
    const onlinePeers = Array.from(this.peers.values()).filter((p) => this.isPeerOnline(p)).length
    const totalFiles = this.files.size

    return {
      network: {
        totalPeers,
        onlinePeers,
        totalFiles,
        averageFilesPerPeer: totalFiles / totalPeers || 0,
      },
      transfers: this.stats,
      regions: this.getRegionStats(),
    }
  }

  getRegionStats() {
    const regionStats = {}
    for (const peer of this.peers.values()) {
      if (!regionStats[peer.geographic_region]) {
        regionStats[peer.geographic_region] = { peers: 0, files: 0 }
      }
      regionStats[peer.geographic_region].peers++
      regionStats[peer.geographic_region].files += peer.files.size
    }
    return regionStats
  }
}

// Simulation runner
async function runSimulation() {
  console.log("Starting P2P Network Simulation...\n")

  const simulator = new P2PNetworkSimulator({
    maxPeers: 100,
    chunkSize: 256 * 1024, // 256KB chunks
    maxConnectionsPerPeer: 6,
  })

  // Create peers across different regions
  const regions = ["us-east", "us-west", "eu-west", "asia-pacific"]
  for (let i = 0; i < 50; i++) {
    const region = regions[i % regions.length]
    simulator.createPeer(`peer-${i}`, {
      region,
      bandwidth: [10, 25, 50, 100][Math.floor(Math.random() * 4)],
    })
  }

  // Share some files
  const files = [
    { name: "presentation.pptx", size: 45 * 1024 * 1024 }, // 45MB
    { name: "video.mp4", size: 250 * 1024 * 1024 }, // 250MB
    { name: "dataset.zip", size: 1024 * 1024 * 1024 }, // 1GB
    { name: "document.pdf", size: 5 * 1024 * 1024 }, // 5MB
  ]

  const sharedFiles = []
  for (let i = 0; i < files.length; i++) {
    const seederId = `peer-${i * 10}`
    const file = simulator.shareFile(seederId, files[i])
    sharedFiles.push(file)
  }

  console.log("\nStarting file downloads...\n")

  // Simulate downloads
  const downloadPromises = []
  for (let i = 0; i < 10; i++) {
    const fileIndex = Math.floor(Math.random() * sharedFiles.length)
    const downloaderId = `peer-${Math.floor(Math.random() * 50)}`

    downloadPromises.push(
      simulator
        .downloadFile(sharedFiles[fileIndex].id, downloaderId)
        .catch((err) => console.error(`Download failed: ${err.message}`)),
    )

    // Stagger downloads
    await simulator.sleep(2000)
  }

  // Wait for all downloads to complete
  await Promise.all(downloadPromises)

  // Print final statistics
  console.log("\n=== Simulation Results ===")
  const stats = simulator.getNetworkStats()
  console.log("Network Stats:", JSON.stringify(stats.network, null, 2))
  console.log("Transfer Stats:", JSON.stringify(stats.transfers, null, 2))
  console.log("Regional Distribution:", JSON.stringify(stats.regions, null, 2))

  console.log("\nSimulation completed!")
}

// Run the simulation
runSimulation().catch(console.error)
