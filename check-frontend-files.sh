#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Checking Frontend Files...${NC}\n"

# Get bucket name
BUCKET_NAME="weather-activity-frontend-$(aws sts get-caller-identity --query Account --output text)"

# Check if index.html exists in S3
echo -e "${YELLOW}1. Checking index.html in S3...${NC}"
aws s3 ls s3://${BUCKET_NAME}/index.html
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ index.html found in S3${NC}"
    
    # Download and check content
    echo -e "\n${YELLOW}2. Checking index.html content...${NC}"
    aws s3 cp s3://${BUCKET_NAME}/index.html - | grep -E "(id=\"root\"|<div id='root')" || echo -e "${RED}✗ No root element found in index.html${NC}"
else
    echo -e "${RED}✗ index.html not found in S3${NC}"
fi

# Check CloudFront
echo -e "\n${YELLOW}3. Testing CloudFront...${NC}"
CLOUDFRONT_URL="https://d1r5t3snuvtl9u.cloudfront.net"

# Test index.html
echo -e "Fetching index.html from CloudFront..."
curl -s ${CLOUDFRONT_URL}/ | head -20

# Check if static files are accessible
echo -e "\n${YELLOW}4. Checking static files...${NC}"
curl -s -I ${CLOUDFRONT_URL}/static/js/main.*.js | head -5

# List all files in S3 bucket
echo -e "\n${YELLOW}5. Files in S3 bucket:${NC}"
aws s3 ls s3://${BUCKET_NAME}/ --recursive | head -20