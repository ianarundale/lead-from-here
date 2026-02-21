const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// CORS is only needed in development where the React dev server (port 3000)
// makes cross-origin requests to this server (port 5001). In production the
// React build is served from this same Express process, so all requests are
// same-origin and the cors middleware is not required.
if (process.env.NODE_ENV !== 'production') {
  app.use(cors());
}
app.use(express.json());

// Load scenarios from scenarios.json
const scenariosPath = path.join(__dirname, '..', 'scenarios.json');
const scenariosData = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'));

// Initialize behaviors from scenarios
const behaviors = scenariosData.scenarios.map((scenario, index) => ({
  id: index + 1,
  scenario: scenario.scenario,
  prompts: scenario.prompts,
  votes: { red: 0, amber: 0, green: 0 },
  userVotes: {} // Track individual user votes: { userId: 'red'/'amber'/'green' }
}));

// Store voting data
let votingState = {
  behaviors,
  currentBehaviorId: 1,
  legend: scenariosData.legend,
  syncMode: true // Toggle between synchronized and independent navigation
};

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New client connected');
  
  // Send current state to new client
  ws.send(JSON.stringify({
    type: 'INITIAL_STATE',
    data: votingState
  }));

  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'VOTE') {
        const { behaviorId, vote, userId } = data;
        const behavior = votingState.behaviors.find(b => b.id === behaviorId);
        
        if (behavior) {
          // Remove previous vote from this user on this behavior if exists
          if (behavior.userVotes[userId]) {
            const previousVote = behavior.userVotes[userId];
            behavior.votes[previousVote]--;
          }
          
          // Record new vote
          behavior.userVotes[userId] = vote;
          behavior.votes[vote]++;
          
          // Broadcast updated state to all clients
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'STATE_UPDATE',
                data: votingState
              }));
            }
          });
        }
      }
      
      if (data.type === 'SET_BEHAVIOR') {
        votingState.currentBehaviorId = data.behaviorId;
        
        // Only broadcast if sync mode is ON
        if (votingState.syncMode) {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'BEHAVIOR_CHANGED',
                data: votingState
              }));
            }
          });
        }
      }

      if (data.type === 'TOGGLE_SYNC') {
        votingState.syncMode = !votingState.syncMode;
        
        // Broadcast sync mode change to all clients
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'STATE_UPDATE',
              data: votingState
            }));
          }
        });
      }

      if (data.type === 'RESET_VOTES') {
        const { behaviorId } = data;
        const behavior = votingState.behaviors.find(b => b.id === behaviorId);
        if (behavior) {
          behavior.votes = { red: 0, amber: 0, green: 0 };
          
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'STATE_UPDATE',
                data: votingState
              }));
            }
          });
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// REST endpoints
app.get('/api/behaviors', (req, res) => {
  res.json(votingState.behaviors);
});

app.post('/api/behaviors', (req, res) => {
  const { title, description } = req.body;
  const newBehavior = {
    id: Math.max(...votingState.behaviors.map(b => b.id), 0) + 1,
    title,
    description,
    votes: { red: 0, amber: 0, green: 0 }
  };
  votingState.behaviors.push(newBehavior);
  
  // Broadcast to all WebSocket clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'BEHAVIOR_ADDED',
        data: votingState
      }));
    }
  });
  
  res.json(newBehavior);
});

app.get('/api/state', (req, res) => {
  res.json(votingState);
});

app.get('/status', (req, res) => {
  res.json({ version: process.env.DEPLOY_VERSION || 'dev' });
});

// Reset all votes (GET /reset)
app.get('/reset', (req, res) => {
  votingState.behaviors.forEach(behavior => {
    behavior.votes = { red: 0, amber: 0, green: 0 };
    behavior.userVotes = {};
  });
  votingState.currentBehaviorId = 1;

  // Broadcast updated state to all WebSocket clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'STATE_UPDATE',
        data: votingState
      }));
    }
  });

  res.json({ success: true, message: 'All votes have been reset' });
});

// Serve static React files
app.use(express.static(path.join(__dirname, '../client/build')));

// Fallback to React index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
