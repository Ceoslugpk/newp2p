-- Analytics database schema for P2P file sharing application
-- This tracks usage patterns, performance metrics, and system health

CREATE TABLE IF NOT EXISTS file_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_hash VARCHAR(64) NOT NULL,
    file_size BIGINT NOT NULL,
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, completed, failed
    total_chunks INTEGER NOT NULL,
    completed_chunks INTEGER DEFAULT 0,
    peer_count INTEGER DEFAULT 0,
    average_speed DECIMAL(10,2), -- MB/s
    encryption_method VARCHAR(50) DEFAULT 'AES-256-GCM',
    share_link_id VARCHAR(100) UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    creator_ip_hash VARCHAR(64), -- Hashed for privacy
    geographic_region VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS peer_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID REFERENCES file_transfers(id),
    peer_id VARCHAR(64) NOT NULL, -- Anonymous peer identifier
    connection_type VARCHAR(20), -- direct, relay
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    disconnected_at TIMESTAMP WITH TIME ZONE,
    bytes_uploaded BIGINT DEFAULT 0,
    bytes_downloaded BIGINT DEFAULT 0,
    connection_quality DECIMAL(3,2), -- 0.0 to 1.0
    nat_type VARCHAR(20), -- full_cone, restricted, port_restricted, symmetric
    geographic_region VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metric_type VARCHAR(50) NOT NULL, -- cpu_usage, memory_usage, network_bandwidth, etc.
    metric_value DECIMAL(10,4) NOT NULL,
    server_instance VARCHAR(100),
    geographic_region VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS dht_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id VARCHAR(64) UNIQUE NOT NULL,
    ip_address INET,
    port INTEGER,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uptime_percentage DECIMAL(5,2),
    peer_count INTEGER DEFAULT 0,
    geographic_region VARCHAR(50),
    node_type VARCHAR(20) DEFAULT 'peer', -- peer, bootstrap, relay
    version VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL, -- failed_auth, malicious_peer, corruption_detected
    severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    description TEXT,
    source_ip_hash VARCHAR(64),
    peer_id VARCHAR(64),
    file_hash VARCHAR(64),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    geographic_region VARCHAR(50)
);

-- Indexes for performance
CREATE INDEX idx_file_transfers_status ON file_transfers(status);
CREATE INDEX idx_file_transfers_created_at ON file_transfers(created_at);
CREATE INDEX idx_file_transfers_file_hash ON file_transfers(file_hash);
CREATE INDEX idx_peer_connections_transfer_id ON peer_connections(transfer_id);
CREATE INDEX idx_peer_connections_peer_id ON peer_connections(peer_id);
CREATE INDEX idx_system_metrics_recorded_at ON system_metrics(recorded_at);
CREATE INDEX idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX idx_dht_nodes_last_seen ON dht_nodes(last_seen);
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_detected_at ON security_events(detected_at);

-- Views for common queries
CREATE OR REPLACE VIEW active_transfers AS
SELECT 
    ft.*,
    COUNT(pc.id) as active_peers,
    AVG(pc.connection_quality) as avg_connection_quality
FROM file_transfers ft
LEFT JOIN peer_connections pc ON ft.id = pc.transfer_id 
    AND pc.disconnected_at IS NULL
WHERE ft.status IN ('pending', 'active')
GROUP BY ft.id;

CREATE OR REPLACE VIEW transfer_statistics AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as total_transfers,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transfers,
    AVG(file_size) as avg_file_size,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds,
    AVG(average_speed) as avg_transfer_speed
FROM file_transfers
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour;

CREATE OR REPLACE VIEW network_health AS
SELECT 
    geographic_region,
    COUNT(*) as total_nodes,
    COUNT(CASE WHEN last_seen >= NOW() - INTERVAL '5 minutes' THEN 1 END) as active_nodes,
    AVG(uptime_percentage) as avg_uptime,
    AVG(peer_count) as avg_peer_count
FROM dht_nodes
GROUP BY geographic_region;
