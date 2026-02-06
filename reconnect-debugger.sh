#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔌 Reconnecting ADB & Debugger...${NC}\n"

# Wait for device
echo "Waiting for device..."
adb wait-for-device
sleep 2

# Check if device is connected
DEVICE=$(adb devices | grep -w "device" | head -1 | awk '{print $1}')

if [ -z "$DEVICE" ]; then
  echo -e "${RED}❌ No device found!${NC}"
  echo "Make sure device is connected and USB debugging is enabled"
  exit 1
fi

echo -e "${GREEN}✅ Device found: $DEVICE${NC}\n"

# Re-establish port forwarding
echo "Setting up port forwarding..."
adb reverse tcp:8081 tcp:8081
echo -e "${GREEN}✅ Port 8081 forwarding configured${NC}\n"

# Check Metro bundler
echo "Checking Metro bundler..."
if lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  echo -e "${GREEN}✅ Metro bundler is running${NC}\n"
else
  echo -e "${BLUE}⚠️  Metro not running. Start it with: npm start${NC}\n"
fi

echo -e "${GREEN}✅ Debugger reconnected!${NC}"
echo "You can now:"
echo "  1. Reload app (Ctrl+M on Android, or shake device)"
echo "  2. Start debugging (F5 in VS Code)"
