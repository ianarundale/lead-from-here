# AWS Deployment Guide - Lead From Here

## Architecture

```
GitHub Actions ──OIDC──▶ IAM Role ──▶ AWS Resources
                                    ├── S3 (CloudFormation)
                                    └── Elastic Beanstalk (CloudFormation)
```

The OIDC provider and IAM role are created **manually first** (required for GitHub Actions to authenticate). CloudFormation manages the rest.

---

## Prerequisites

- AWS Account
- GitHub repository with this code pushed

---

## One-Time Setup

### 1. Create OIDC Provider & Role

```bash
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)

# Create OIDC provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list "sts.amazonaws.com" \
  --thumbprint-list "6938FD4D98BABEC356DA5494E410BCB82C2AD4A6" \
  --region eu-west-1

# Create IAM role
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
# EB permissions
aws iam attach-role-policy \
  --role-name GitHubDeployRole \
  --policy-arn arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier \
  --region eu-west-1

# S3 permissions
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

# CloudFormation permissions
aws iam put-role-policy \
  --role-name GitHubDeployRole \
  --policy-name GitHubDeployCFNPolicy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["cloudformation:CreateStack", "cloudformation:UpdateStack", "cloudformation:DescribeStacks"],
        "Resource": "arn:aws:cloudformation:eu-west-1:'${AWS_ACCOUNT_ID}':stack/lead-from-here-prod/*"
      }
    ]
  }' \
  --region eu-west-1
```

### 3. Add GitHub Secrets

In your repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | `arn:aws:iam::123456789012:role/GitHubDeployRole` |
| `AWS_S3_BUCKET` | `lead-from-here-deploy` |
| `AWS_EB_URL` | (add after first deployment) |

---

## Deployment

### First Deploy

```bash
# Deploy infrastructure (S3 + Elastic Beanstalk)
aws cloudformation deploy \
  --template-file infrastructure/cloudformation.yml \
  --stack-name lead-from-here-prod \
  --capabilities CAPABILITY_IAM \
  --region eu-west-1
```

### Ongoing Deployments

Every push to `main` automatically:
1. Builds React app
2. Deploys CloudFormation (if changed)
3. Deploys to Elastic Beanstalk

Or manually via GitHub → Actions → Deploy to AWS → Run workflow

---

## Troubleshooting

- **Workflow fails**: Check GitHub Actions logs
- **EB issues**: Run `eb logs --region eu-west-1`
- **Check status**: `eb status --region eu-west-1`

---

## Files

- `infrastructure/cloudformation.yml` - AWS resources definition
- `.github/workflows/deploy.yml` - CI/CD pipeline
- `.ebextensions/nodejs.config` - EB configuration
