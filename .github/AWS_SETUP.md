# AWS Deployment Setup Guide

## GitHub Secrets Configuration

To enable website deployment, configure these secrets in GitHub:

### Required Secrets

1. **AWS_ACCESS_KEY_ID**
   - Your AWS access key ID
   - Example: `ASIAWLC57O2SOB5J7FG4`

2. **AWS_SECRET_ACCESS_KEY**
   - Your AWS secret access key
   - Keep this secure and never commit to repository

3. **AWS_SESSION_TOKEN**
   - Temporary session token (if using temporary credentials)
   - Required for temporary credentials from AWS STS

4. **S3_BUCKET**
   - S3 bucket name for website hosting
   - Example: `ursly-website` or `www.ursly.io`

### Optional Secrets

5. **CLOUDFRONT_DISTRIBUTION_ID**
   - CloudFront distribution ID for CDN
   - If not set, cache invalidation will be skipped

## Setting Up GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with its corresponding value

## AWS Region

The deployment workflow uses `us-east-1` by default. To change:

Edit `.github/workflows/deploy-website.yml`:
```yaml
env:
  AWS_REGION: us-east-1  # Change to your preferred region
```

## Testing Deployment

After configuring secrets:

1. Push changes to `main` branch (triggers automatic deployment)
2. Or manually trigger: **Actions** → **Deploy Website** → **Run workflow**

## Security Notes

⚠️ **Never commit AWS credentials to the repository!**

- Use GitHub Secrets for all sensitive values
- Rotate credentials regularly
- Use IAM roles with least privilege principle
- Consider using OIDC for better security (future enhancement)

## Troubleshooting

### Deployment fails with "Access Denied"

- Verify AWS credentials are correct
- Check IAM permissions for S3 and CloudFront
- Ensure S3 bucket exists and is accessible

### CloudFront invalidation fails

- Verify `CLOUDFRONT_DISTRIBUTION_ID` is correct
- Check CloudFront permissions in IAM policy

### Website not updating

- Check CloudFront cache invalidation completed
- Verify S3 sync completed successfully
- Check CloudFront distribution is pointing to correct S3 bucket

