# AWS Deployment — Lead From Here (Serverless)

For full details see `infrastructure/README.md`.

## Required GitHub Secrets

- `AWS_ROLE_ARN` (`GitHubRoleArn` output from `lead-from-here-oidc`)
- `AWS_CFN_EXECUTION_ROLE_ARN` (`CFNExecutionRoleArn` output from `lead-from-here-oidc`)

## Branches That Deploy

Workflow `.github/workflows/deploy.yml` deploys on push to:
- `main`
- `serverless`

OIDC trust policy currently allows both branch refs.

## First-Time Bootstrap

Deploy OIDC stack once:

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

Then set the two required secrets above.

## What a Deploy Does

1. Lints/tests client
2. Deploys `infrastructure/serverless.yml`
3. Uploads Lambda artifact to stack output bucket
4. Updates Lambda function code
5. Builds and uploads frontend to stack output bucket
6. Invalidates CloudFront

## Troubleshooting

```bash
aws cloudformation describe-stacks \
  --stack-name lead-from-here-serverless \
  --region eu-west-1 \
  --query 'Stacks[0].{Status:StackStatus,Outputs:Outputs}'

aws cloudformation describe-stack-events \
  --stack-name lead-from-here-serverless \
  --region eu-west-1 \
  --max-items 30
```
