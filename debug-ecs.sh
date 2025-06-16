#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== ECS Debugging Tool ===${NC}"

# Check service status
echo -e "\n${YELLOW}1. Checking ECS Service Status...${NC}"
aws ecs describe-services \
    --cluster weather-activity-cluster \
    --services weather-activity \
    --query 'services[0].{Status:status,DesiredCount:desiredCount,RunningCount:runningCount,PendingCount:pendingCount}' \
    --output table

# Check recent service events
echo -e "\n${YELLOW}2. Recent Service Events (last 5):${NC}"
aws ecs describe-services \
    --cluster weather-activity-cluster \
    --services weather-activity \
    --query 'services[0].events[0:5].[createdAt,message]' \
    --output table

# Get task ARNs
echo -e "\n${YELLOW}3. Getting Task Information...${NC}"
TASK_ARNS=$(aws ecs list-tasks \
    --cluster weather-activity-cluster \
    --service-name weather-activity \
    --query 'taskArns[]' \
    --output text)

if [ -z "$TASK_ARNS" ]; then
    echo -e "${RED}No running tasks found!${NC}"
else
    # Check task status
    aws ecs describe-tasks \
        --cluster weather-activity-cluster \
        --tasks $TASK_ARNS \
        --query 'tasks[].[taskArn,lastStatus,healthStatus,stoppedReason]' \
        --output table
fi

# Check target group health
echo -e "\n${YELLOW}4. Checking Target Group Health...${NC}"
TG_ARN=$(aws elbv2 describe-target-groups \
    --names weather-activity-tg \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text 2>/dev/null)

if [ ! -z "$TG_ARN" ] && [ "$TG_ARN" != "None" ]; then
    aws elbv2 describe-target-health \
        --target-group-arn $TG_ARN \
        --query 'TargetHealthDescriptions[].[Target.Id,TargetHealth.State,TargetHealth.Reason]' \
        --output table
else
    echo -e "${RED}Target group not found${NC}"
fi

# Check CloudWatch logs
echo -e "\n${YELLOW}5. Recent Container Logs (last 20 lines):${NC}"
aws logs tail /ecs/weather-activity --max-items 20 2>/dev/null || echo -e "${RED}No logs found yet${NC}"

# Check task definition
echo -e "\n${YELLOW}6. Task Definition Environment Variables:${NC}"
aws ecs describe-task-definition \
    --task-definition weather-activity \
    --query 'taskDefinition.containerDefinitions[0].environment' \
    --output table

# Check ECR image
echo -e "\n${YELLOW}7. Latest ECR Image:${NC}"
REPO_URI=$(aws ecr describe-repositories \
    --repository-names weather-activity \
    --query 'repositories[0].repositoryUri' \
    --output text 2>/dev/null)

if [ ! -z "$REPO_URI" ] && [ "$REPO_URI" != "None" ]; then
    aws ecr describe-images \
        --repository-name weather-activity \
        --query 'sort_by(imageDetails,& imagePushedAt)[-1].[imagePushedAt,imageTags[0]]' \
        --output table
else
    echo -e "${RED}ECR repository not found${NC}"
fi

echo -e "\n${GREEN}=== Debugging Complete ===${NC}"
echo -e "\n${YELLOW}Common issues to check:${NC}"
echo "1. Health check endpoint (/health) returning 200 status"
echo "2. Container has enough memory (currently 512MB)"
echo "3. Security groups allow traffic on port 4000"
echo "4. Environment variables are set correctly"
echo "5. Docker image was built and pushed successfully"