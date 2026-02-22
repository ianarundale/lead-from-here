# Lead From Here

Interactive real-time voting application for leadership behaviour assessment. Multiple participants connect simultaneously and vote on whether displayed scenarios are appropriate, need context, or cross a line.

## Features

- Real-time voting across multiple browsers via WebSocket
- Three-option voting: 🔴 Not okay · 🟠 It depends · 🟢 Totally fine
- Facilitator controls: reset votes, toggle sync mode
- Voting state persisted in DynamoDB — survives Lambda cold starts
- Serverless: no servers to manage, scales to zero

## Architecture

```
Client (React + CloudFront)
    │
    ├── WebSocket ──► API Gateway WebSocket ──► Lambda (lambda/index.handler)
    │                                                │
    └── HTTPS ──────► API Gateway HTTP ─────► Lambda (lambda/index.restHandler)
                                                     │
                                               DynamoDB
                                               ├── ConnectionsTable
                                               └── VotingStateTable
```

**Infrastructure:** managed by [SST](https://sst.dev) (`sst.config.ts`)

## Project Structure

```
lead-from-here/
├── lambda/
│   ├── index.js          # Lambda handlers (WebSocket + REST)
│   ├── scenarios.json    # Behaviour scenarios data
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.js
│   │   └── components/
│   └── package.json
├── infrastructure/
│   ├── github-oidc.yml   # OIDC bootstrap (one-time setup)
│   └── README.md
├── sst.config.ts         # Infrastructure definition
└── scenarios.json        # Source of truth for scenarios
```

## Local Development

Uses [SST dev mode](https://sst.dev/docs/live-lambda-development) — Lambda code runs locally but is invoked via the real AWS API Gateway.

```bash
npm install
npx sst dev --stage <your-name> --mode basic
```

To also run the React dev server:

```bash
cd client && npm install && npm start
```

Set `REACT_APP_WS_URL` in `client/.env.local` to the WebSocket URL printed by `sst dev`. Use `\$default` (backslash-escaped) — `dotenv` treats `$` as a variable interpolation prefix and will silently strip `$default` otherwise.

## Scenarios

Edit `scenarios.json` to change the behaviour scenarios shown in the app. The Lambda reads from its own copy at `lambda/scenarios.json` — keep both in sync, or consider making `lambda/scenarios.json` a symlink.

## API Endpoints

These are available on the REST API URL printed by `sst dev` / `sst deploy`.

| Endpoint | Description |
|---|---|
| `GET /status` | Returns `{ version }` |
| `GET /reset` | Resets all votes and broadcasts to connected clients |

WebSocket messages (send to the WebSocket URL):

| Type | Payload | Description |
|---|---|---|
| `CLIENT_CONNECT` | `{ userId }` | Identify the client, receive `INITIAL_STATE` |
| `VOTE` | `{ behaviorId, vote, userId }` | Cast a vote (`red`/`amber`/`green`) |
| `SET_BEHAVIOR` | `{ behaviorId }` | Navigate to a scenario (broadcast in sync mode) |
| `TOGGLE_SYNC` | — | Toggle sync/independent navigation mode |
| `RESET_VOTES` | `{ behaviorId }` | Reset votes for one scenario |

## Deployment

Deployed via GitHub Actions on push to `main` or `serverless` using SST + GitHub OIDC. The deployed stage name is derived from the branch name. See [infrastructure/README.md](./infrastructure/README.md) for setup.

```bash
# Manual deploy
npx sst deploy --stage local

# Tear down a stage
npx sst remove --stage <stage>
```
