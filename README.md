# P2P File Sharing Application

A decentralized peer-to-peer file sharing application built with Next.js and WebRTC, featuring TURN server support for NAT traversal.

## Overview

This repository will stay in sync with your deployed chats on [v0.dev](https://v0.dev).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.dev](https://v0.dev).

## Deployment

Your project is live at:

**[https://vercel.com/haiders-projects-cab345f8/v0-decentralized-file-sharing](https://vercel.com/haiders-projects-cab345f8/v0-decentralized-file-sharing)**

## Build your app

Continue building your app on:

**[https://v0.dev/chat/projects/U7Q5UZcY42t](https://v0.dev/chat/projects/U7Q5UZcY42t)**

## Features

- **True P2P Transfer**: Files are transferred directly between peers without server storage
- **TURN Server Support**: Works behind NAT and firewalls using TURN servers
- **Real-time Network**: WebSocket signaling server for peer discovery
- **Secure**: End-to-end encryption for all file transfers
- **Responsive UI**: Modern interface built with Next.js and Tailwind CSS
- **Docker Ready**: Easy deployment with Docker and Docker Compose

## Architecture

- **Frontend**: Next.js application with React hooks for P2P networking
- **Signaling Server**: WebSocket server for peer discovery and WebRTC signaling
- **TURN Servers**: NAT traversal support for reliable connections
- **No File Storage**: Files are never stored on servers, only transferred between peers

## Quick Start

### Development

1. **Clone the repository**
   \`\`\`bash
   git clone <repository-url>
   cd p2p-fileshare
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Start the signaling server**
   \`\`\`bash
   npm run signaling
   \`\`\`

4. **Start the development server**
   \`\`\`bash
   npm run dev
   \`\`\`

5. **Open your browser**
   - Frontend: http://localhost:3000
   - Signaling server: ws://localhost:8080

### Production Deployment

#### Option 1: Docker Compose (Recommended)

1. **Prepare your VPS**
   \`\`\`bash
   # Run the deployment script as root
   sudo bash deploy.sh
   \`\`\`

2. **Copy application files**
   \`\`\`bash
   # Copy all files to /opt/p2p-fileshare/
   scp -r * user@your-server:/opt/p2p-fileshare/
   \`\`\`

3. **Add SSL certificates**
   \`\`\`bash
   # Add your SSL certificates to the ssl directory
   cp cert.pem /opt/p2p-fileshare/ssl/
   cp key.pem /opt/p2p-fileshare/ssl/
   \`\`\`

4. **Update configuration**
   \`\`\`bash
   # Edit nginx.conf with your domain name
   nano /opt/p2p-fileshare/nginx.conf
   
   # Update environment variables
   nano /opt/p2p-fileshare/.env
   \`\`\`

5. **Deploy with Docker**
   \`\`\`bash
   cd /opt/p2p-fileshare
   docker-compose up -d
   \`\`\`

#### Option 2: Manual Deployment

1. **Install Node.js and dependencies**
   \`\`\`bash
   npm install --production
   npm run build
   \`\`\`

2. **Start the signaling server**
   \`\`\`bash
   systemctl enable p2p-signaling
   systemctl start p2p-signaling
   \`\`\`

3. **Start the frontend**
   \`\`\`bash
   npm start
   \`\`\`

## Environment Variables

Create a `.env.local` file for development or `.env` for production:

\`\`\`env
# Production signaling server URL
NEXT_PUBLIC_SIGNALING_SERVER_URL=wss://your-domain.com:8080

# Development signaling server URL
NEXT_PUBLIC_SIGNALING_SERVER_URL=ws://localhost:8080
\`\`\`

## Configuration

### TURN Servers

The application uses public TURN servers by default. For production, consider setting up your own TURN server:

\`\`\`typescript
// In hooks/use-p2p-network.ts
const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: "turn:your-turn-server.com:3478",
    username: "your-username",
    credential: "your-password",
  },
]
\`\`\`

### Signaling Server

The signaling server can be configured with environment variables:

\`\`\`bash
PORT=8080                    # WebSocket server port
NODE_ENV=production         # Environment mode
\`\`\`

## Usage

### Sharing Files

1. Open the application in your browser
2. Wait for P2P network connection (green status indicator)
3. Drag and drop files or click to select files
4. Click "Share Files via P2P"
5. Copy the generated share links and send to recipients

### Downloading Files

1. Open a share link in your browser
2. Wait for the file to be discovered in the P2P network
3. Click "Download via P2P" to start the transfer
4. The file will be downloaded directly from the sharing peer

## Monitoring

### Docker Logs
\`\`\`bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f frontend
docker-compose logs -f signaling
\`\`\`

### System Logs
\`\`\`bash
# Signaling server logs
journalctl -u p2p-signaling -f

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
\`\`\`

## Security Considerations

1. **SSL/TLS**: Always use HTTPS in production for secure WebSocket connections
2. **TURN Server**: Use authenticated TURN servers to prevent abuse
3. **File Validation**: Implement client-side file type and size validation
4. **Rate Limiting**: Consider implementing rate limiting on the signaling server
5. **Firewall**: Configure firewall rules to only allow necessary ports

## Troubleshooting

### Connection Issues

1. **Check signaling server status**
   \`\`\`bash
   docker-compose ps
   # or
   systemctl status p2p-signaling
   \`\`\`

2. **Verify WebSocket connection**
   - Open browser developer tools
   - Check console for WebSocket connection errors
   - Ensure signaling server URL is correct

3. **TURN server connectivity**
   - Test TURN server connectivity using online tools
   - Verify TURN server credentials

### Performance Issues

1. **Monitor resource usage**
   \`\`\`bash
   docker stats
   # or
   htop
   \`\`\`

2. **Check network bandwidth**
   - Large files may take time to transfer
   - Multiple concurrent transfers can impact performance

3. **Peer connectivity**
   - Ensure peers remain online during transfers
   - Check for NAT/firewall blocking P2P connections

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs for error messages
3. Open an issue on GitHub with detailed information

## Roadmap

- [ ] File encryption at rest
- [ ] Resume interrupted transfers
- [ ] Bandwidth throttling
- [ ] Mobile app support
- [ ] File integrity verification
- [ ] Peer reputation system
