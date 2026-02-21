# lead-from-here


# Lead From Here

Interactive real-time voting application for assessing leadership behaviors. Multiple users can connect simultaneously and vote on whether displayed behaviors are appropriate, need context, or cross a line.

## Features

- ✅ Real-time synchronized voting across multiple browsers using WebSocket
- ✅ Three-option voting system:
  - 🔴 Red - Not okay. Crosses a line.
  - 🟠 Amber - It depends. Needs context or a conversation.
  - 🟢 Green - Totally fine
- ✅ Live vote count updates
- ✅ Multiple behavior scenarios
- ✅ Responsive design for mobile and desktop
- ✅ Beautiful gradient UI with smooth animations

## Technology Stack

**Frontend:**
- React 18
- WebSocket client for real-time communication
- CSS3 with animations and responsive design

**Backend:**
- Node.js + Express
- WebSocket server (ws library) for real-time sync
- REST API for behavior management

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### 1. Install All Dependencies

From the root directory:

```bash
npm run install:all
```

This will install dependencies for the root, server, and client.

### 2. Start the Application

From the root directory:

```bash
npm run dev
```

This starts both the server (port 5000) and client (port 3000) concurrently.

**Alternatively, run them separately:**

Terminal 1 - Start the server:
```bash
cd server
npm run dev
```

Terminal 2 - Start the React app:
```bash
cd client
npm start
```

### 3. Open in Browser

- Client: http://localhost:3000
- Server API: http://localhost:5000

## How to Use

1. **Open the application** in your browser
2. **Share the URL** with other participants (they can open http://localhost:3000)
3. **View the behavior** displayed in the main card
4. **Click a voting button** to cast your vote:
   - 🔴 for "Not Okay"
   - 🟠 for "It Depends"
   - 🟢 for "Totally Fine"
5. **Watch the vote counts update in real-time** as others vote
6. **Switch behaviors** using the buttons at the bottom
7. **Reflect on the results** using the discussion prompts from the PowerPoint presentation

## Managing Behaviors

### Add a New Behavior

```bash
curl -X POST http://localhost:5000/api/behaviors \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Behavior Title",
    "description": "Description of the behavior"
  }'
```

### Get All Behaviors

```bash
curl http://localhost:5000/api/behaviors
```

### Get Current Voting State

```bash
curl http://localhost:5000/api/state
```

## Project Structure

```
lead-from-here/
├── server/
│   ├── index.js           # Express + WebSocket server
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── BehaviorCard.js
│   │   │   └── VotingPanel.js
│   │   ├── styles/
│   │   │   ├── BehaviorCard.css
│   │   │   └── VotingPanel.css
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   ├── public/
│   │   └── index.html
│   └── package.json
├── package.json           # Root package with dev scripts
└── README.md
```

## Development Notes

- The WebSocket connection is established automatically when the client loads
- Vote data is stored in-memory on the server (resets on server restart)
- The app is mobile-responsive
- All votes are broadcast to all connected clients in real-time

## Future Enhancements

- Persist voting data to a database
- Add user authentication
- Display voting statistics and charts
- Add a presenter/facilitator mode
- Export voting results
- Add discussion threading
- Support for custom scenarios