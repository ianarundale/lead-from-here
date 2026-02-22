import React, { useEffect, useState } from 'react';
import '../styles/BehaviorCard.css';

function BehaviorCard({
  behavior,
  userVote,
  presentationMode = false,
  canToggleScenarioNav = false,
  isScenarioNavExpanded = false,
  onToggleScenarioNav
}) {
  const [isVoteStatsCollapsed, setIsVoteStatsCollapsed] = useState(true);
  const [isScenarioPillAnimating, setIsScenarioPillAnimating] = useState(false);

  useEffect(() => {
    if (presentationMode) {
      setIsVoteStatsCollapsed(false);
    }
  }, [presentationMode]);

  useEffect(() => {
    setIsScenarioPillAnimating(true);
    const timer = setTimeout(() => setIsScenarioPillAnimating(false), 800);
    return () => clearTimeout(timer);
  }, [behavior.id]);

  // Calculate total votes
  const totalVotes = behavior.votes.red + behavior.votes.amber + behavior.votes.green;
  
  // Calculate percentages
  const getPercentage = (count) => {
    return totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
  };

  const voteOptions = [
    { key: 'red', label: 'Not Okay', emoji: '🔴', count: behavior.votes.red },
    { key: 'amber', label: 'It Depends', emoji: '🟠', count: behavior.votes.amber },
    { key: 'green', label: 'Totally Fine', emoji: '🟢', count: behavior.votes.green }
  ];

  const sortedVotes = [...voteOptions].sort((a, b) => b.count - a.count);
  const topVote = sortedVotes[0];
  const secondVote = sortedVotes[1];
  const isTieForLead = totalVotes > 0 && topVote.count === secondVote.count;
  const leadPercentage = topVote ? getPercentage(topVote.count) : 0;
  const leadMargin = topVote ? topVote.count - secondVote.count : 0;
  const userVoteLabel = {
    red: 'Not Okay',
    amber: 'It Depends',
    green: 'Totally Fine'
  }[userVote];

  return (
    <div className={`behavior-card ${presentationMode ? 'presentation-mode' : ''}`}>
      <div className="scenario-section">
        <div className="scenario-meta">
          {canToggleScenarioNav ? (
            <button
              type="button"
              className={`scenario-pill scenario-pill-button ${isScenarioPillAnimating ? 'changed' : ''}`}
              onClick={onToggleScenarioNav}
              aria-expanded={isScenarioNavExpanded}
              aria-label={`${isScenarioNavExpanded ? 'Hide' : 'Show'} scenario navigation`}
            >
              <span>Scenario {behavior.id}</span>
              <span className={`scenario-pill-chevron ${isScenarioNavExpanded ? 'open' : ''}`} aria-hidden="true">
                ▾
              </span>
            </button>
          ) : (
            <span className={`scenario-pill ${isScenarioPillAnimating ? 'changed' : ''}`}>
              Scenario {behavior.id}
            </span>
          )}
          {userVote && !presentationMode && (
            <span className={`user-vote user-vote-meta ${userVote}`}>
              Your vote: {userVoteLabel}
            </span>
          )}
        </div>
        <h2>Scenario Prompt</h2>
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

      <div className={`vote-stats ${isVoteStatsCollapsed ? 'collapsed' : ''} ${presentationMode ? 'presentation-mode' : ''}`}>
        <div className="vote-stats-header">
          <div className="vote-stats-heading">
            <h3>How People Voted</h3>
            <span className="vote-stats-total-chip">{totalVotes} total</span>
          </div>
          {!presentationMode && (
            <button
              type="button"
              className="vote-stats-toggle"
              onClick={() => setIsVoteStatsCollapsed(prev => !prev)}
              aria-expanded={!isVoteStatsCollapsed}
            >
              {isVoteStatsCollapsed ? 'Show' : 'Hide'}
            </button>
          )}
        </div>

        {!isVoteStatsCollapsed && (
          <>
            <div className="results-spotlight" aria-live="polite">
              <div className="results-spotlight-card primary">
                <span className="spotlight-label">Current Lead</span>
                {totalVotes === 0 ? (
                  <div className="spotlight-value">No votes yet</div>
                ) : isTieForLead ? (
                  <div className="spotlight-value">Tie in progress</div>
                ) : (
                  <div className={`spotlight-value ${topVote.key}`}>
                    <span>{topVote.emoji}</span>
                    <span>{topVote.label}</span>
                  </div>
                )}
                <span className="spotlight-subtext">
                  {totalVotes === 0
                    ? 'Waiting for the first response'
                    : isTieForLead
                      ? `${topVote.count} votes each at the top`
                      : `${leadPercentage}% of votes (${topVote.count})`}
                </span>
              </div>

              <div className="results-spotlight-card">
                <span className="spotlight-label">Lead Margin</span>
                <div className="spotlight-metric">{totalVotes === 0 ? '0' : leadMargin}</div>
                <span className="spotlight-subtext">Votes ahead of next option</span>
              </div>

              <div className="results-spotlight-card">
                <span className="spotlight-label">Participation</span>
                <div className="spotlight-metric">{totalVotes}</div>
                <span className="spotlight-subtext">Responses submitted</span>
              </div>
            </div>

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
          </>
        )}
      </div>
    </div>
  );
}

export default BehaviorCard;
