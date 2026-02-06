#!/bin/bash
# Cloudflare Workers Deployment Script
# Usage: ./deploy.sh [worker-name]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Cloudflare Workers Deployment${NC}\n"

# Function to deploy AI Search Proxy
deploy_ai_search() {
  echo -e "${YELLOW}📦 Deploying AI Search Proxy...${NC}"
  wrangler deploy --config wrangler.workers.toml
  echo -e "${GREEN}✅ AI Search Proxy deployed${NC}\n"
}

# Function to deploy YouTube Proxy
deploy_youtube() {
  echo -e "${YELLOW}📺 Deploying YouTube API Proxy...${NC}"
  wrangler deploy --config wrangler.workers.toml --env youtube
  echo -e "${GREEN}✅ YouTube API Proxy deployed${NC}\n"
}

# Function to check secrets
check_secrets() {
  echo -e "${YELLOW}🔐 Checking secrets...${NC}"
  
  # Check AI Search Proxy secret
  if wrangler secret list --config wrangler.workers.toml 2>/dev/null | grep -q "GROQ_API_KEY"; then
    echo -e "${GREEN}✓ GROQ_API_KEY configured${NC}"
  elif wrangler secret list --config wrangler.workers.toml 2>/dev/null | grep -q "GEMINI_API_KEY"; then
    echo -e "${YELLOW}⚠ GEMINI_API_KEY found (deprecated)${NC}"
    echo "  Consider migrating to Groq (free): wrangler secret put GROQ_API_KEY --config wrangler.workers.toml"
  else
    echo -e "${RED}✗ GROQ_API_KEY missing${NC}"
    echo "  Get free key at: https://console.groq.com/keys"
    echo "  Run: wrangler secret put GROQ_API_KEY --config wrangler.workers.toml"
  fi
  
  # Check YouTube Proxy secret
  if wrangler secret list --config wrangler.workers.toml --env youtube 2>/dev/null | grep -q "YOUTUBE_API_KEY"; then
    echo -e "${GREEN}✓ YOUTUBE_API_KEY configured${NC}"
  else
    echo -e "${RED}✗ YOUTUBE_API_KEY missing${NC}"
    echo "  Run: wrangler secret put YOUTUBE_API_KEY --config wrangler.workers.toml --env youtube"
  fi
  
  echo ""
}

# Main deployment logic
case "$1" in
  "ai-search"|"search")
    deploy_ai_search
    ;;
  "youtube"|"yt")
    deploy_youtube
    ;;
  "all"|"")
    check_secrets
    deploy_ai_search
    deploy_youtube
    echo -e "${GREEN}🎉 All workers deployed successfully!${NC}"
    ;;
  "check")
    check_secrets
    ;;
  *)
    echo "Usage: $0 [worker-name]"
    echo ""
    echo "Workers:"
    echo "  ai-search, search    Deploy AI Search Proxy"
    echo "  youtube, yt          Deploy YouTube API Proxy"
    echo "  all                  Deploy all workers (default)"
    echo "  check                Check secrets configuration"
    echo ""
    echo "Examples:"
    echo "  $0                   # Deploy all workers"
    echo "  $0 ai-search         # Deploy only AI Search Proxy"
    echo "  $0 youtube           # Deploy only YouTube Proxy"
    echo "  $0 check             # Check secrets"
    exit 1
    ;;
esac
