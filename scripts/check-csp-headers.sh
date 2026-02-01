#!/bin/bash
# Check CSP headers being sent by the server

echo "Checking CSP headers for www.abdulkerimsesli.de..."
echo ""
echo "=== Response Headers ==="
curl -I https://www.abdulkerimsesli.de/ 2>/dev/null | grep -i "content-security-policy"
echo ""
echo "If you see 'Content-Security-Policy-Report-Only', that's the problem!"
echo "You should only see 'Content-Security-Policy' (without Report-Only)"
