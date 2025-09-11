#!/bin/bash

echo "🚀 Building Quick Resume AI Extension for Production"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
rm -rf dist/
mkdir -p dist

# 2. Create extension directory
echo -e "${YELLOW}Preparing extension files...${NC}"
cp -r extension/ dist/extension/

# 3. Remove development files
echo -e "${YELLOW}Removing development files...${NC}"
find dist/extension -name "*.map" -delete
find dist/extension -name ".DS_Store" -delete

# 4. Create ZIP for Chrome Web Store
echo -e "${YELLOW}Creating extension.zip...${NC}"
cd dist
zip -r extension.zip extension/ -x "*.DS_Store" -x "__MACOSX" -x "*.git*"
cd ..

# 5. Display file size
SIZE=$(du -sh dist/extension.zip | cut -f1)
echo -e "${GREEN}✅ Extension built successfully!${NC}"
echo -e "📦 Package size: ${SIZE}"
echo -e "📁 Location: dist/extension.zip"

echo ""
echo -e "${GREEN}Next steps for Chrome Web Store deployment:${NC}"
echo "1. Go to https://chrome.google.com/webstore/developer/dashboard"
echo "2. Click 'New Item' to create a new extension"
echo "3. Upload dist/extension.zip"
echo "4. Fill in the required details:"
echo "   - Name: Quick Resume AI"
echo "   - Description: Instant AI-powered resume generation for any job"
echo "   - Category: Productivity"
echo "   - Language: English"
echo "5. Add screenshots (1280x800 or 640x400)"
echo "6. Set pricing: Free"
echo "7. Submit for review"

echo ""
echo -e "${YELLOW}Testing locally before publishing:${NC}"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable Developer Mode"
echo "3. Click 'Load unpacked'"
echo "4. Select dist/extension/ folder"
echo "5. Test all features thoroughly"