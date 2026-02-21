# Infrastructure

This folder contains Infrastructure as Code for the serverless deployment of Lead From Here.

## Architecture

GitHub Actions deploys a branch-scoped CloudFormation stack that provisions:
- API Gateway WebSocket API
- API Gateway HTTP API (`/reset`, `/status`)
- 2 Lambda functions (WebSocket + REST handlers)
- 2 DynamoDB tables (connections + voting state)
- S3 bucket for frontend static assets
- CloudFront distribution in front of S3
- S3 bucket for Lambda deployment zip objects

## Stacks

- `infrastructure/github-oidc.yml` (bootstrap stack, deployed manually)
- `infrastructure/serverless.yml` (application stack, deployed by GitHub Actions)

### Why two stacks?

`github-oidc.yml` must exist before GitHub Actions can authenticate with AWS via OIDC. Once that exists, Actions can deploy `serverless.yml` on each push.

## One-Time Setup

### 1. Deploy OIDC stack

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

Note: `S3BucketName` / `EB*` parameters remain in this template for backward compatibility with the existing stack shape.

### 2. Capture role ARNs

```bash
aws cloudformation describe-stacks \
  --stack-name lead-from-here-oidc \
  --region eu-west-1 \
  --query 'Stacks[0].Outputs'
```

### 3. Configure GitHub secrets

Required repository secrets:
- `AWS_ROLE_ARN`
- `AWS_CFN_EXECUTION_ROLE_ARN`

## Deployment Behavior

Workflow: `.github/workflows/deploy.yml`

Triggers:
- Push to `main`
- Push to `serverless`
- Manual dispatch

Deployment sequence:
1. Lint/test React app
2. Assume AWS role via OIDC
3. Deploy/update CloudFormation stack from `infrastructure/serverless.yml`
4. Package/upload Lambda zip to stack-managed code bucket
5. Update Lambda function code
6. Build React app with `REACT_APP_WS_URL` from stack output
7. Upload frontend build to stack-managed frontend bucket
8. Invalidate CloudFront cache

## Stack Naming

Workflow sanitizes branch names and creates:
- Stack name: `lead-from-here-<branch>`
- Lambda names and most resources prefixed with `<branch>`

Example for `serverless` branch:
- Stack: `lead-from-here-serverless`

## Validate Before Push

```bash
aws cloudformation validate-template \
  --template-body file://infrastructure/serverless.yml \
  --region eu-west-1
```

## Useful Commands

### Inspect application stack outputs

```bash
aws cloudformation describe-stacks \
  --stack-name lead-from-here-serverless \
  --region eu-west-1 \
  --query 'Stacks[0].Outputs'
```

### Check recent stack events

```bash
aws cloudformation describe-stack-events \
  --stack-name lead-from-here-serverless \
  --region eu-west-1 \
  --max-items 20
```

### Check Lambda logs (example)

```bash
aws logs tail /aws/lambda/serverless-lead-from-here-websocket \
  --region eu-west-1 \
  --follow
```

## Teardown

Delete an application stack:

```bash
aws cloudformation delete-stack \
  --stack-name lead-from-here-serverless \
  --region eu-west-1
```

Delete bootstrap stack (only when no longer needed):

```bash
aws cloudformation delete-stack \
  --stack-name lead-from-here-oidc \
  --region eu-west-1
```
