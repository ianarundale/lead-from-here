import React from 'react';
import '../styles/BehaviorCard.css';

function BehaviorCard({ behavior, userVote }) {
  // Calculate total votes
  const totalVotes = behavior.votes.red + behavior.votes.amber + behavior.votes.green;
  
  // Calculate percentages
  const getPercentage = (count) => {
    return totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
  };

  return (
    <div className="behavior-card">
      <div className="scenario-section">
        <h2>Scenario</h2>
        <p className="scenario-text">{behavior.scenario}</p>
        
        {behavior.prompts && behavior.prompts.length > 0 && (
          <div className="prompts">
            <h3>Discussion Points</h3>
            <ul>
              {behavior.prompts.map((prompt, index) => (
                <li key={index}>{prompt}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {userVote && (
        <div className="user-vote-section">
          <h3>Your Vote</h3>
          <div className={`user-vote ${userVote}`}>
            {userVote === 'red' && '🔴 Not Okay - Crosses a line'}
            {userVote === 'amber' && '🟠 It Depends - Needs context'}
            {userVote === 'green' && '🟢 Totally Fine - Appropriate'}
          </div>
        </div>
      )}

      <div className="vote-stats">
        <h3>How People Voted</h3>
        <div className="vote-breakdown">
          <div className="stat red">
            <div className="vote-info">
              <span className="emoji">🔴</span>
              <span className="label">Not Okay</span>
            </div>
            <div className="vote-details">
              <span className="count">{behavior.votes.red}</span>
              <span className="percentage">{getPercentage(behavior.votes.red)}%</span>
            </div>
            <div className="vote-bar">
              <div 
                className="bar-fill red-fill"
                style={{ width: `${getPercentage(behavior.votes.red)}%` }}
              ></div>
            </div>
          </div>

          <div className="stat amber">
            <div className="vote-info">
              <span className="emoji">🟠</span>
              <span className="label">It Depends</span>
            </div>
            <div className="vote-details">
              <span className="count">{behavior.votes.amber}</span>
              <span className="percentage">{getPercentage(behavior.votes.amber)}%</span>
            </div>
            <div className="vote-bar">
              <div 
                className="bar-fill amber-fill"
                style={{ width: `${getPercentage(behavior.votes.amber)}%` }}
              ></div>
            </div>
          </div>

          <div className="stat green">
            <div className="vote-info">
              <span className="emoji">🟢</span>
              <span className="label">Totally Fine</span>
            </div>
            <div className="vote-details">
              <span className="count">{behavior.votes.green}</span>
              <span className="percentage">{getPercentage(behavior.votes.green)}%</span>
            </div>
            <div className="vote-bar">
              <div 
                className="bar-fill green-fill"
                style={{ width: `${getPercentage(behavior.votes.green)}%` }}
              ></div>
            </div>
          </div>
        </div>
        <p className="total-votes">Total votes: {totalVotes}</p>
      </div>
    </div>
  );
}

export default BehaviorCard;
