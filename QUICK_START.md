# Quick Start

## Prerequisites

- Node.js 18+ and npm
- AWS CLI configured (`aws sts get-caller-identity` should return your account)
- SST CLI (installed via `npm install` in the root)

## 1. Install dependencies

```bash
npm install
cd client && npm install && cd ..
cd lambda && npm install && cd ..
```

## 2. Start dev mode

```bash
npx sst dev --stage <your-name> --mode basic
```

SST will deploy a personal stack and start intercepting Lambda invocations locally. When ready it prints your live endpoints:

```
RestApi:      https://xxxx.execute-api.eu-west-1.amazonaws.com
WebSocketApi: wss://yyyy.execute-api.eu-west-1.amazonaws.com/$default
```

## 3. Connect the React client

Create `client/.env.local`:

```
REACT_APP_WS_URL=wss://yyyy.execute-api.eu-west-1.amazonaws.com/\$default
REACT_APP_BACKEND_URL=https://xxxx.execute-api.eu-west-1.amazonaws.com
```

> **Note:** The `\$` before `default` is required. `dotenv` treats `$` as a variable interpolation prefix, so `$default` would silently expand to an empty string, giving the wrong URL. The backslash escapes it to a literal `$`.

Then start the client:

```bash
cd client && npm start
```

Open http://localhost:3000 in multiple tabs to test real-time voting.

## Workshop usage

1. Deploy to a shared stage: `npx sst deploy --stage workshop`
2. Share the CloudFront URL (printed as `frontendUrl`) with participants
3. Use `GET /reset` to clear votes between scenarios

## Stopping / cleaning up

Press `Ctrl+C` to stop dev mode. The AWS resources remain until you remove them:

```bash
npx sst remove --stage <your-name>
```
