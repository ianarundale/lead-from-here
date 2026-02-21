# AWS Deployment Guide - Lead From Here

## Prerequisites
- AWS Account with Elastic Beanstalk access
- AWS CLI installed: `brew install awscli`
- EB CLI installed: `brew install awsebcli`
- GitHub account with your repo pushed

## Step 1: Deploy Backend (Elastic Beanstalk)

### 1a. Install and Configure EB CLI
```bash
# Install EB CLI (if not already installed)
brew install awsebcli

# Configure AWS credentials
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Region: us-east-1 (or your preferred region)
# Output format: json
```

### 1b. Initialize Elastic Beanstalk
```bash
cd /Users/arundi01/workspace/lead-from-here

# Initialize EB
eb init -p node.js-18 lead-from-here-api --region us-east-1

# Choose "Yes" for CodeCommit (or use GitHub for automation)
# This creates `.elasticbeanstalk/config.yml`
```

### 1c. Create and Deploy
```bash
# Create environment and deploy (this takes 5-10 minutes)
eb create lead-from-here-prod --instance-type t2.micro

# Watch deployment logs
eb logs --stream

# Open in browser to verify
eb open
# Save the URL shown (e.g., http://lead-from-here-prod.us-east-1.elasticbeanstalk.com)
```

### 1d. Update CORS for WebSocket
```bash
# Set environment variable to allow cross-origin WebSocket
eb setenv CORS_ORIGIN="*"

# Restart environment
eb restart
```

---

## Step 2: Get Backend URL
After deployment, your backend URL will be:
```
http://lead-from-here-prod.us-east-1.elasticbeanstalk.com
```

**Save this URL** - you'll need it for the frontend.

---

## Step 3: Deploy Frontend (AWS Amplify)

### 3a. Push Code to GitHub
```bash
git push origin main
```

### 3b. Connect to Amplify
1. Go to AWS Console → **Amplify**
2. Click **"New app"** → **"Host web app"**
3. Select **GitHub** as source
4. Authenticate with GitHub
5. Select your repository
6. Select **main** branch
7. Create new role (if prompted)

### 3c. Configure Build Settings
1. In Amplify, click **App settings** → **Environment variables**
2. Add variable:
   - Key: `REACT_APP_BACKEND_URL`
   - Value: `http://lead-from-here-prod.us-east-1.elasticbeanstalk.com`

3. Edit `amplify.yml` build settings:
```yaml
version: 1
backend:
  phases:
    build:
      commands:
        - echo "Backend is on Elastic Beanstalk"
frontend:
  phases:
    preBuild:
      commands:
        - cd client && npm ci
    build:
      commands:
        - cd client && REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL npm run build
  artifacts:
    baseDirectory: client/build
    files:
      - '**/*'
  cache:
    paths:
      - client/node_modules/**/*
```

### 3d. Update Client Code
In `client/src/App.js`, update the WebSocket connection:
```javascript
const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
const wsProtocol = backendUrl.startsWith('https') ? 'wss:' : 'ws:';
const wsUrl = backendUrl.replace(/^https?:\/\//, '');
const websocket = new WebSocket(`${wsProtocol}//${wsUrl}`);
```

### 3e. Trigger Deployment
Push a commit to GitHub:
```bash
git add .
git commit -m "Update backend URL for AWS deployment"
git push origin main
```

Amplify will auto-deploy. Watch the deployment progress in Amplify console.

---

## Step 4: Verify Deployment

1. **Check Elastic Beanstalk**: 
   ```bash
   eb status
   ```

2. **Check Amplify**: 
   - Go to Amplify console → see green checkmark

3. **Test the App**:
   - Open your Amplify frontend URL
   - Should connect to backend on EB
   - Test voting in multiple browser windows

---

## Monitoring & Logs

### View Backend Logs
```bash
eb logs --stream
```

### View Environment Health
```bash
eb health
```

### SSH into EC2 Instance (if needed)
```bash
eb ssh
```

---

## Cost Estimate (Monthly)
- **Elastic Beanstalk (t2.micro)**: Free tier (first 750 hours) or ~$10/month
- **Amplify**: Free tier or ~$1-5/month
- **Total**: Free-$15/month

---

## Troubleshooting

### Backend not connecting
- Check Elastic Beanstalk health: `eb health`
- View logs: `eb logs --stream`
- Verify CORS: `eb printenv`

### Frontend stuck loading
- Check browser console (F12) for WebSocket errors
- Verify backend URL in environment variables
- Check Amplify build logs

### WebSocket connection fails
- Ensure backend URL uses same protocol (http/https or ws/wss)
- Check security groups allow port 80/443
- Verify CORS_ORIGIN environment variable is set

---

## Scaling (Future)

To handle more concurrent users:
```bash
# Scale to 2 instances
eb scale 2

# Auto-scale based on load
eb config
# Edit: aws:autoscaling:asg:MinSize = 1, MaxSize = 4
```

---

## Next Steps

1. Run the deployment steps above
2. Share your Amplify URL with people
3. Test with multiple users accessing simultaneously
4. If votes aren't syncing, check browser console & Elastic Beanstalk logs
