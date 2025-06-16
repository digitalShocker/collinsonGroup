#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Testing Weather Activity App Endpoints${NC}\n"

# Get ALB URL
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --names weather-activity-alb \
    --query 'LoadBalancers[0].DNSName' \
    --output text 2>/dev/null)

if [ -z "$ALB_DNS" ] || [ "$ALB_DNS" == "None" ]; then
    echo -e "${RED}Error: Could not find ALB${NC}"
    exit 1
fi

ALB_URL="http://${ALB_DNS}"
echo -e "${GREEN}ALB URL: ${ALB_URL}${NC}\n"

# Test 1: Health endpoint
echo -e "${YELLOW}1. Testing health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "${ALB_URL}/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | grep -v "HTTP_STATUS")

if [ "$HEALTH_STATUS" == "200" ]; then
    echo -e "${GREEN}✓ Health check passed (HTTP ${HEALTH_STATUS})${NC}"
    echo "Response: $HEALTH_BODY"
else
    echo -e "${RED}✗ Health check failed (HTTP ${HEALTH_STATUS})${NC}"
    echo "Response: $HEALTH_BODY"
fi

# Test 2: GraphQL endpoint GET (should return error or GraphQL playground)
echo -e "\n${YELLOW}2. Testing GraphQL endpoint (GET)...${NC}"
GRAPHQL_GET_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "${ALB_URL}/graphql")
GRAPHQL_GET_STATUS=$(echo "$GRAPHQL_GET_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
GRAPHQL_GET_BODY=$(echo "$GRAPHQL_GET_RESPONSE" | grep -v "HTTP_STATUS" | head -n 5)

echo -e "HTTP Status: ${GRAPHQL_GET_STATUS}"
echo "Response preview:"
echo "$GRAPHQL_GET_BODY"

# Test 3: GraphQL endpoint POST with query
echo -e "\n${YELLOW}3. Testing GraphQL endpoint (POST with query)...${NC}"
GRAPHQL_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}' \
  "${ALB_URL}/graphql")

GRAPHQL_STATUS=$(echo "$GRAPHQL_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
GRAPHQL_BODY=$(echo "$GRAPHQL_RESPONSE" | grep -v "HTTP_STATUS")

if [ "$GRAPHQL_STATUS" == "200" ]; then
    echo -e "${GREEN}✓ GraphQL endpoint responding (HTTP ${GRAPHQL_STATUS})${NC}"
    echo "Response: $GRAPHQL_BODY"
else
    echo -e "${RED}✗ GraphQL endpoint failed (HTTP ${GRAPHQL_STATUS})${NC}"
    echo "Response: $GRAPHQL_BODY"
fi

# Test 4: Test actual GraphQL query
echo -e "\n${YELLOW}4. Testing searchCities query...${NC}"
SEARCH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"query { searchCities(query: \"New York\") { name country } }"}' \
  "${ALB_URL}/graphql")

SEARCH_STATUS=$(echo "$SEARCH_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
SEARCH_BODY=$(echo "$SEARCH_RESPONSE" | grep -v "HTTP_STATUS")

if [ "$SEARCH_STATUS" == "200" ]; then
    echo -e "${GREEN}✓ GraphQL query working (HTTP ${SEARCH_STATUS})${NC}"
    echo "Response: $SEARCH_BODY"
else
    echo -e "${RED}✗ GraphQL query failed (HTTP ${SEARCH_STATUS})${NC}"
    echo "Response: $SEARCH_BODY"
fi

# Test 5: Check what the frontend is using
echo -e "\n${YELLOW}5. Checking frontend configuration...${NC}"
CLOUDFRONT_DOMAIN=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?Comment=='weather-activity frontend distribution'].DomainName" \
    --output text)

if [ ! -z "$CLOUDFRONT_DOMAIN" ] && [ "$CLOUDFRONT_DOMAIN" != "None" ]; then
    echo -e "${GREEN}CloudFront URL: https://${CLOUDFRONT_DOMAIN}${NC}"
    
    # Try to fetch the main JS bundle and look for the GraphQL URL
    echo -e "\n${YELLOW}Checking frontend GraphQL configuration...${NC}"
    curl -s "https://${CLOUDFRONT_DOMAIN}/static/js/main.*.js" 2>/dev/null | grep -o "REACT_APP_GRAPHQL_URL[^,]*" | head -n 1 || echo "Could not extract GraphQL URL from frontend bundle"
fi

echo -e "\n${YELLOW}Summary:${NC}"
echo "- Backend should be at: ${ALB_URL}/graphql"
echo "- Frontend should be at: https://${CLOUDFRONT_DOMAIN}"
echo "- Frontend should be configured to use: ${ALB_URL}/graphql"