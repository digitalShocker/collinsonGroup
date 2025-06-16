#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting frontend deployment...${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
S3_BUCKET="weather-activity-frontend-${AWS_ACCOUNT_ID}"

# Navigate to frontend directory
cd frontend

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm install

# Build the React app with relative GraphQL endpoint (will use same domain)
echo -e "${GREEN}Building React app with relative GraphQL endpoint...${NC}"
REACT_APP_GRAPHQL_URL="/graphql" npm run build

# Sync build files to S3
echo -e "${GREEN}Uploading files to S3...${NC}"
aws s3 sync build/ s3://${S3_BUCKET}/ --delete

# Invalidate CloudFront cache
echo -e "${GREEN}Invalidating CloudFront cache...${NC}"
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Comment=='weather-activity frontend distribution'].Id" \
    --output text)

if [ ! -z "$DISTRIBUTION_ID" ]; then
    aws cloudfront create-invalidation \
        --distribution-id ${DISTRIBUTION_ID} \
        --paths "/*"
    echo -e "${GREEN}CloudFront invalidation created.${NC}"
else
    echo -e "${YELLOW}Warning: Could not find CloudFront distribution ID.${NC}"
fi

# Get CloudFront URL
CLOUDFRONT_DOMAIN=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Comment=='weather-activity frontend distribution'].DomainName" \
    --output text)

if [ ! -z "$CLOUDFRONT_DOMAIN" ] && [ "$CLOUDFRONT_DOMAIN" != "None" ]; then
    CLOUDFRONT_URL="https://${CLOUDFRONT_DOMAIN}"
    echo -e "${GREEN}Frontend deployed successfully!${NC}"
    echo -e "${GREEN}Access your application at: ${CLOUDFRONT_URL}${NC}"
    echo -e "${YELLOW}GraphQL endpoint will be served at: ${CLOUDFRONT_URL}/graphql${NC}"
else
    echo -e "${GREEN}Frontend deployed to S3 bucket: ${S3_BUCKET}${NC}"
fi