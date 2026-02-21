import React, { useState, useEffect } from 'react';
import './App.css';
import VotingPanel from './components/VotingPanel';
import BehaviorCard from './components/BehaviorCard';

function App() {
  const [votingState, setVotingState] = useState({
    behaviors: [],
    currentBehaviorId: 1,
    syncMode: true
  });
  const [localBehaviorId, setLocalBehaviorId] = useState(1); // Track independent navigation
  const [userVotes, setUserVotes] = useState({}); // Track user's votes: { behaviorId: 'red'/'amber'/'green' }
  const [hasVoted, setHasVoted] = useState(false);
  const [ws, setWs] = useState(null);
  const [userId] = useState(() => {
    // Generate or retrieve a user ID for this session
    let id = localStorage.getItem('userId');
    if (!id) {
      id = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('userId', id);
    }
    return id;
  });

  useEffect(() => {
    // Connect to WebSocket server
    // In production (AWS), use environment variable
    // In development, use localhost:5001
    const getBackendUrl = () => {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      if (backendUrl) {
        return backendUrl;
      }
      // Fallback for local development
      return `${window.location.protocol}//${window.location.hostname}:5001`;
    };

    const backendUrl = getBackendUrl();
    const wsProtocol = backendUrl.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = backendUrl.replace(/^https?:\/\//, '').split(':')[0];
    const wsPort = backendUrl.includes(':') ? ':' + backendUrl.split(':').pop() : '';
    const websocket = new WebSocket(`${wsProtocol}//${wsHost}${wsPort || ':5001'}`);

    websocket.onopen = () => {
      console.log('Connected to server');
      // Send user ID to server
      websocket.send(JSON.stringify({
        type: 'CLIENT_CONNECT',
        userId: userId
      }));
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'INITIAL_STATE' || message.type === 'STATE_UPDATE' || message.type === 'BEHAVIOR_CHANGED') {
        setVotingState(message.data);
        // In sync mode, sync the local behavior ID with server
        if (message.data.syncMode) {
          setLocalBehaviorId(message.data.currentBehaviorId);
        }
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setWs(websocket);

    return () => {
      if (websocket) websocket.close();
    };
  }, [userId]);

  // Use local behavior ID in independent mode, server's in sync mode
  const displayBehaviorId = votingState.syncMode ? votingState.currentBehaviorId : localBehaviorId;
  const currentBehavior = votingState.behaviors.find(
    (b) => b.id === displayBehaviorId
  );

  const userVoteForCurrentBehavior = currentBehavior 
    ? userVotes[currentBehavior.id] 
    : null;

  const handleBehaviorNavigation = (behaviorId) => {
    if (votingState.syncMode) {
      // In sync mode, send to server to sync all clients
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'SET_BEHAVIOR',
          behaviorId: behaviorId
        }));
      }
    } else {
      // In independent mode, just update locally
      setLocalBehaviorId(behaviorId);
    }
  };

  const handleVote = (vote) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'VOTE',
        behaviorId: displayBehaviorId,
        vote: vote,
        userId: userId
      }));
      // Update local user votes
      setUserVotes(prev => ({
        ...prev,
        [displayBehaviorId]: vote
      }));
      setHasVoted(true);
      setTimeout(() => setHasVoted(false), 2000);
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-top">
          <h1>🎯 Lead From Here</h1>
          <div className="sync-toggle">
            <label>
              <input
                type="checkbox"
                checked={votingState.syncMode}
                onChange={() => {
                  if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'TOGGLE_SYNC'
                    }));
                  }
                }}
              />
              <span className="toggle-label">
                {votingState.syncMode ? '🔗 Synchronized' : '👤 Independent'}
              </span>
            </label>
          </div>
        </div>
        <p>Interactive Leadership Behavior Assessment</p>
      </header>

      <main className="app-main">
        <div className="behaviors-list">
          <h3>Navigate Scenarios ({displayBehaviorId} of {votingState.behaviors.length})</h3>
          <div className="behavior-buttons">
            {votingState.behaviors.map((behavior) => (
              <button
                key={behavior.id}
                className={`behavior-btn ${behavior.id === displayBehaviorId ? 'active' : ''} ${userVotes[behavior.id] ? 'voted' : ''}`}
                onClick={() => handleBehaviorNavigation(behavior.id)}
                title={behavior.scenario}
              >
                {behavior.id}
                {userVotes[behavior.id] && (
                  <span className={`vote-indicator ${userVotes[behavior.id]}`}>
                    {userVotes[behavior.id] === 'red' && '🔴'}
                    {userVotes[behavior.id] === 'amber' && '🟠'}
                    {userVotes[behavior.id] === 'green' && '🟢'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {currentBehavior && (
          <>
            <BehaviorCard 
              behavior={currentBehavior} 
              userVote={userVoteForCurrentBehavior}
            />
            <VotingPanel
              behavior={currentBehavior}
              onVote={handleVote}
              hasVoted={hasVoted}
              userVote={userVoteForCurrentBehavior}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;

