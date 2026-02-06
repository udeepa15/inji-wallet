#!/bin/bash

# Debug Java code in Android app
# Usage: ./debug-java.sh

echo "🔍 Finding Inji Wallet process..."
PID=$(adb shell ps | grep io.mosip.inji.wallet | awk '{print $2}')

if [ -z "$PID" ]; then
    echo "❌ App is not running. Starting app..."
    adb shell am start -n io.mosip.inji.wallet/io.mosip.residentapp.MainActivity
    sleep 3
    PID=$(adb shell ps | grep io.mosip.inji.wallet | awk '{print $2}')
fi

echo "📱 App PID: $PID"

echo "🔗 Setting up port forwarding..."
adb forward tcp:5005 jdwp:$PID

echo "✅ Java debugger ready on port 5005"
echo ""
echo "Next steps:"
echo "1. Open VS Code"
echo "2. Go to Run and Debug (Cmd+Shift+D)"
echo "3. Select 'Debug Android App (Java)'"
echo "4. Press F5 to attach"
echo "5. Set breakpoints in Java files (app/src/main/java/...)"
echo ""
echo "Press Ctrl+C to stop port forwarding when done."

# Keep the script running to maintain the port forward
while true; do
    sleep 1
done
