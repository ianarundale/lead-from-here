# AWS Deployment — Lead From Here

For full infrastructure documentation see [infrastructure/README.md](infrastructure/README.md).

## Quick Reference

### GitHub Secrets Required

| Secret | Where to get it |
|--------|-----------------|
| `AWS_ROLE_ARN` | `GitHubRoleArn` output of `lead-from-here-oidc` CFN stack |
| `AWS_CFN_EXECUTION_ROLE_ARN` | `CFNExecutionRoleArn` output of `lead-from-here-oidc` CFN stack |
| `AWS_S3_BUCKET` | The bucket name chosen during OIDC stack deployment |
| `AWS_EB_URL` | EB endpoint URL — add after first successful deployment |

### First-Time Setup (one-time)

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
    S3BucketName=<globally-unique-bucket-name> \
    EBApplicationName=lead-from-here \
    EBEnvironmentName=lead-from-here-prod
```

Then add the four secrets above and push to `main`.

### Ongoing Deployments

Every push to `main` automatically:
1. Lints and tests the React app
2. Builds the React app with the backend URL baked in
3. Deploys/updates CloudFormation infrastructure (via `CFNExecutionRole`)
4. Uploads the deployment package to S3 with a versioned key
5. Creates a new EB application version and updates the environment
6. Waits for the environment to report healthy

Or trigger manually: **GitHub → Actions → Deploy to AWS → Run workflow**

### Troubleshooting

```bash
# Check environment health
aws elasticbeanstalk describe-environments \
  --environment-names lead-from-here-prod \
  --region eu-west-1 \
  --query 'Environments[0].{Status:Status,Health:Health}'

# Stream logs
aws elasticbeanstalk request-environment-info \
  --environment-name lead-from-here-prod \
  --info-type tail --region eu-west-1

aws elasticbeanstalk retrieve-environment-info \
  --environment-name lead-from-here-prod \
  --info-type tail --region eu-west-1
```

### Key Files

| File | Purpose |
|------|---------|
| `infrastructure/github-oidc.yml` | OIDC provider, GitHub Actions role, CFN execution role |
| `infrastructure/cloudformation.yml` | S3 bucket, EB application, environment, IAM instance profile |
| `.github/workflows/deploy.yml` | CI/CD pipeline |
| `.ebextensions/nodejs.config` | EB proxy configuration |
| `.platform/nginx/nginx.conf` | nginx config with WebSocket proxy support |
