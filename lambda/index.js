import AWS from 'aws-sdk';
import ApiGatewayManagementApi from 'aws-sdk/clients/apigatewaymanagementapi.js';
import SCENARIOS from './scenarios.json';

const dynamoDB = new AWS.DynamoDB.DocumentClient();

const TABLE_CONNECTIONS = process.env.CONNECTIONS_TABLE;
const TABLE_VOTING = process.env.VOTING_TABLE;
const API_ENDPOINT = process.env.API_ENDPOINT;

// Initialize default voting state
const getDefaultState = () => ({
  currentBehaviorId: 1,
  syncMode: true,
  legend: SCENARIOS.legend,
  behaviors: SCENARIOS.scenarios.map((scenario, index) => ({
    id: index + 1,
    scenario: scenario.scenario,
    prompts: scenario.prompts,
    votes: { red: 0, amber: 0, green: 0 },
    userVotes: {}
  }))
});

// Helper: Get voting state from DynamoDB
async function getVotingState() {
  const result = await dynamoDB.get({
    TableName: TABLE_VOTING,
    Key: { pk: 'VOTING_STATE' }
  }).promise();

  if (!result.Item) {
    // Initialize with default state
    const defaultState = getDefaultState();
    await dynamoDB.put({
      TableName: TABLE_VOTING,
      Item: { pk: 'VOTING_STATE', ...defaultState }
    }).promise();
    return defaultState;
  }

  const { pk, ...state } = result.Item;
  return state;
}

// Helper: Save voting state to DynamoDB
async function saveVotingState(state) {
  await dynamoDB.put({
    TableName: TABLE_VOTING,
    Item: { pk: 'VOTING_STATE', ...state }
  }).promise();
}

// Helper: Get API Gateway management API
function getApiGateway() {
  return new ApiGatewayManagementApi({
    endpoint: API_ENDPOINT
  });
}

// Helper: Get unique connected user count (falls back to connectionId when userId is missing)
async function getConnectedUsersCount() {
  const result = await dynamoDB.scan({
    TableName: TABLE_CONNECTIONS,
    ProjectionExpression: 'connectionId, userId'
  }).promise();

  const uniqueUsers = new Set(
    (result.Items || []).map(conn => conn.userId || conn.connectionId)
  );

  return uniqueUsers.size;
}

// Helper: Attach live connection metadata to state payloads without persisting it
async function withLiveMetadata(state) {
  return {
    ...state,
    connectedUsers: await getConnectedUsersCount()
  };
}

// Helper: Broadcast message to all connected clients
async function broadcast(message, excludeConnectionId = null) {
  const connections = await dynamoDB.scan({
    TableName: TABLE_CONNECTIONS
  }).promise();

  const apigw = getApiGateway();

  const promises = connections.Items
    .filter(conn => conn.connectionId !== excludeConnectionId)
    .map(conn =>
      apigw.postToConnection({
        ConnectionId: conn.connectionId,
        Data: JSON.stringify(message)
      }).promise()
      .catch(err => {
        if (err.statusCode === 410) {
          // Remove stale connection
          return dynamoDB.delete({
            TableName: TABLE_CONNECTIONS,
            Key: { connectionId: conn.connectionId }
          }).promise();
        }
        console.error('Broadcast error:', err.message);
      })
    );

  await Promise.all(promises);
}

// Lambda Handler
export const handler = async (event) => {
  const routeKey = event?.requestContext?.routeKey || event?.routeKey;
  const connectionId = event?.requestContext?.connectionId || event?.connectionId;
  const body = event?.body;

  console.log('Event:', JSON.stringify(event));

  try {
    switch (routeKey) {
      case '$connect':
        return await handleConnect(connectionId, event);

      case '$disconnect':
        return await handleDisconnect(connectionId);

      case '$default':
        return await handleMessage(connectionId, body);

      default:
        return { statusCode: 404, body: 'Unknown route' };
    }
  } catch (error) {
    console.error('Handler error:', error);
    return { statusCode: 500, body: 'Internal error' };
  }
};

// Handle new WebSocket connection
async function handleConnect(connectionId, event) {
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId || `user_${connectionId.substring(0, 8)}`;

  await dynamoDB.put({
    TableName: TABLE_CONNECTIONS,
    Item: {
      connectionId,
      userId,
      connectedAt: Date.now(),
      protocol: 'websocket'
    }
  }).promise();

  // Note: postToConnection cannot be called during $connect — API Gateway
  // returns 410 until the handler returns 200. Initial state is sent in
  // response to the CLIENT_CONNECT message the client sends on open.
  return { statusCode: 200, body: 'Connected' };
}

// Handle WebSocket disconnection
async function handleDisconnect(connectionId) {
  await dynamoDB.delete({
    TableName: TABLE_CONNECTIONS,
    Key: { connectionId }
  }).promise();

  const votingState = await getVotingState();
  await broadcast({ type: 'STATE_UPDATE', data: await withLiveMetadata(votingState) });

  return { statusCode: 200, body: 'Disconnected' };
}

// Handle incoming WebSocket messages
async function handleMessage(connectionId, body) {
  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const votingState = await getVotingState();

  switch (data.type) {
    case 'VOTE': {
      const { behaviorId, vote, userId } = data;
      const behavior = votingState.behaviors.find(b => b.id === behaviorId);

      if (behavior) {
        // Remove previous vote
        if (behavior.userVotes && behavior.userVotes[userId]) {
          const previousVote = behavior.userVotes[userId];
          behavior.votes[previousVote]--;
        }

        // Initialize userVotes if needed
        if (!behavior.userVotes) {
          behavior.userVotes = {};
        }

        // Add new vote
        behavior.userVotes[userId] = vote;
        behavior.votes[vote]++;

        await saveVotingState(votingState);

        await broadcast({ type: 'STATE_UPDATE', data: await withLiveMetadata(votingState) });
      }
      break;
    }

    case 'SET_BEHAVIOR': {
      votingState.currentBehaviorId = data.behaviorId;

      // Only broadcast behavior change in sync mode
      if (votingState.syncMode) {
        await saveVotingState(votingState);
        await broadcast({ type: 'BEHAVIOR_CHANGED', data: await withLiveMetadata(votingState) }, connectionId);
      }
      break;
    }

    case 'TOGGLE_SYNC': {
      votingState.syncMode = !votingState.syncMode;

      await saveVotingState(votingState);
      await broadcast({ type: 'STATE_UPDATE', data: await withLiveMetadata(votingState) });
      break;
    }

    case 'RESET_VOTES': {
      votingState.behaviors.forEach(behavior => {
        behavior.votes = { red: 0, amber: 0, green: 0 };
        behavior.userVotes = {};
      });
      votingState.currentBehaviorId = 1;

      await saveVotingState(votingState);
      await broadcast({ type: 'STATE_UPDATE', data: await withLiveMetadata(votingState) });
      break;
    }

    case 'CLIENT_CONNECT': {
      // Update user ID for existing connection
      const { userId } = data;
      await dynamoDB.update({
        TableName: TABLE_CONNECTIONS,
        Key: { connectionId },
        UpdateExpression: 'set userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      }).promise();

      // Send initial state — this must be done here rather than in $connect
      // because postToConnection is only valid after $connect returns 200.
      const apigw = getApiGateway();
      const stateWithLiveMetadata = await withLiveMetadata(votingState);
      await apigw.postToConnection({
        ConnectionId: connectionId,
        Data: JSON.stringify({ type: 'INITIAL_STATE', data: stateWithLiveMetadata })
      }).promise();

      // Refresh all clients so connected user count updates immediately.
      await broadcast({ type: 'STATE_UPDATE', data: stateWithLiveMetadata });
      break;
    }
  }

  return { statusCode: 200, body: 'Message processed' };
};

// REST API Handler for /reset and /status
export const restHandler = async (event) => {
  const httpMethod = event?.requestContext?.http?.method || event?.httpMethod;
  const path = event?.rawPath || event?.path;

  console.log('REST Event:', JSON.stringify(event));

  try {
    if (path === '/reset' && httpMethod === 'GET') {
      const votingState = getDefaultState();
      await saveVotingState(votingState);

      // Broadcast to all connected clients
      await broadcast({ type: 'STATE_UPDATE', data: await withLiveMetadata(votingState) });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, message: 'All votes have been reset' })
      };
    }

    if (path === '/status' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: process.env.DEPLOY_VERSION || 'dev' })
      };
    }

    return { statusCode: 404, body: 'Not found' };
  } catch (error) {
    console.error('REST handler error:', error);
    return { statusCode: 500, body: 'Internal error' };
  }
};
