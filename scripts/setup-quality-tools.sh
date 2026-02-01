#!/bin/bash

# Setup Script für Code Quality Tools
# Installiert alle notwendigen Tools für Code-Analyse

set -e

echo "🚀 Setting up Code Quality Tools..."
echo ""

# Farben für Output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Knip (bereits installiert)
echo -e "${BLUE}📦 Checking Knip...${NC}"
if npm list knip > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Knip already installed${NC}"
else
    echo -e "${YELLOW}Installing Knip...${NC}"
    npm install --save-dev knip
fi
echo ""

# 2. JSCPD - Duplicate Code Detection
echo -e "${BLUE}📦 Installing JSCPD...${NC}"
npm install --global jscpd || echo -e "${YELLOW}⚠️  JSCPD global installation failed, will use npx${NC}"
echo ""

# 3. Madge - Circular Dependencies
echo -e "${BLUE}📦 Installing Madge...${NC}"
npm install --global madge || echo -e "${YELLOW}⚠️  Madge global installation failed, will use npx${NC}"
echo ""

# 4. ES6-Plato - Code Complexity
echo -e "${BLUE}📦 Installing ES6-Plato...${NC}"
npm install --global es6-plato || echo -e "${YELLOW}⚠️  ES6-Plato global installation failed, will use npx${NC}"
echo ""

# 5. Cost of Modules
echo -e "${BLUE}📦 Installing Cost of Modules...${NC}"
npm install --global cost-of-modules || echo -e "${YELLOW}⚠️  Cost-of-modules global installation failed, will use npx${NC}"
echo ""

# Verzeichnisse erstellen
echo -e "${BLUE}📁 Creating report directories...${NC}"
mkdir -p reports/knip
mkdir -p reports/complexity
mkdir -p reports/duplicates
mkdir -p reports/dependencies
echo -e "${GREEN}✅ Directories created${NC}"
echo ""

# .gitignore aktualisieren
echo -e "${BLUE}📝 Updating .gitignore...${NC}"
if ! grep -q "reports/" .gitignore 2>/dev/null; then
    echo "" >> .gitignore
    echo "# Code Quality Reports" >> .gitignore
    echo "reports/" >> .gitignore
    echo "complexity-report/" >> .gitignore
    echo "dependency-graph.svg" >> .gitignore
    echo "knip-report.json" >> .gitignore
    echo -e "${GREEN}✅ .gitignore updated${NC}"
else
    echo -e "${GREEN}✅ .gitignore already configured${NC}"
fi
echo ""

# Test-Runs
echo -e "${BLUE}🧪 Running test checks...${NC}"
echo ""

echo -e "${BLUE}1. Testing Knip...${NC}"
npx knip --version
echo ""

echo -e "${BLUE}2. Testing JSCPD...${NC}"
npx jscpd --version
echo ""

echo -e "${BLUE}3. Testing Madge...${NC}"
npx madge --version
echo ""

echo -e "${BLUE}4. Testing ES6-Plato...${NC}"
npx es6-plato --version || echo "ES6-Plato installed"
echo ""

# Zusammenfassung
echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}Available commands:${NC}"
echo "  npm run knip                 - Find unused code"
echo "  npm run check:duplicates     - Find duplicate code"
echo "  npm run check:circular       - Find circular dependencies"
echo "  npm run check:complexity     - Analyze code complexity"
echo "  npm run check:console        - Find console.log statements"
echo "  npm run quality              - Run all quality checks"
echo "  npm run audit:full           - Full security + quality audit"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo "  docs/CODE_QUALITY.md         - Code Quality Guide"
echo "  DEVELOPMENT.md               - Development Guide"
echo ""
echo -e "${YELLOW}💡 Tip: Run 'npm run quality' before every PR!${NC}"
echo ""
