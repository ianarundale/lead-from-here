# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Lead From Here** is a real-time group voting application for leadership behavior assessment. Participants connect simultaneously and vote on workplace scenarios using three options (Red/Amber/Green). Built entirely serverless on AWS.

## Architecture

```
Client (React + CloudFront/S3)
    ├── WebSocket ──► API Gateway WebSocket ──► Lambda (handler)
    └── HTTPS ──────► API Gateway HTTP ──────► Lambda (restHandler)
                                                      │
                                              DynamoDB
                                              ├── ConnectionsTable (active WebSocket sessions)
                                              └── VotingStateTable (persistent voting state)
```

Infrastructure is defined in `sst.config.ts` using SST v3. There are three `package.json` files: root (SST/infra), `client/` (React), and `lambda/` (backend).

## Key Files

- `sst.config.ts` — all infrastructure: DynamoDB tables, Lambda functions, API Gateway, CloudFront
- `lambda/index.js` — WebSocket handler (`handler`) and REST handler (`restHandler`)
- `client/src/App.js` — React frontend; WebSocket connection, state management, vote tracking
- `client/src/components/BehaviorCard.js` — scenario display with vote statistics
- `scenarios.json` — source of truth for scenarios (used by lambda at runtime)

## Development Commands

### Setup (three package.json files to install)
```bash
npm install
cd client && npm install && cd ..
cd lambda && npm install && cd ..
```

### Local Development
```bash
# Terminal 1: Start SST dev (Lambda runs locally, real API Gateway)
npx sst dev --stage <your-name> --mode basic

# Terminal 2: Start React dev server (after copying env vars from SST output)
cd client && npm start
```

After `sst dev` starts, copy the WebSocket and REST URLs into `client/.env.local`:
```
REACT_APP_WS_URL=wss://[api-gateway-url]/\$default
REACT_APP_BACKEND_URL=https://[api-gateway-url]
```
**Critical**: Use `\$default` (backslash-escaped) because dotenv treats `$` as a variable interpolation prefix.

### Lint & Test
```bash
cd client && npm run lint    # ESLint, max-warnings: 0
cd client && npm test        # React tests
```

### Deployment
```bash
npx sst deploy --stage <name>    # Deploy
npx sst diff --stage <name>      # Preview changes
npx sst remove --stage <name>    # Tear down
npx sst install                  # Re-run after sst.config.ts changes
```

CI/CD deploys automatically to stage `prod` on push to `main` or `serverless` branches via GitHub Actions with OIDC (no stored credentials).

## WebSocket Message Protocol

All messages are JSON. Client → server types:
- `CLIENT_CONNECT` — initialize client with full voting state
- `VOTE` — cast vote `{ behaviorId, vote: 'red'|'amber'|'green' }`
- `SET_BEHAVIOR` — change displayed scenario (sync mode only)
- `TOGGLE_SYNC` — toggle synchronized vs. independent navigation
- `RESET_VOTES` — clear all votes (facilitator action)

## Important Implementation Details

- **Vote deduplication**: Lambda removes previous vote before adding new one; tracks per-user votes in `behavior.userVotes[userId]`
- **Stale connection cleanup**: Lambda handles 410 status codes from API Gateway and removes dead connections
- **User identity**: `userId` is stored in `localStorage` and sent with `CLIENT_CONNECT` to restore vote state from DynamoDB after page refresh
- **Sync mode**: When enabled, all users see the same scenario; when disabled, each user navigates independently
- **Optimistic updates**: Frontend applies local state changes immediately before server confirmation

## Scenarios

Edit `scenarios.json` in the root to update workshop content. The lambda reads this file at runtime. Each scenario has a `scenario` description and `prompts` array for discussion questions.
