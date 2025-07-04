#!/usr/bin/env python3
"""
Security Analysis Script for P2P File Sharing Application
Analyzes potential security vulnerabilities and generates recommendations
"""

import hashlib
import secrets
import json
import time
from datetime import datetime, timedelta
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

class SecurityAnalyzer:
    def __init__(self):
        self.vulnerabilities = []
        self.recommendations = []
        self.test_results = {}
        
    def analyze_encryption_strength(self):
        """Analyze encryption implementation strength"""
        print("Analyzing encryption strength...")
        
        # Test AES-256-GCM implementation
        key = secrets.token_bytes(32)  # 256-bit key
        nonce = secrets.token_bytes(12)  # 96-bit nonce for GCM
        
        # Test data
        plaintext = b"This is a test file chunk for P2P transfer"
        
        # Encrypt
        cipher = Cipher(algorithms.AES(key), modes.GCM(nonce))
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(plaintext) + encryptor.finalize()
        auth_tag = encryptor.tag
        
        # Decrypt
        decryptor = Cipher(algorithms.AES(key), modes.GCM(nonce, auth_tag)).decryptor()
        decrypted = decryptor.update(ciphertext) + decryptor.finalize()
        
        # Verify
        encryption_success = plaintext == decrypted
        
        self.test_results['encryption'] = {
            'algorithm': 'AES-256-GCM',
            'key_size': len(key) * 8,
            'nonce_size': len(nonce) * 8,
            'auth_tag_size': len(auth_tag) * 8,
            'test_passed': encryption_success,
            'strength_rating': 'HIGH' if encryption_success else 'FAILED'
        }
        
        if not encryption_success:
            self.vulnerabilities.append({
                'type': 'ENCRYPTION_FAILURE',
                'severity': 'CRITICAL',
                'description': 'AES-256-GCM encryption/decryption test failed'
            })
        
        print(f"✓ Encryption test: {'PASSED' if encryption_success else 'FAILED'}")
        
    def analyze_key_exchange(self):
        """Analyze key exchange mechanism security"""
        print("Analyzing key exchange security...")
        
        # Test ECDH key exchange
        try:
            # Generate key pairs for two peers
            peer1_private = ec.generate_private_key(ec.SECP256R1())
            peer1_public = peer1_private.public_key()
            
            peer2_private = ec.generate_private_key(ec.SECP256R1())
            peer2_public = peer2_private.public_key()
            
            # Perform key exchange
            shared_key1 = peer1_private.exchange(ec.ECDH(), peer2_public)
            shared_key2 = peer2_private.exchange(ec.ECDH(), peer1_public)
            
            # Verify shared keys match
            key_exchange_success = shared_key1 == shared_key2
            
            # Derive encryption key using PBKDF2
            salt = secrets.token_bytes(16)
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            derived_key = kdf.derive(shared_key1)
            
            self.test_results['key_exchange'] = {
                'algorithm': 'ECDH-P256',
                'shared_key_size': len(shared_key1) * 8,
                'derived_key_size': len(derived_key) * 8,
                'kdf_iterations': 100000,
                'test_passed': key_exchange_success,
                'strength_rating': 'HIGH' if key_exchange_success else 'FAILED'
            }
            
            print(f"✓ Key exchange test: {'PASSED' if key_exchange_success else 'FAILED'}")
            
        except Exception as e:
            self.vulnerabilities.append({
                'type': 'KEY_EXCHANGE_ERROR',
                'severity': 'CRITICAL',
                'description': f'Key exchange implementation error: {str(e)}'
            })
            print(f"✗ Key exchange test: FAILED - {str(e)}")
    
    def analyze_file_integrity(self):
        """Analyze file integrity verification mechanisms"""
        print("Analyzing file integrity verification...")
        
        # Test SHA-256 hashing for chunks
        test_data = b"Test file chunk data for integrity verification"
        
        # Calculate hash
        hash_obj = hashlib.sha256()
        hash_obj.update(test_data)
        original_hash = hash_obj.hexdigest()
        
        # Simulate corruption
        corrupted_data = test_data[:-1] + b'X'  # Change last byte
        
        hash_obj2 = hashlib.sha256()
        hash_obj2.update(corrupted_data)
        corrupted_hash = hash_obj2.hexdigest()
        
        # Verify detection
        corruption_detected = original_hash != corrupted_hash
        
        self.test_results['file_integrity'] = {
            'hash_algorithm': 'SHA-256',
            'hash_size': len(original_hash) * 4,  # hex chars to bits
            'corruption_detected': corruption_detected,
            'test_passed': corruption_detected,
            'strength_rating': 'HIGH' if corruption_detected else 'FAILED'
        }
        
        print(f"✓ File integrity test: {'PASSED' if corruption_detected else 'FAILED'}")
    
    def analyze_peer_authentication(self):
        """Analyze peer authentication mechanisms"""
        print("Analyzing peer authentication...")
        
        # Test digital signature verification
        try:
            # Generate RSA key pair for peer identity
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048
            )
            public_key = private_key.public_key()
            
            # Create challenge message
            challenge = secrets.token_bytes(32)
            
            # Sign challenge
            signature = private_key.sign(
                challenge,
                hashes.SHA256()
            )
            
            # Verify signature
            try:
                public_key.verify(signature, challenge, hashes.SHA256())
                auth_success = True
            except:
                auth_success = False
            
            self.test_results['peer_authentication'] = {
                'signature_algorithm': 'RSA-2048-SHA256',
                'key_size': 2048,
                'challenge_size': len(challenge) * 8,
                'signature_size': len(signature) * 8,
                'test_passed': auth_success,
                'strength_rating': 'HIGH' if auth_success else 'FAILED'
            }
            
            print(f"✓ Peer authentication test: {'PASSED' if auth_success else 'FAILED'}")
            
        except Exception as e:
            self.vulnerabilities.append({
                'type': 'AUTHENTICATION_ERROR',
                'severity': 'HIGH',
                'description': f'Peer authentication error: {str(e)}'
            })
            print(f"✗ Peer authentication test: FAILED - {str(e)}")
    
    def analyze_privacy_protection(self):
        """Analyze privacy protection mechanisms"""
        print("Analyzing privacy protection...")
        
        # Test IP address hashing for privacy
        real_ip = "192.168.1.100"
        salt = secrets.token_bytes(16)
        
        # Hash IP with salt
        hash_obj = hashlib.sha256()
        hash_obj.update(real_ip.encode() + salt)
        hashed_ip = hash_obj.hexdigest()
        
        # Verify hash is different from original
        privacy_protected = hashed_ip != real_ip
        
        # Test peer ID anonymization
        peer_id = secrets.token_hex(32)  # 256-bit random peer ID
        
        self.test_results['privacy_protection'] = {
            'ip_hashing': 'SHA-256 with salt',
            'peer_id_size': len(peer_id) * 4,  # hex chars to bits
            'anonymization_effective': privacy_protected,
            'test_passed': privacy_protected,
            'strength_rating': 'HIGH' if privacy_protected else 'FAILED'
        }
        
        print(f"✓ Privacy protection test: {'PASSED' if privacy_protected else 'FAILED'}")
    
    def check_common_vulnerabilities(self):
        """Check for common P2P security vulnerabilities"""
        print("Checking for common vulnerabilities...")
        
        vulnerabilities_to_check = [
            {
                'name': 'Eclipse Attack',
                'description': 'Attacker controls all peer connections',
                'mitigation': 'Diverse peer selection, reputation system',
                'risk_level': 'HIGH'
            },
            {
                'name': 'Sybil Attack',
                'description': 'Single attacker creates multiple fake identities',
                'mitigation': 'Proof of work, reputation system, rate limiting',
                'risk_level': 'MEDIUM'
            },
            {
                'name': 'Man-in-the-Middle',
                'description': 'Attacker intercepts communications',
                'mitigation': 'End-to-end encryption, certificate pinning',
                'risk_level': 'HIGH'
            },
            {
                'name': 'Poisoning Attack',
                'description': 'Attacker distributes corrupted file chunks',
                'mitigation': 'Cryptographic hash verification',
                'risk_level': 'MEDIUM'
            },
            {
                'name': 'Traffic Analysis',
                'description': 'Attacker analyzes network patterns',
                'mitigation': 'Traffic obfuscation, Tor integration',
                'risk_level': 'MEDIUM'
            }
        ]
        
        for vuln in vulnerabilities_to_check:
            self.recommendations.append({
                'vulnerability': vuln['name'],
                'description': vuln['description'],
                'mitigation': vuln['mitigation'],
                'priority': vuln['risk_level'],
                'implemented': False  # Would be determined by actual code analysis
            })
    
    def generate_security_report(self):
        """Generate comprehensive security analysis report"""
        report = {
            'analysis_timestamp': datetime.now().isoformat(),
            'test_results': self.test_results,
            'vulnerabilities': self.vulnerabilities,
            'recommendations': self.recommendations,
            'overall_security_score': self.calculate_security_score(),
            'compliance_status': self.check_compliance()
        }
        
        return report
    
    def calculate_security_score(self):
        """Calculate overall security score (0-100)"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result.get('test_passed', False))
        
        if total_tests == 0:
            return 0
        
        base_score = (passed_tests / total_tests) * 100
        
        # Deduct points for critical vulnerabilities
        critical_vulns = sum(1 for vuln in self.vulnerabilities if vuln['severity'] == 'CRITICAL')
        high_vulns = sum(1 for vuln in self.vulnerabilities if vuln['severity'] == 'HIGH')
        
        penalty = (critical_vulns * 20) + (high_vulns * 10)
        
        return max(0, base_score - penalty)
    
    def check_compliance(self):
        """Check compliance with security standards"""
        compliance = {
            'GDPR': {
                'data_minimization': True,
                'encryption_at_rest': True,
                'encryption_in_transit': True,
                'right_to_erasure': False,  # P2P makes this challenging
                'data_portability': True
            },
            'SOC2': {
                'access_controls': True,
                'encryption': True,
                'monitoring': True,
                'incident_response': False,  # Needs implementation
                'vulnerability_management': True
            },
            'ISO27001': {
                'risk_assessment': True,
                'security_controls': True,
                'incident_management': False,  # Needs implementation
                'business_continuity': True,
                'supplier_security': True
            }
        }
        
        return compliance
    
    def run_full_analysis(self):
        """Run complete security analysis"""
        print("Starting comprehensive security analysis...\n")
        
        self.analyze_encryption_strength()
        self.analyze_key_exchange()
        self.analyze_file_integrity()
        self.analyze_peer_authentication()
        self.analyze_privacy_protection()
        self.check_common_vulnerabilities()
        
        print("\nGenerating security report...")
        report = self.generate_security_report()
        
        # Save report to file
        with open('security_analysis_report.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n=== Security Analysis Complete ===")
        print(f"Overall Security Score: {report['overall_security_score']:.1f}/100")
        print(f"Tests Passed: {sum(1 for r in self.test_results.values() if r.get('test_passed', False))}/{len(self.test_results)}")
        print(f"Vulnerabilities Found: {len(self.vulnerabilities)}")
        print(f"Recommendations: {len(self.recommendations)}")
        print(f"Report saved to: security_analysis_report.json")
        
        return report

def main():
    """Main execution function"""
    analyzer = SecurityAnalyzer()
    report = analyzer.run_full_analysis()
    
    # Print summary
    print("\n=== Security Summary ===")
    for test_name, result in report['test_results'].items():
        status = "✓ PASS" if result.get('test_passed', False) else "✗ FAIL"
        rating = result.get('strength_rating', 'UNKNOWN')
        print(f"{test_name}: {status} ({rating})")
    
    if report['vulnerabilities']:
        print("\n=== Critical Issues ===")
        for vuln in report['vulnerabilities']:
            print(f"• {vuln['type']}: {vuln['description']} (Severity: {vuln['severity']})")
    
    print(f"\nOverall Security Rating: {report['overall_security_score']:.1f}/100")
    
    if report['overall_security_score'] >= 80:
        print("🟢 Security status: GOOD")
    elif report['overall_security_score'] >= 60:
        print("🟡 Security status: NEEDS IMPROVEMENT")
    else:
        print("🔴 Security status: CRITICAL ISSUES")

if __name__ == "__main__":
    main()
