#!/bin/bash

# Ursly Website Deployment Script
# Deploy static website to AWS S3 + CloudFront

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Ursly Website Deployment${NC}"
echo "=================================="

# Check prerequisites
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

# Load environment variables
if [ ! -f .env.deploy ]; then
    echo -e "${RED}❌ .env.deploy file not found${NC}"
    echo "Please create .env.deploy with:"
    echo "  S3_BUCKET=your-ursly-bucket"
    echo "  CLOUDFRONT_DISTRIBUTION_ID=your-distribution-id"
    echo "  AWS_REGION=us-east-1"
    exit 1
fi

source .env.deploy

# Validate required variables
if [ -z "$S3_BUCKET" ] || [ -z "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo -e "${RED}❌ Missing required environment variables${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Configuration loaded${NC}"
echo "  S3 Bucket: $S3_BUCKET"
echo "  CloudFront: $CLOUDFRONT_DISTRIBUTION_ID"
echo "  Region: $AWS_REGION"
echo ""

# Step 1: Verify AWS credentials (without printing them)
echo -e "${YELLOW}🔐 Verifying AWS credentials...${NC}"
if aws sts get-caller-identity > /dev/null 2>&1; then
    IDENTITY=$(aws sts get-caller-identity --query 'Account' --output text)
    echo -e "${GREEN}✓ AWS credentials valid (Account: $IDENTITY)${NC}"
else
    echo -e "${RED}❌ AWS credentials invalid. Please configure AWS CLI.${NC}"
    exit 1
fi

echo ""

# Step 2: Deploy to S3
echo -e "${YELLOW}📦 Deploying website to S3...${NC}"
aws s3 sync . s3://$S3_BUCKET \
    --delete \
    --exclude ".git/*" \
    --exclude "node_modules/*" \
    --exclude ".env*" \
    --exclude "scripts/*" \
    --exclude "README.md" \
    --exclude "deploy.sh" \
    --exclude "*.sh" \
    --region $AWS_REGION \
    --cache-control "public, max-age=3600" \
    --metadata "deployment-date=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo -e "${GREEN}✓ Files uploaded to S3${NC}"
echo ""

# Step 3: Invalidate CloudFront cache
echo -e "${YELLOW}🔄 Invalidating CloudFront cache...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo -e "${GREEN}✓ Invalidation created: $INVALIDATION_ID${NC}"
echo ""

# Step 4: Verify deployment
echo -e "${YELLOW}✅ Deployment Summary${NC}"
echo "  S3 Bucket: $S3_BUCKET"
echo "  Website URL: https://ursly.io (or your custom domain)"
echo "  Cache Status: Invalidating (takes 1-5 minutes)"
echo "  Invalidation ID: $INVALIDATION_ID"
echo ""

echo -e "${GREEN}✨ Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Wait 5 minutes for CloudFront cache to invalidate"
echo "  2. Clear your browser cache"
echo "  3. Visit https://ursly.io to verify changes"
echo ""

