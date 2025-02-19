echo "Note: this assumes waggle is installed in ~/waggle"

echo "Killing any existing waggle process"
pkill waggle
echo "Waggle process killed"
cd ~/waggle/
echo "Starting waggle"
go build -v
echo "Build complete"
nohup ./waggle > waggle.log 2>&1 &
echo "Waggle started"
