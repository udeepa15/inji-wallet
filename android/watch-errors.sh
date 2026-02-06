#!/bin/bash

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# App package name
APP_PACKAGE="io.mosip.inji.wallet"

# Display menu
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  🔍 Inji Wallet Log Monitor${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}\n"
echo "Choose what to view:"
echo "1) 🚨 Errors ONLY (App & System errors)"
echo "2) ✅ Normal logs ONLY (App flow)"
echo "3) 🔄 Both Errors & Normal logs"
echo "4) 🎯 React Native + Console logs only"
echo "5) 📋 All Inji wallet logs (verbose)"
echo ""
read -p "Enter your choice (1-5): " choice

# Clear logcat buffer
adb logcat -c

echo -e "\n${BLUE}Starting monitoring...${NC}"
echo -e "${BLUE}Press Ctrl+C to stop\n${NC}"

case $choice in
  1)
    # Errors only - show all error logs from app
    echo -e "${CYAN}Showing ERRORS from $APP_PACKAGE${NC}\n"
    adb logcat | grep -E "ERROR|FATAL|Exception|error:" | head -100
    adb logcat | while IFS= read -r line
    do
      if [[ $line =~ "ERROR" ]] || [[ $line =~ "error" ]] || [[ $line =~ "Exception" ]] || [[ $line =~ "FATAL" ]] || [[ $line =~ "$APP_PACKAGE" && $line =~ "E/" ]]; then
        echo -e "${RED}❌ $line${NC}"
      fi
    done
    ;;
  2)
    # Normal logs only - exclude errors/warnings
    echo -e "${CYAN}Showing NORMAL logs from $APP_PACKAGE${NC}\n"
    adb logcat | while IFS= read -r line
    do
      if [[ $line =~ "$APP_PACKAGE" ]] && [[ ! $line =~ "ERROR" ]] && [[ ! $line =~ "error" ]] && [[ ! $line =~ "WARN" ]] && [[ ! $line =~ "warning" ]] && [[ ! $line =~ "Exception" ]] && [[ ! $line =~ "FATAL" ]]; then
        echo -e "${GREEN}✅ $line${NC}"
      fi
    done
    ;;
  3)
    # Both errors and normal logs with color coding
    echo -e "${CYAN}Showing ALL logs from $APP_PACKAGE${NC}\n"
    adb logcat | while IFS= read -r line
    do
      if [[ $line =~ "$APP_PACKAGE" ]]; then
        if [[ $line =~ "ERROR" ]] || [[ $line =~ "error" ]] || [[ $line =~ "E/" ]] || [[ $line =~ "Exception" ]] || [[ $line =~ "FATAL" ]]; then
          echo -e "${RED}❌ $line${NC}"
        elif [[ $line =~ "WARN" ]] || [[ $line =~ "warning" ]] || [[ $line =~ "W/" ]]; then
          echo -e "${YELLOW}⚠️ $line${NC}"
        else
          echo -e "${GREEN}✅ $line${NC}"
        fi
      fi
    done
    ;;
  4)
    # React Native logs - console.log and ReactNative tags
    echo -e "${CYAN}Showing REACT NATIVE & CONSOLE logs${NC}\n"
    adb logcat | while IFS= read -r line
    do
      if [[ $line =~ "ReactNative" ]] || [[ $line =~ "ReactNativeJS" ]] || [[ $line =~ "getCredentialType" ]] || [[ $line =~ "Display" ]] || [[ $line =~ "wellknown" ]] || [[ $line =~ "console.log" ]]; then
        if [[ $line =~ "ERROR" ]] || [[ $line =~ "error" ]] || [[ $line =~ "Exception" ]]; then
          echo -e "${RED}❌ $line${NC}"
        else
          echo -e "${PURPLE}📱 $line${NC}"
        fi
      fi
    done
    ;;
  5)
    # All logs from app - verbose
    echo -e "${CYAN}Showing ALL VERBOSE logs from $APP_PACKAGE${NC}\n"
    adb logcat | grep "$APP_PACKAGE"
    ;;
  *)
    echo -e "${RED}Invalid choice. Exiting.${NC}"
    exit 1
    ;;
esac


