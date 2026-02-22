import React from 'react';
import '../styles/VotingPanel.css';

function VotingPanel({ behavior, onVote, hasVoted, userVote }) {
  const selectedLabel = {
    red: 'Not Okay',
    amber: 'It Depends',
    green: 'Totally Fine'
  }[userVote];

  return (
    <div className="voting-panel">
      <div className="voting-panel-header">
        <p className="voting-panel-eyebrow">Cast Your Vote</p>
        <h3>How do you feel about this behavior?</h3>
        {behavior && (
          <p className="voting-panel-context">Scenario {behavior.id}</p>
        )}
        <div className="voting-panel-selection-row" aria-live="polite">
          {userVote ? (
            <span className={`voting-selection-pill ${userVote}`}>
              Selected: {selectedLabel}
            </span>
          ) : (
            <span className="voting-selection-pill empty">Choose one option</span>
          )}
        </div>
      </div>
      <div className="voting-buttons">
        <button
          className={`vote-btn red ${userVote === 'red' ? 'selected' : ''}`}
          onClick={() => onVote('red')}
          title="Not okay. Crosses a line."
        >
          <span className="emoji">🔴</span>
          <span className="text">Not Okay</span>
          <span className="description">Crosses a line</span>
          {userVote === 'red' && <span className="checkmark">✓</span>}
        </button>
        
        <button
          className={`vote-btn amber ${userVote === 'amber' ? 'selected' : ''}`}
          onClick={() => onVote('amber')}
          title="It depends. Needs context or a conversation."
        >
          <span className="emoji">🟠</span>
          <span className="text">It Depends</span>
          <span className="description">Needs context</span>
          {userVote === 'amber' && <span className="checkmark">✓</span>}
        </button>
        
        <button
          className={`vote-btn green ${userVote === 'green' ? 'selected' : ''}`}
          onClick={() => onVote('green')}
          title="Totally fine"
        >
          <span className="emoji">🟢</span>
          <span className="text">Totally Fine</span>
          <span className="description">Appropriate</span>
          {userVote === 'green' && <span className="checkmark">✓</span>}
        </button>
      </div>
      
      {hasVoted && <div className="vote-feedback">✓ Vote recorded!</div>}
    </div>
  );
}

export default VotingPanel;
