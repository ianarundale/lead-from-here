# Infrastructure

This project now deploys serverless infrastructure with SST.

## Source of Truth

- SST app config: `sst.config.ts`
- OIDC bootstrap stack: `infrastructure/github-oidc.yml`

## Architecture

SST provisions, per stage:
- `Dynamo` connections table (TTL on `expiresAt`)
- `Dynamo` voting state table
- WebSocket API Gateway routes: `$connect`, `$disconnect`, `$default`
- HTTP API Gateway routes: `GET /reset`, `GET /status`
- Lambda WebSocket handler: `lambda/index.handler`
- Lambda REST handler: `lambda/index.restHandler`
- Static site deployment for `client/` with CloudFront URL output

## Bootstrap (one-time)

Deploy OIDC role stack once:

```bash
aws cloudformation deploy \
  --template-file infrastructure/github-oidc.yml \
  --stack-name lead-from-here-oidc \
  --capabilities CAPABILITY_NAMED_IAM \
  --region eu-west-1 \
  --parameter-overrides \
    GitHubOwner=<your-github-owner> \
    GitHubRepo=lead-from-here \
    RoleName=github-actions-lead-from-here \
    StackName=lead-from-here-prod \
    AWSRegion=eu-west-1 \
    S3BucketName=<placeholder-or-existing-bucket-name> \
    EBApplicationName=lead-from-here \
    EBEnvironmentName=lead-from-here-prod
```

## GitHub Actions Deployment

Workflow: `.github/workflows/deploy.yml`

On push to `main` or `serverless`, it:
1. Installs root + client dependencies
2. Lints/tests React app
3. Assumes AWS role via OIDC
4. Runs `npx sst install`
5. Runs `npx sst deploy --stage <sanitized-branch-name>`

## Local Commands

```bash
# Install providers and diff changes
npx sst install
npx sst diff --stage serverless

# Deploy manually to a stage
npx sst deploy --stage serverless

# Remove a stage
npx sst remove --stage serverless
```

## Notes

- Stage names are derived from branch names and sanitized to lowercase alphanumerics and dashes.
- Existing `infrastructure/serverless.yml` is legacy and no longer used by the GitHub deploy workflow.
