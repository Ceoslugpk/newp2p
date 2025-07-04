import FileTransferDemo from "@/components/file-transfer-demo"
import ArchitectureDiagram from "@/components/architecture-diagram"

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">P2P File Sharing Demo</h1>
          <p className="text-lg text-gray-600">Interactive demonstration of decentralized file transfer</p>
        </div>

        <FileTransferDemo />
        <ArchitectureDiagram />
      </div>
    </div>
  )
}
