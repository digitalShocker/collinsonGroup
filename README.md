# collinsonGroup
Technical Assessment - Collinson Group
![CollinsonGroup-AppDesign](https://github.com/user-attachments/assets/70204fd9-bce0-40a6-867e-b754b969d344)

## Executive Summary

This application helps travelers make informed decisions about their destinations by ranking cities based on weather suitability for various activities over the next 7 days. By analyzing weather forecasts, we provide data-driven recommendations for skiing, surfing, and sightseeing activities.

### Key Components

1. **Frontend (React)**: Single-page application served via CloudFront
2. **Backend (Node.js/GraphQL)**: API server handling business logic and weather data processing
3. **Infrastructure (AWS)**: 
   - CloudFront serves as the single entry point for both static files and API requests
   - Private S3 bucket with CloudFront Origin Access Identity (OAI)
   - ECS Fargate for serverless container hosting
   - Application Load Balancer for backend traffic distribution

## Technical Choices & Business Value

### Why GraphQL?
- **Efficient Data Fetching**: Clients request exactly what they need, reducing bandwidth
- **Strong Typing**: Self-documenting API that prevents errors
- **Future-Proof**: Easy to extend without breaking existing clients

### Why ECS Fargate?
- **Serverless Containers**: No server management required
- **Auto-scaling**: Handles traffic spikes automatically
- **Cost-Effective**: Pay only for resources used

### Why CloudFront as Universal Entry Point?
- **HTTPS Everywhere**: Solves mixed content issues by proxying HTTP backend through HTTPS
- **Simplified Architecture**: Single domain for both frontend and API
- **Security**: Hides backend infrastructure details

### Why This Architecture?
- **Separation of Concerns**: Frontend and backend can be developed/deployed independently
- **Scalability**: Each layer can scale based on demand
- **Maintainability**: Clear boundaries make updates easier
- **Security**: All traffic served over HTTPS through CloudFront
- **Performance**: CloudFront caching for both static assets and API responses

## AI Assistance & Human Judgment

### Where AI Helped:
- Boilerplate code generation for GraphQL resolvers
- React component structure setup
- Terraform module configurations
- Weather scoring algorithm suggestions

### Where Human Judgment Was Critical:
- **Activity Scoring Logic**: Defining what makes "ideal" conditions required domain expertise
- **User Experience Design**: Understanding user needs and creating intuitive interfaces
- **Architecture Decisions**: Balancing complexity with requirements
- **Error Handling Strategy**: Determining graceful fallbacks for API failures
- **Debugging Production Issues**: Identifying root causes of deployment problems
- **Security Architecture**: Choosing CloudFront proxy pattern over exposing HTTP endpoints

## Quick Start

```bash
# Deploy infrastructure
cd terraform
terraform init
terraform apply

# Deploy backend
cd ../
./deploy-backend.sh

# Deploy frontend
./deploy-frontend.sh

# Or deploy everything at once
./deploy.sh
```

### Local Development

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

## Activity Ranking Methodology

### Skiing
- **Ideal Conditions**: -10°C to 0°C, fresh snow, low wind
- **Scoring Factors**: Temperature (40%), Snowfall (30%), Wind (20%), Visibility (10%)

### Surfing
- **Ideal Conditions**: 20-25°C, 1-2m waves, offshore winds
- **Scoring Factors**: Wave height (40%), Wind direction (30%), Temperature (20%), Precipitation (10%)
- **Note**: Only available for coastal locations; uses separate Marine API for wave data

### Outdoor Sightseeing
- **Ideal Conditions**: 15-25°C, clear skies, no rain
- **Scoring Factors**: Temperature (30%), Precipitation (30%), Cloud cover (20%), UV index (20%)

### Indoor Sightseeing
- **Inverse Scoring**: Higher scores on poor weather days
- **Factors**: Rain intensity (40%), Temperature extremes (30%), Wind (30%)

## Omissions & Trade-offs

### Features Intentionally Omitted:
1. **User Authentication**: Not needed for MVP; would add complexity
2. **Historical Data**: Focus on forecasts only; historical trends could be phase 2
3. **Advanced Caching**: Simple in-memory caching used; Redis would be production choice
4. **Multiple Weather Providers**: Single source keeps it simple; easy to add more later

### Technical Shortcuts & Production Improvements:
1. **Error Monitoring**: Would add Sentry/DataDog in production
2. **API Rate Limiting**: Currently relying on Open-Meteo's limits
3. **Database**: No persistence layer; would add RDS/DynamoDB for user preferences
4. **CI/CD Pipeline**: Manual deployment; would automate with GitHub Actions
5. **SSL Certificates**: Using CloudFront defaults; would add custom domain/cert
6. **Coastal Detection**: Using coordinate zones; would use proper geographic API
7. **Caching Strategy**: In-memory only; would add Redis for distributed caching

### Why These Trade-offs Make Sense:
- **Speed to Market**: Get feedback quickly on core functionality (Since No One Responded to my email with questions or subsequent emails)
- **Cost Control**: Minimize infrastructure for prototype
- **Focus on Core Value**: Weather ranking is the key differentiator
- **Easy Evolution**: Architecture supports adding features without major refactoring

## Performance Considerations

- Weather data cached for 1 hour to reduce API calls
- Separate API calls for weather and marine data to handle failures gracefully
- GraphQL queries optimized to prevent N+1 problems
- Frontend uses React.memo for expensive computations
- CloudFront caching for both static assets and API responses
- Relative URLs (`/graphql`) eliminate cross-origin requests

## Security Measures

- Private S3 bucket with CloudFront Origin Access Identity (OAI)
- All traffic served over HTTPS through CloudFront
- CORS configured to allow CloudFront and localhost origins
- GraphQL query depth limiting prevents DoS attacks
- Environment variables for sensitive configuration
- AWS IAM roles for service authentication
- No exposed backend endpoints (ALB only accessible through CloudFront)

## Future Roadmap

1. **Phase 2**: Add more activities (hiking, swimming, photography)
2. **Phase 3**: User accounts with saved searches
3. **Phase 4**: Mobile applications

## Lessons Learned During Development

### Architectural Decisions
- **CloudFront as API Proxy**: Solved HTTPS/HTTP mixed content issues elegantly
- **Separate Weather APIs**: Marine data requires different endpoint than regular weather
- **City Data Preservation**: Important to maintain full city information through the data flow

### Debugging Insights
- **ECS Logs**: "localhost:4000" messages are normal startup logs, not errors
- **Mixed Content**: Modern browsers block HTTP requests from HTTPS pages
- **Package Lock Files**: Docker builds with `npm ci` require package-lock.json

### Best Practices Applied
- **Graceful Degradation**: App continues working even if marine data unavailable
- **Comprehensive Error Handling**: User-friendly messages for various failure modes
- **Validation Scripts**: Automated testing of all endpoints and services
