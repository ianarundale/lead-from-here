# AWS Deployment — Lead From Here (SST)

For full infrastructure details see `infrastructure/README.md`.

## Required GitHub Secrets

- `AWS_ROLE_ARN` (`GitHubRoleArn` output from `lead-from-here-oidc`)

## Branches That Deploy

Workflow `.github/workflows/deploy.yml` deploys on push to:
- `main`
- `serverless`

SST uses a stage derived from the branch name:
- `main` -> stage `main`
- `serverless` -> stage `serverless`
- branch names with `/` or special characters are normalized to lowercase `-`

## First-Time Bootstrap

Deploy the GitHub OIDC/IAM bootstrap stack once (existing stack can be updated in-place):

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

## What Deploys

`sst.config.ts` provisions:
- DynamoDB tables (`ConnectionsTable`, `VotingStateTable`)
- Lambda handlers (`lambda/index.handler`, `lambda/index.restHandler`)
- API Gateway WebSocket API
- API Gateway HTTP API (`GET /reset`, `GET /status`)
- Static frontend site (CloudFront + S3)

## Local Preflight

```bash
npx sst install
npx sst diff --stage <stage>
```

## Troubleshooting

```bash
# Inspect CloudFormation stacks created by SST (SST uses CloudFormation under the hood)
aws cloudformation describe-stacks --region eu-west-1 \
  --query "Stacks[?contains(StackName, 'lead-from-here')].[StackName,StackStatus]" \
  --output table

# Check recent events for a failed stack (replace stack name)
aws cloudformation describe-stack-events \
  --stack-name <stack-name> \
  --region eu-west-1 \
  --max-items 30
```
