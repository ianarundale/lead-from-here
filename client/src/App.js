import React, { useState, useEffect } from 'react';
import './App.css';
import VotingPanel from './components/VotingPanel';
import BehaviorCard from './components/BehaviorCard';

function App() {
  const [presentationMode, setPresentationMode] = useState(false);
  const [isScenarioNavCollapsed, setIsScenarioNavCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  });
  const [votingState, setVotingState] = useState({
    behaviors: [],
    currentBehaviorId: 1,
    syncMode: true,
    connectedUsers: 0
  });
  const [localBehaviorId, setLocalBehaviorId] = useState(1); // Track independent navigation
  const [userVotes, setUserVotes] = useState({}); // Track user's votes: { behaviorId: 'red'/'amber'/'green' }
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
    const getWebSocketUrl = () => {
      const normalizeWebSocketUrl = (url) => {
        try {
          const parsed = new URL(url, window.location.origin);
          if (
            parsed.hostname.includes('.execute-api.') &&
            (parsed.pathname === '' || parsed.pathname === '/')
          ) {
            parsed.pathname = '/$default';
          }
          return parsed.toString();
        } catch {
          return url;
        }
      };

      const wsUrl = process.env.REACT_APP_WS_URL?.trim();
      if (wsUrl) {
        return normalizeWebSocketUrl(wsUrl);
      }

      return normalizeWebSocketUrl('ws://localhost:8080');
    };

    const websocket = new WebSocket(getWebSocketUrl());

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
        if (message.type === 'INITIAL_STATE') {
          const restoredVotes = {};
          message.data.behaviors.forEach(b => {
            if (b.userVotes && b.userVotes[userId]) {
              restoredVotes[b.id] = b.userVotes[userId];
            }
          });
          setUserVotes(restoredVotes);
          setIsLoading(false);
        }
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

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsScenarioNavCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Use local behavior ID in independent mode, server's in sync mode
  const displayBehaviorId = localBehaviorId;
  const currentBehavior = votingState.behaviors.find(
    (b) => b.id === displayBehaviorId
  );

  const userVoteForCurrentBehavior = currentBehavior 
    ? userVotes[currentBehavior.id] 
    : null;

  const handleBehaviorNavigation = (behaviorId) => {
    setLocalBehaviorId(behaviorId); // Always update locally for instant feedback
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setIsScenarioNavCollapsed(true);
    }
    if (votingState.syncMode) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'SET_BEHAVIOR',
          behaviorId: behaviorId
        }));
      }
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
        <div className="top-status-bar">
          <div className="connected-users-badge" aria-live="polite">
            👥 {votingState.connectedUsers || 0} connected
          </div>
          <div className="status-controls">
            <button
              type="button"
              className={`presentation-toggle ${presentationMode ? 'active' : ''}`}
              onClick={() => setPresentationMode(prev => !prev)}
              aria-pressed={presentationMode}
              title="Toggle facilitator presentation mode"
            >
              {presentationMode ? '📺 Presentation On' : '📺 Presentation'}
            </button>
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
                  {votingState.syncMode ? "🔗 Sync'd" : '👤 Independent'}
                </span>
              </label>
            </div>
          </div>
        </div>
        <div className="header-top">
          <h1>🎯 Lead From Here v2</h1>
        </div>
        <p>Interactive Leadership Behavior Assessment</p>
      </header>

      <main className={`app-main ${currentBehavior && !presentationMode ? 'has-mobile-voter-panel' : ''}`}>
        {isLoading && (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading scenarios…</p>
          </div>
        )}
        <div className={`behaviors-list ${presentationMode ? 'presenter-mode' : ''}`} style={isLoading ? { visibility: 'hidden' } : {}}>
          <div className="behaviors-list-inner">
            {presentationMode ? (
              <>
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
              </>
            ) : (
              <>
                <div className="behaviors-list-header">
                  <button
                    type="button"
                    className="scenario-nav-toggle"
                    onClick={() => setIsScenarioNavCollapsed(prev => !prev)}
                    aria-expanded={!isScenarioNavCollapsed}
                    aria-label={`${isScenarioNavCollapsed ? 'Expand' : 'Collapse'} scenario navigation`}
                  >
                    <span className="scenario-nav-toggle-label">
                      🧭 Scenario {displayBehaviorId} of {votingState.behaviors.length}
                    </span>
                    <span className={`scenario-nav-toggle-chevron ${isScenarioNavCollapsed ? '' : 'open'}`} aria-hidden="true">
                      ▾
                    </span>
                  </button>
                </div>
                {!isScenarioNavCollapsed && (
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
                )}
              </>
            )}
          </div>
        </div>

        {currentBehavior && (
          <div className={`content-layout ${presentationMode ? 'presentation-mode' : ''}`}>
            <BehaviorCard 
              behavior={currentBehavior} 
              userVote={userVoteForCurrentBehavior}
              presentationMode={presentationMode}
            />
            {!presentationMode && (
              <div className="voting-panel-column">
                <VotingPanel
                  behavior={currentBehavior}
                  onVote={handleVote}
                  hasVoted={hasVoted}
                  userVote={userVoteForCurrentBehavior}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
