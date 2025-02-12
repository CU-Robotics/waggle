cd client
npm run build
cd ..
go build
nohup ./waggle > waggle.log 2>&1 &
