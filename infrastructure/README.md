# Infrastructure

Serverless infrastructure managed by [SST](https://sst.dev). The source of truth is `sst.config.ts` in the repo root.

## Architecture

Per stage, SST provisions:

- **DynamoDB** `ConnectionsTable` — active WebSocket connections (TTL on `expiresAt`)
- **DynamoDB** `VotingStateTable` — persisted voting state
- **API Gateway WebSocket** — routes `$connect`, `$disconnect`, `$default` → `lambda/index.handler`
- **API Gateway HTTP** — routes `GET /reset`, `GET /status` → `lambda/index.restHandler`
- **CloudFront + S3** — React client static site

## One-time bootstrap

Deploy the OIDC role stack once to allow GitHub Actions to assume an AWS role:

```bash
aws cloudformation deploy \
  --template-file infrastructure/github-oidc.yml \
  --stack-name lead-from-here-oidc \
  --capabilities CAPABILITY_NAMED_IAM \
  --region eu-west-1 \
  --parameter-overrides \
    GitHubOwner=<your-github-owner> \
    GitHubRepo=lead-from-here \
    RoleName=github-actions-lead-from-here
```

## GitHub Actions deployment

Workflow: `.github/workflows/deploy.yml`

On push to `main` or `serverless`, it:
1. Installs root + client dependencies
2. Lints the React app
3. Assumes AWS role via OIDC
4. Runs `npx sst install`
5. Runs `npx sst deploy --stage <sanitised-branch-name>`

Stage names are derived from branch names (lowercase alphanumerics and dashes).

## Useful commands

```bash
# Start local dev (Lambda runs locally, invoked via real API Gateway)
npx sst dev --stage <name> --mode basic

# Preview infrastructure changes
npx sst diff --stage <name>

# Deploy manually
npx sst deploy --stage <name>

# Tear down a stage
npx sst remove --stage <name>
```
