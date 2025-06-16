#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting backend deployment...${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install it first.${NC}"
    exit 1
fi

# Get AWS account ID and region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")
ECR_REPOSITORY="weather-activity"

echo -e "${YELLOW}AWS Account ID: ${AWS_ACCOUNT_ID}${NC}"
echo -e "${YELLOW}AWS Region: ${AWS_REGION}${NC}"

# Navigate to backend directory
cd backend

# Build Docker image
echo -e "${GREEN}Building Docker image...${NC}"
docker build -t ${ECR_REPOSITORY}:latest .

# Login to ECR
echo -e "${GREEN}Logging into ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Tag image for ECR
echo -e "${GREEN}Tagging image for ECR...${NC}"
docker tag ${ECR_REPOSITORY}:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest

# Push image to ECR
echo -e "${GREEN}Pushing image to ECR...${NC}"
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest

# Update ECS service to force new deployment
echo -e "${GREEN}Updating ECS service...${NC}"
aws ecs update-service \
    --cluster weather-activity-cluster \
    --service weather-activity \
    --force-new-deployment \
    --region ${AWS_REGION}

echo -e "${GREEN}Backend deployment initiated! Check ECS console for deployment status.${NC}"
echo -e "${YELLOW}It may take a few minutes for the new deployment to be ready.${NC}"