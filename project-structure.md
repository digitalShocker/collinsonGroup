# Project Structure

```
weather-activity-app/
├── README.md                 # Main documentation
├── .gitignore               # Git ignore file
├── deploy.sh                # Main deployment script
├── deploy-backend.sh        # Backend deployment script
├── deploy-frontend.sh       # Frontend deployment script
│
├── backend/                 # Node.js/GraphQL backend
│   ├── package.json         # Backend dependencies
│   ├── Dockerfile          # Docker configuration
│   ├── .env.example        # Environment variables template
│   └── src/
│       └── index.js        # Main backend application
│
├── frontend/               # React frontend
│   ├── package.json        # Frontend dependencies
│   ├── public/
│   │   └── index.html      # HTML template
│   └── src/
│       ├── index.js        # React entry point
│       ├── index.css       # Global styles
│       ├── App.js          # Main React component
│       └── App.css         # Component styles
│
└── terraform/              # Infrastructure as Code
    └── main.tf             # AWS infrastructure definition
```

## Quick Start Guide

1. **Prerequisites**
   - AWS CLI configured with credentials
   - Docker installed
   - Terraform installed
   - Node.js (v16+) installed

2. **Deploy Everything**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **Manual Deployment Steps**
   ```bash
   # 1. Deploy infrastructure
   cd terraform
   terraform init
   terraform apply

   # 2. Deploy backend
   cd ../
   chmod +x deploy-backend.sh
   ./deploy-backend.sh

   # 3. Deploy frontend
   chmod +x deploy-frontend.sh
   ./deploy-frontend.sh
   ```

4. **Local Development**
   ```bash
   # Backend
   cd backend
   npm install
   npm run dev

   # Frontend (in another terminal)
   cd frontend
   npm install
   npm start
   ```

## Architecture Components

### Backend (ECS Fargate)
- GraphQL API server
- Weather data processing
- Activity ranking algorithms
- In-memory caching

### Frontend (S3 + CloudFront)
- React SPA
- Apollo Client for GraphQL
- Responsive design
- Real-time search

### Infrastructure (Terraform)
- VPC: Default VPC for simplicity
- ECS: Fargate for serverless containers
- ALB: Load balancer for backend
- S3: Static website hosting
- CloudFront: CDN for global distribution
- ECR: Container registry

## Environment Variables

### Backend
- `NODE_ENV`: Environment (production/development)
- `PORT`: Server port (default: 4000)
- `FRONTEND_URL`: Frontend URL for CORS

### Frontend
- `REACT_APP_GRAPHQL_URL`: Backend GraphQL endpoint

## Monitoring

- CloudWatch Logs: `/ecs/weather-activity`
- ECS Container Insights: Enabled
- ALB Health Checks: `/health` endpoint

## Cost Optimization

This minimal setup uses:
- Single Fargate task (0.25 vCPU, 0.5 GB RAM)
- Default VPC (no NAT Gateway costs)
- S3 + CloudFront for frontend (pay per use)
- No RDS/ElastiCache (using in-memory cache)

Estimated monthly cost: ~$15-30 depending on traffic