// Integration Test Suite for P2P File Share
// Tests the complete setup and functionality

const WebSocket = require("ws")
const http = require("http")
const fs = require("fs")
const path = require("path")

class IntegrationTester {
  constructor() {
    this.tests = []
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
    }
  }

  async runTests() {
    console.log("🧪 Running Integration Tests...\n")

    // Test 1: Environment Configuration
    await this.test("Environment Configuration", async () => {
      const envFile = ".env.local"
      if (!fs.existsSync(envFile)) {
        throw new Error(".env.local file not found")
      }

      const envContent = fs.readFileSync(envFile, "utf8")
      const requiredVars = ["NEXT_PUBLIC_APP_NAME", "NEXT_PUBLIC_SIGNALING_SERVER_URL", "NEXT_PUBLIC_STUN_SERVERS"]

      for (const varName of requiredVars) {
        if (!envContent.includes(varName)) {
          throw new Error(`Missing environment variable: ${varName}`)
        }
      }

      return "All required environment variables are present"
    })

    // Test 2: Next.js Build
    await this.test("Next.js Build", async () => {
      if (!fs.existsSync(".next")) {
        throw new Error("Next.js build directory not found")
      }

      const buildManifest = path.join(".next", "build-manifest.json")
      if (!fs.existsSync(buildManifest)) {
        throw new Error("Build manifest not found")
      }

      return "Next.js build is valid"
    })

    // Test 3: Signaling Server Script
    await this.test("Signaling Server Script", async () => {
      const serverScript = "scripts/signaling-server.js"
      if (!fs.existsSync(serverScript)) {
        throw new Error("Signaling server script not found")
      }

      const scriptContent = fs.readFileSync(serverScript, "utf8")
      if (!scriptContent.includes("WebSocket.Server")) {
        throw new Error("Invalid signaling server script")
      }

      return "Signaling server script is valid"
    })

    // Test 4: Port Availability
    await this.test("Port Availability", async () => {
      const ports = [3000, 8080]
      const results = []

      for (const port of ports) {
        try {
          await this.checkPort(port)
          results.push(`Port ${port}: Available`)
        } catch (error) {
          results.push(`Port ${port}: ${error.message}`)
        }
      }

      return results.join(", ")
    })

    // Test 5: WebSocket Connectivity
    await this.test("WebSocket Connectivity", async () => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("WebSocket connection timeout"))
        }, 5000)

        try {
          const ws = new WebSocket("ws://localhost:8080")

          ws.on("open", () => {
            clearTimeout(timeout)
            ws.close()
            resolve("WebSocket connection successful")
          })

          ws.on("error", (error) => {
            clearTimeout(timeout)
            reject(new Error(`WebSocket connection failed: ${error.message}`))
          })
        } catch (error) {
          clearTimeout(timeout)
          reject(error)
        }
      })
    })

    // Test 6: HTTP Server
    await this.test("HTTP Server", async () => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("HTTP server connection timeout"))
        }, 5000)

        const req = http.get("http://localhost:3000", (res) => {
          clearTimeout(timeout)
          if (res.statusCode === 200) {
            resolve(`HTTP server responding (Status: ${res.statusCode})`)
          } else {
            reject(new Error(`HTTP server error (Status: ${res.statusCode})`))
          }
        })

        req.on("error", (error) => {
          clearTimeout(timeout)
          reject(new Error(`HTTP server connection failed: ${error.message}`))
        })
      })
    })

    // Test 7: File System Permissions
    await this.test("File System Permissions", async () => {
      const testFile = "test-write-permissions.tmp"

      try {
        fs.writeFileSync(testFile, "test")
        fs.unlinkSync(testFile)
        return "File system write permissions OK"
      } catch (error) {
        throw new Error(`File system permission error: ${error.message}`)
      }
    })

    // Test 8: Dependencies
    await this.test("Dependencies Check", async () => {
      const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"))
      const nodeModules = "node_modules"

      if (!fs.existsSync(nodeModules)) {
        throw new Error("node_modules directory not found")
      }

      const criticalDeps = ["next", "react", "ws"]
      const missing = []

      for (const dep of criticalDeps) {
        const depPath = path.join(nodeModules, dep)
        if (!fs.existsSync(depPath)) {
          missing.push(dep)
        }
      }

      if (missing.length > 0) {
        throw new Error(`Missing dependencies: ${missing.join(", ")}`)
      }

      return `All critical dependencies installed (${criticalDeps.length} checked)`
    })

    // Print results
    this.printResults()
  }

  async test(name, testFunction) {
    this.results.total++

    try {
      const result = await testFunction()
      console.log(`✅ ${name}: ${result}`)
      this.results.passed++
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`)
      this.results.failed++
    }
  }

  checkPort(port) {
    return new Promise((resolve, reject) => {
      const server = http.createServer()

      server.listen(port, () => {
        server.close(() => {
          resolve()
        })
      })

      server.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
          reject(new Error("In use"))
        } else {
          reject(error)
        }
      })
    })
  }

  printResults() {
    console.log("\n📊 Test Results Summary:")
    console.log("========================")
    console.log(`Total Tests: ${this.results.total}`)
    console.log(`Passed: ${this.results.passed}`)
    console.log(`Failed: ${this.results.failed}`)
    console.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`)

    if (this.results.failed === 0) {
      console.log("\n🎉 All tests passed! The application is ready to use.")
    } else {
      console.log("\n⚠️  Some tests failed. Please check the setup and try again.")
      process.exit(1)
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new IntegrationTester()
  tester.runTests().catch(console.error)
}

module.exports = IntegrationTester
