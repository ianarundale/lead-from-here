# Infrastructure

This folder contains the Infrastructure as Code (IaC) for the Lead From Here application.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                          GitHub                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   GitHub Actions                        │  │
│  │  1. Lint + test + build React app                      │  │
│  │  2. Authenticate via OIDC (no stored keys)             │  │
│  │  3. Deploy CloudFormation (infra, via CFN exec role)   │  │
│  │  4. Upload deploy package to S3                        │  │
│  │  5. Create EB application version + update environment │  │
│  │  6. Wait for environment health                        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                            AWS                               │
├──────────────────────────────────────────────────────────────┤
│  github-oidc.yml  (deploy once manually before first run)   │
│  • OIDC Provider  (token.actions.githubusercontent.com)      │
│  • GitHubDeployRole  — assumed by GitHub Actions via OIDC   │
│      Policies: EB deployment, S3 read/write, CFN deploy     │
│  • CFNExecutionRole  — assumed by CloudFormation only       │
│      Policies: IAM, S3 bucket create, EB create/manage      │
├──────────────────────────────────────────────────────────────┤
│  cloudformation.yml  (deployed automatically by pipeline)   │
│  • S3 Bucket          — versioned, encrypted, private       │
│  • EBServiceRole      — EB health reporting + lifecycle     │
│  • EBInstanceProfile  — IAM profile for EC2 instances       │
│  • EB Application     — with version lifecycle (max 20)     │
│  • EB Environment     — AL2023, Node.js 20, t3.micro,       │
│                          single-instance, nginx proxy        │
└──────────────────────────────────────────────────────────────┘
```

## Why Two CloudFormation Stacks?

**`github-oidc.yml`** must be deployed manually once, before the pipeline exists.
It creates the OIDC provider and IAM roles that GitHub Actions needs to authenticate.
This is the classic bootstrap problem — you need credentials to create credentials.

**`cloudformation.yml`** is deployed automatically by the pipeline on every push
to `main`. It manages all application infrastructure. CloudFormation assumes
`CFNExecutionRole` when deploying this stack so the GitHub Actions role never
needs direct IAM creation permissions.

---

## One-Time Setup

### Step 1 — Deploy the OIDC & IAM stack

You need AWS credentials with IAM and CloudFormation permissions for this
one-time step (e.g. an admin role or your personal AWS CLI profile).

```bash
export AWS_REGION=eu-west-1
export GITHUB_OWNER=<your-github-username-or-org>
export GITHUB_REPO=lead-from-here
export S3_BUCKET=<globally-unique-bucket-name>

aws cloudformation deploy \
  --template-file infrastructure/github-oidc.yml \
  --stack-name lead-from-here-oidc \
  --capabilities CAPABILITY_NAMED_IAM \
  --region $AWS_REGION \
  --parameter-overrides \
    GitHubOwner=$GITHUB_OWNER \
    GitHubRepo=$GITHUB_REPO \
    RoleName=github-actions-lead-from-here \
    StackName=lead-from-here-prod \
    AWSRegion=$AWS_REGION \
    S3BucketName=$S3_BUCKET \
    EBApplicationName=lead-from-here \
    EBEnvironmentName=lead-from-here-prod
```

### Step 2 — Retrieve the output ARNs

```bash
aws cloudformation describe-stacks \
  --stack-name lead-from-here-oidc \
  --region $AWS_REGION \
  --query 'Stacks[0].Outputs'
```

Note the values for `GitHubRoleArn` and `CFNExecutionRoleArn`.

### Step 3 — Add GitHub Secrets

In your repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | `GitHubRoleArn` output from Step 2 |
| `AWS_CFN_EXECUTION_ROLE_ARN` | `CFNExecutionRoleArn` output from Step 2 |
| `AWS_S3_BUCKET` | The bucket name you chose in Step 1 |
| `AWS_EB_URL` | Leave blank for now — add after the first deployment |

> **Why `AWS_CFN_EXECUTION_ROLE_ARN`?**
> The pipeline passes this role to `aws cloudformation deploy --role-arn`.
> CloudFormation assumes it to create IAM roles and other infrastructure
> resources. This keeps those broad creation permissions off the GitHub
> Actions role entirely.

### Step 4 — Push to main

The pipeline triggers automatically. After the first successful run, copy
the EB endpoint URL from the CloudFormation outputs and add it as `AWS_EB_URL`.

---

## CloudFormation Resources

### `github-oidc.yml`

| Resource | Type | Purpose |
|----------|------|---------|
| `GitHubOIDCProvider` | `AWS::IAM::OIDCProvider` | Federates GitHub Actions tokens with AWS STS |
| `GitHubDeployRole` | `AWS::IAM::Role` | Assumed by pipeline; restricted to `refs/heads/main` only |
| `CFNExecutionRole` | `AWS::IAM::Role` | Assumed by CloudFormation; carries IAM/S3/EB creation permissions |
| `EBPolicy` | `AWS::IAM::Policy` | EB deployment actions scoped to this project's ARNs |
| `S3Policy` | `AWS::IAM::Policy` | S3 read/write scoped to the deployment bucket |
| `CloudFormationPolicy` | `AWS::IAM::Policy` | CFN deploy + `iam:PassRole` for CFN execution role |

### `cloudformation.yml`

| Resource | Type | Purpose |
|----------|------|---------|
| `DeploymentBucket` | `AWS::S3::Bucket` | Stores versioned deployment packages |
| `EBServiceRole` | `AWS::IAM::Role` | EB service role for health reporting and version lifecycle |
| `EBInstanceProfileRole` | `AWS::IAM::Role` | IAM role assigned to EC2 instances |
| `EBInstanceProfile` | `AWS::IAM::InstanceProfile` | Instance profile wrapping `EBInstanceProfileRole` |
| `EBApplication` | `AWS::ElasticBeanstalk::Application` | EB application with version lifecycle (max 20 versions) |
| `EBEnvironment` | `AWS::ElasticBeanstalk::Environment` | Single-instance environment, AL2023, Node.js 20, t3.micro |

---

## Updating Infrastructure

Changes to `cloudformation.yml` are picked up automatically on the next push to
`main` — the pipeline deploys CloudFormation before deploying the application.

### Validating locally before pushing

Use [cfn-lint](https://github.com/aws-cloudformation/cfn-lint) to catch invalid
option names, namespaces, and other template errors without waiting for a full
pipeline run.

```bash
# Install once
pip3 install cfn-lint

# Run against the template
cfn-lint infrastructure/cloudformation.yml
```

No output means no errors. This is much faster than pushing and waiting for the
EB environment to fail mid-deploy.

To update `github-oidc.yml` (e.g. to change IAM permissions):

```bash
aws cloudformation deploy \
  --template-file infrastructure/github-oidc.yml \
  --stack-name lead-from-here-oidc \
  --capabilities CAPABILITY_NAMED_IAM \
  --region eu-west-1 \
  --parameter-overrides \
    GitHubOwner=<owner> \
    GitHubRepo=lead-from-here \
    RoleName=github-actions-lead-from-here \
    StackName=lead-from-here-prod \
    AWSRegion=eu-west-1 \
    S3BucketName=<bucket> \
    EBApplicationName=lead-from-here \
    EBEnvironmentName=lead-from-here-prod
```

---

## Teardown

```bash
# Delete application infrastructure (EB environment, S3 bucket must be empty first)
aws cloudformation delete-stack \
  --stack-name lead-from-here-prod \
  --region eu-west-1

# Delete OIDC/IAM stack (OIDC provider is retained by DeletionPolicy)
aws cloudformation delete-stack \
  --stack-name lead-from-here-oidc \
  --region eu-west-1
```

---

## Viewing Logs

```bash
# Stream recent EB logs
aws elasticbeanstalk request-environment-info \
  --environment-name lead-from-here-prod \
  --info-type tail \
  --region eu-west-1

aws elasticbeanstalk retrieve-environment-info \
  --environment-name lead-from-here-prod \
  --info-type tail \
  --region eu-west-1
```
