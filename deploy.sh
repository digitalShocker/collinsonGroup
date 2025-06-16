#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Weather Activity App Deployment${NC}"
echo -e "${BLUE}================================${NC}"

# Function to check prerequisites
check_prerequisites() {
    echo -e "${GREEN}Checking prerequisites...${NC}"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}✗ AWS CLI is not installed${NC}"
        echo "Please install AWS CLI: https://aws.amazon.com/cli/"
        exit 1
    else
        echo -e "${GREEN}✓ AWS CLI found${NC}"
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker is not installed${NC}"
        echo "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    else
        echo -e "${GREEN}✓ Docker found${NC}"
    fi
    
    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        echo -e "${RED}✗ Terraform is not installed${NC}"
        echo "Please install Terraform: https://www.terraform.io/downloads"
        exit 1
    else
        echo -e "${GREEN}✓ Terraform found${NC}"
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗ Node.js is not installed${NC}"
        echo "Please install Node.js: https://nodejs.org/"
        exit 1
    else
        echo -e "${GREEN}✓ Node.js found${NC}"
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}✗ AWS credentials not configured${NC}"
        echo "Please run: aws configure"
        exit 1
    else
        echo -e "${GREEN}✓ AWS credentials configured${NC}"
    fi
}

# Function to deploy infrastructure
deploy_infrastructure() {
    echo -e "\n${GREEN}Step 1: Deploying infrastructure with Terraform...${NC}"
    cd terraform
    
    # Initialize Terraform
    echo -e "${YELLOW}Initializing Terraform...${NC}"
    terraform init
    
    # Plan deployment
    echo -e "${YELLOW}Planning infrastructure changes...${NC}"
    terraform plan -out=tfplan
    
    # Apply changes
    echo -e "${YELLOW}Applying infrastructure changes...${NC}"
    terraform apply tfplan
    
    # Clean up plan file
    rm -f tfplan
    
    cd ..
    echo -e "${GREEN}✓ Infrastructure deployed successfully${NC}"
}

# Function to deploy backend
deploy_backend() {
    echo -e "\n${GREEN}Step 2: Deploying backend...${NC}"
    
    # Make deploy script executable
    chmod +x deploy-backend.sh
    
    # Run backend deployment
    ./deploy-backend.sh
}

# Function to deploy frontend
deploy_frontend() {
    echo -e "\n${GREEN}Step 3: Deploying frontend...${NC}"
    
    # Make deploy script executable
    chmod +x deploy-frontend.sh
    
    # Wait a bit for ALB to be ready
    echo -e "${YELLOW}Waiting for ALB to be ready...${NC}"
    sleep 30
    
    # Run frontend deployment
    ./deploy-frontend.sh
}

# Function to display summary
display_summary() {
    echo -e "\n${BLUE}================================${NC}"
    echo -e "${BLUE}Deployment Summary${NC}"
    echo -e "${BLUE}================================${NC}"
    
    cd terraform
    
    ALB_URL=$(terraform output -raw alb_url 2>/dev/null || echo "Not available")
    CLOUDFRONT_URL=$(terraform output -raw cloudfront_url 2>/dev/null || echo "Not available")
    ECR_URL=$(terraform output -raw ecr_repository_url 2>/dev/null || echo "Not available")
    
    echo -e "${GREEN}Backend API URL:${NC} ${ALB_URL}/graphql"
    echo -e "${GREEN}Frontend URL:${NC} ${CLOUDFRONT_URL}"
    echo -e "${GREEN}ECR Repository:${NC} ${ECR_URL}"
    
    cd ..
    
    echo -e "\n${YELLOW}Note: It may take a few minutes for all services to be fully available.${NC}"
    echo -e "${YELLOW}Check the AWS console for detailed status of your resources.${NC}"
}

# Main deployment flow
main() {
    # Check prerequisites
    check_prerequisites
    
    # Ask for confirmation
    echo -e "\n${YELLOW}This will deploy resources to AWS that may incur costs.${NC}"
    read -p "Do you want to continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Deployment cancelled.${NC}"
        exit 1
    fi
    
    # Deploy infrastructure
    deploy_infrastructure
    
    # Deploy backend
    deploy_backend
    
    # Deploy frontend
    deploy_frontend
    
    # Display summary
    display_summary
    
    echo -e "\n${GREEN}✅ Deployment completed successfully!${NC}"
}

# Run main function
main