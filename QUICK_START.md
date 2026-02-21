# 🚀 Quick Start Guide - Lead From Here

## What You Have

A fully functional, real-time collaborative voting application with:
- **React Frontend**: Beautiful, responsive UI with gradient design
- **Node.js/Express Backend**: WebSocket server for real-time synchronization
- **Live Voting**: See votes update across all browsers instantly

## Getting Started (3 simple steps)

### 1. Open the Terminal in VS Code
- Press `Ctrl+` (or `Cmd+`` on Mac) to open the integrated terminal
- Make sure you're in the project root directory

### 2. Start the Application
Run this command:
```bash
/opt/homebrew/bin/npm run dev
```

**Or use the VS Code Task:**
- Press `Cmd+Shift+B` (Mac) or `Ctrl+Shift+B` (Windows/Linux)
- Select "Start Lead From Here (Full Stack)"

Wait about 30 seconds for both servers to start. You'll see:
```
Server running on port 5000
Compiled successfully!
```

### 3. Open in Browser
- **Client**: Open http://localhost:3000
- **Test real-time sync**: Open the same URL in 2-3 different browser tabs or windows
- **Vote on behaviors**: Click the 🔴 🟠 🟢 buttons and watch votes update across all windows!

## Features to Try

1. **Vote on Behaviors** - Click any of the three emoji buttons
2. **See Live Updates** - Votes sync instantly across all open windows
3. **Switch Behaviors** - Click the "Behavior" buttons at the bottom to switch scenarios
4. **Real-time Collaboration** - Open multiple tabs to simulate group voting

## Next Steps

### Add Your Own Behaviors
The PowerPoint has example behaviors. To add custom scenarios:

**Option A: Add via API**
```bash
curl -X POST http://localhost:5000/api/behaviors \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Your Behavior Title",
    "description": "Description of the behavior"
  }'
```

**Option B: Edit the code**
Edit [server/index.js](./server/index.js) and update the `votingState.behaviors` array

### Use During a Workshop
1. Start the app with `npm run dev`
2. Share http://localhost:3000 with participants (on same network)
3. Display the app on a projector for everyone to see
4. Participants vote from their devices
5. Watch behavior voting patterns emerge in real-time!

## Stopping the Application
- Press `Ctrl+C` in the terminal (or click the trash icon in VS Code's terminal)

## Troubleshooting

**Port already in use?**
- Server: Change port in [server/index.js](./server/index.js) line with `const PORT`
- Client: Change port in [client/package.json](./client/package.json) by adding `"PORT=3001"` before `react-scripts start`

**Dependencies not installed?**
```bash
/opt/homebrew/bin/npm run install:all
```

**Need to restart?**
1. Stop the app (Ctrl+C)
2. Run: `/opt/homebrew/bin/npm run dev`

## Project Structure
```
lead-from-here/
├── server/           # Node.js backend with WebSocket
├── client/           # React frontend
├── package.json      # Root configuration
└── README.md         # Full documentation
```

---

**Happy facilitating! 🎯**

For more details, see the full [README.md](./README.md)
