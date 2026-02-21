# Infrastructure

This folder contains Infrastructure as Code (IaC) for the Lead From Here application.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        GitHub                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              GitHub Actions                          │   │
│  │  1. Checkout code                                    │   │
│  │  2. Build React app                                  │   │
│  │  3. Auth via OIDC                                    │   │
│  │  4. Deploy CloudFormation (S3 + EB)                 │   │
│  │  5. Deploy to Elastic Beanstalk                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         AWS                                 │
├─────────────────────────────────────────────────────────────┤
│  MANUALLY CREATED (one-time):                              │
│  • OIDC Provider (token.actions.githubusercontent.com)      │
│  • IAM Role (GitHubDeployRole)                             │
│  • IAM Policies (EB + S3 + CFN permissions)               │
├─────────────────────────────────────────────────────────────┤
│  CLOUDFORMATION (managed):                                 │
│  • S3 Bucket (lead-from-here-deploy)                       │
│  • Elastic Beanstalk Application                           │
│  • Elastic Beanstalk Environment (t2.micro, Node.js 20)    │
└─────────────────────────────────────────────────────────────┘
```

## Why Split Security Resources?

The OIDC provider and IAM role must be created **manually first** because:
1. GitHub Actions needs these to authenticate
2. CloudFormation can't create them while deploying from GitHub Actions
3. This is a "chicken-and-egg" problem - the role is needed to run the workflow

## One-Time Manual Setup

### 1. Create OIDC Provider & Role

```bash
# Get your AWS account ID
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)

# Create OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list "sts.amazonaws.com" \
  --thumbprint-list "6938FD4D98BABEC356DA5494E410BCB82C2AD4A6" \
  --region eu-west-1

# Create IAM role with trust policy
cat > /tmp/trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:ianarundale/lead-from-here:*"
        }
      }
    }
  ]
}
EOF

aws iam create-role \
  --role-name GitHubDeployRole \
  --assume-role-policy-document file:///tmp/trust-policy.json \
  --region eu-west-1
```

### 2. Attach Permissions

```bash
# Elastic Beanstalk policy
aws iam attach-role-policy \
  --role-name GitHubDeployRole \
  --policy-arn arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier \
  --region eu-west-1

# S3 policy (limited to deployment bucket)
aws iam create-policy \
  --policy-name GitHubDeployS3Access \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["s3:ListBucket", "s3:GetObject", "s3:PutObject"],
        "Resource": ["arn:aws:s3:::lead-from-here-deploy", "arn:aws:s3:::lead-from-here-deploy/*"]
      }
    ]
  }' \
  --region eu-west-1

aws iam attach-role-policy \
  --role-name GitHubDeployRole \
  --policy-arn arn:aws:iam::${AWS_ACCOUNT_ID}:policy/GitHubDeployS3Access \
  --region eu-west-1

# CloudFormation policy (limited to this stack)
aws iam put-role-policy \
  --role-name GitHubDeployRole \
  --policy-name GitHubDeployCFNPolicy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "cloudformation:CreateStack",
          "cloudformation:UpdateStack",
          "cloudformation:DescribeStacks",
          "cloudformation:DescribeStackResources",
          "cloudformation:GetTemplate",
          "cloudformation:ValidateTemplate"
        ],
        "Resource": "arn:aws:cloudformation:eu-west-1:'${AWS_ACCOUNT_ID}':stack/lead-from-here-prod/*"
      }
    ]
  }' \
  --region eu-west-1
```

### 3. Add GitHub Secrets

In your GitHub repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | `arn:aws:iam::123456789012:role/GitHubDeployRole` |
| `AWS_S3_BUCKET` | `lead-from-here-deploy` |
| `AWS_EB_URL` | Your EB URL after deployment |

## CloudFormation Template

`cloudformation.yml` manages:

| Resource | Description |
|----------|-------------|
| `DeploymentBucket` | S3 bucket for deployment packages |
| `EBApplication` | Elastic Beanstalk application |
| `EBEnvironment` | Environment (t2.micro, Node.js 20) |

### Deploy Infrastructure

```bash
cd infrastructure

aws cloudformation deploy \
  --template-file cloudformation.yml \
  --stack-name lead-from-here-prod \
  --capabilities CAPABILITY_IAM \
  --region eu-west-1
```

### Update Infrastructure

After modifying `cloudformation.yml`:

```bash
aws cloudformation deploy \
  --template-file cloudformation.yml \
  --stack-name lead-from-here-prod \
  --capabilities CAPABILITY_IAM \
  --region eu-west-1
```

### Delete Infrastructure

```bash
aws cloudformation delete-stack \
  --stack-name lead-from-here-prod \
  --region eu-west-1
```

## Deployment

Every push to `main` branch automatically:
1. Builds the React app
2. Deploys CloudFormation (if infrastructure changed)
3. Deploys to Elastic Beanstalk

To deploy manually:
- Go to GitHub → Actions → Deploy to AWS → Run workflow

## Viewing Logs

```bash
eb logs --region eu-west-1
eb open --region eu-west-1
```
