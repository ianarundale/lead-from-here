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
5. Runs `npx sst deploy --stage prod`

## SST CLI reference

All commands require AWS credentials in the environment (e.g. via `aws sso login` or
exported `AWS_*` env vars). The `--stage` flag is required and isolates all provisioned
resources (DynamoDB tables, Lambda, API Gateway, S3/CloudFront) under a named namespace.

```bash
# Install SST providers (run once after cloning or after sst.config.ts changes)
npx sst install

# Start local dev server — Lambda runs locally, invoked via live API Gateway
npx sst dev --stage <name> --mode basic

# Preview infrastructure changes without deploying
npx sst diff --stage <name>

# Deploy all resources to AWS
npx sst deploy --stage <name>

# Tear down all resources for a stage
npx sst remove --stage <name>
```

### Stages

Each `--stage` is a fully independent deployment. Resources are prefixed with the stage
name in AWS (e.g. `lead-from-here-prod-ConnectionsTable`). The production stage used by
GitHub Actions is `prod`.

Use a personal stage name (e.g. `--stage alice`) for local testing so you don't affect
the shared `prod` environment.
