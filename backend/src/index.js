const express = require('express');
const { ApolloServer, gql } = require('apollo-server-express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

// GraphQL Schema
const typeDefs = gql`
  type Query {
    getActivityRankings(city: String!, latitude: Float, longitude: Float): ActivityRankings!
    searchCities(query: String!): [City!]!
  }

  type City {
    name: String!
    country: String!
    latitude: Float!
    longitude: Float!
    admin1: String
  }

  type ActivityRankings {
    city: City!
    rankings: [ActivityRank!]!
    forecast: [DailyForecast!]!
  }

  type ActivityRank {
    activity: String!
    score: Float!
    bestDays: [BestDay!]!
    reasoning: String!
  }

  type BestDay {
    date: String!
    score: Float!
  }

  type DailyForecast {
    date: String!
    temperatureMax: Float!
    temperatureMin: Float!
    precipitation: Float!
    windSpeed: Float!
    cloudCover: Float!
    snowfall: Float!
    waveHeight: Float
    weatherCode: Int!
  }
`;

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour

// Weather service
class WeatherService {
  async getWeatherForecast(latitude, longitude) {
    const cacheKey = `weather-${latitude}-${longitude}`;
    const cached = cache.get(cacheKey);
    
    if (cached && cached.timestamp > Date.now() - CACHE_TTL) {
      return cached.data;
    }

    try {
      // First, make the basic weather API call
      const params = new URLSearchParams({
        latitude,
        longitude,
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,cloudcover_mean,snowfall_sum,weathercode',
        timezone: 'auto',
        forecast_days: 7
      });

      const url = `https://api.open-meteo.com/v1/forecast?${params}`;
      console.log(`Fetching weather data from: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate the response structure
      if (!data.daily || !data.daily.time || !Array.isArray(data.daily.time)) {
        console.error('Invalid weather data structure:', JSON.stringify(data));
        throw new Error('Invalid weather data received from API');
      }

      // Check if we're near a coast for wave data
      const isCoastal = await this.checkIfCoastal(latitude, longitude);
      
      // If coastal, try to get marine data (but handle if not available)
      if (isCoastal) {
        try {
          const marineParams = new URLSearchParams({
            latitude,
            longitude,
            daily: 'wave_height_max',
            timezone: 'auto',
            forecast_days: 7
          });
          
          const marineUrl = `https://marine-api.open-meteo.com/v1/marine?${marineParams}`;
          console.log(`Fetching marine data from: ${marineUrl}`);
          
          const marineResponse = await fetch(marineUrl);
          
          if (marineResponse.ok) {
            const marineData = await marineResponse.json();
            if (marineData.daily && marineData.daily.wave_height_max) {
              data.daily.wave_height_max = marineData.daily.wave_height_max;
            }
          } else {
            console.log(`Marine data not available for ${latitude},${longitude}`);
          }
        } catch (marineError) {
          console.log(`Failed to fetch marine data: ${marineError.message}`);
          // Continue without wave data
        }
      }

      const result = {
        daily: data.daily,
        isCoastal
      };

      cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error(`Error fetching weather for ${latitude},${longitude}:`, error);
      throw new Error(`Failed to fetch weather data: ${error.message}`);
    }
  }

  async searchCities(query) {
    const cacheKey = `city-${query}`;
    const cached = cache.get(cacheKey);
    
    if (cached && cached.timestamp > Date.now() - CACHE_TTL) {
      return cached.data;
    }

    const params = new URLSearchParams({
      name: query,
      count: 10,
      language: 'en',
      format: 'json'
    });

    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
    const data = await response.json();

    const results = data.results || [];
    cache.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  }

  async checkIfCoastal(latitude, longitude) {
    // Simplified coastal check - in production would use a proper geographic API
    // This is a rough approximation based on known coastal areas
    const coastalZones = [
      // North America
      { name: 'US West Coast', latRange: [32, 49], lonRange: [-125, -117] },
      { name: 'US East Coast', latRange: [25, 45], lonRange: [-81, -66] },
      { name: 'Gulf of Mexico', latRange: [25, 30], lonRange: [-98, -81] },
      { name: 'Hawaii', latRange: [18, 23], lonRange: [-161, -154] },
      { name: 'California', latRange: [32, 42], lonRange: [-125, -117] },
      
      // Australia
      { name: 'Australia East', latRange: [-39, -10], lonRange: [141, 154] },
      { name: 'Australia West', latRange: [-35, -15], lonRange: [112, 129] },
      { name: 'Australia South', latRange: [-39, -31], lonRange: [129, 141] },
      
      // Europe
      { name: 'Europe Atlantic', latRange: [36, 60], lonRange: [-10, 0] },
      { name: 'Mediterranean', latRange: [30, 45], lonRange: [-6, 36] },
      { name: 'North Sea', latRange: [50, 60], lonRange: [-2, 10] },
      { name: 'Baltic Sea', latRange: [53, 66], lonRange: [10, 30] },
      
      // Asia
      { name: 'Japan', latRange: [30, 45], lonRange: [129, 146] },
      { name: 'Southeast Asia', latRange: [-10, 20], lonRange: [95, 140] },
      { name: 'India West', latRange: [8, 24], lonRange: [68, 77] },
      { name: 'India East', latRange: [8, 22], lonRange: [80, 92] },
      
      // South America
      { name: 'Brazil', latRange: [-34, 5], lonRange: [-74, -35] },
      { name: 'Chile', latRange: [-56, -18], lonRange: [-76, -68] },
      
      // Africa
      { name: 'South Africa', latRange: [-35, -22], lonRange: [16, 33] },
      { name: 'West Africa', latRange: [-5, 35], lonRange: [-18, -5] }
    ];

    const isInCoastalZone = coastalZones.some(zone => 
      latitude >= zone.latRange[0] && latitude <= zone.latRange[1] &&
      longitude >= zone.lonRange[0] && longitude <= zone.lonRange[1]
    );
    
    if (isInCoastalZone) {
      console.log(`Location ${latitude}, ${longitude} detected as coastal`);
    }
    
    return isInCoastalZone;
  }
}

// Activity ranking logic
class ActivityRanker {
  rankActivities(weatherData) {
    const { daily, isCoastal } = weatherData;
    
    // Add validation
    if (!daily || !daily.time || !Array.isArray(daily.time) || daily.time.length === 0) {
      console.error('Invalid weather data in rankActivities:', weatherData);
      throw new Error('Invalid weather data structure');
    }
    
    const activities = [
      this.rankSkiing(daily),
      this.rankSurfing(daily, isCoastal),
      this.rankOutdoorSightseeing(daily),
      this.rankIndoorSightseeing(daily)
    ];

    return activities.sort((a, b) => b.score - a.score);
  }

  rankSkiing(daily) {
    const scores = daily.time.map((date, i) => {
      const tempMax = daily.temperature_2m_max[i];
      const tempMin = daily.temperature_2m_min[i];
      const snowfall = daily.snowfall_sum[i] || 0;
      const windSpeed = daily.windspeed_10m_max[i];
      
      // Ideal skiing: -10 to 0°C, snowfall, low wind
      let score = 0;
      
      // Temperature score (40%)
      const avgTemp = (tempMax + tempMin) / 2;
      if (avgTemp >= -10 && avgTemp <= 0) score += 0.4;
      else if (avgTemp >= -15 && avgTemp <= 5) score += 0.2;
      
      // Snowfall score (30%)
      if (snowfall > 10) score += 0.3;
      else if (snowfall > 5) score += 0.2;
      else if (snowfall > 0) score += 0.1;
      
      // Wind score (20%)
      if (windSpeed < 20) score += 0.2;
      else if (windSpeed < 30) score += 0.1;
      
      // Weather code bonus (10%)
      const weatherCode = daily.weathercode[i];
      if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) score += 0.1; // Snow codes
      
      return { date, score };
    });

    const avgScore = scores.reduce((sum, day) => sum + day.score, 0) / scores.length;
    const bestDays = scores.sort((a, b) => b.score - a.score).slice(0, 3);

    return {
      activity: 'Skiing',
      score: avgScore,
      bestDays,
      reasoning: this.getSkiingReasoning(avgScore, bestDays[0])
    };
  }

  rankSurfing(daily, isCoastal) {
    if (!isCoastal) {
      return {
        activity: 'Surfing',
        score: 0,
        bestDays: [],
        reasoning: 'This location is not near a coast suitable for surfing.'
      };
    }

    const scores = daily.time.map((date, i) => {
      const tempMax = daily.temperature_2m_max[i];
      const tempMin = daily.temperature_2m_min[i];
      const windSpeed = daily.windspeed_10m_max[i];
      const precipitation = daily.precipitation_sum[i];
      const waveHeight = daily.wave_height_max?.[i] || 1.5; // Default if not available
      
      let score = 0;
      
      // Temperature score (30%)
      const avgTemp = (tempMax + tempMin) / 2;
      if (avgTemp >= 20 && avgTemp <= 25) score += 0.3;
      else if (avgTemp >= 15 && avgTemp <= 30) score += 0.15;
      
      // Wave height score (40%)
      if (waveHeight >= 1 && waveHeight <= 2) score += 0.4;
      else if (waveHeight >= 0.5 && waveHeight <= 3) score += 0.2;
      
      // Wind score (20%)
      if (windSpeed >= 10 && windSpeed <= 20) score += 0.2;
      else if (windSpeed >= 5 && windSpeed <= 25) score += 0.1;
      
      // No rain bonus (10%)
      if (precipitation < 1) score += 0.1;
      
      return { date, score };
    });

    const avgScore = scores.reduce((sum, day) => sum + day.score, 0) / scores.length;
    const bestDays = scores.sort((a, b) => b.score - a.score).slice(0, 3);

    return {
      activity: 'Surfing',
      score: avgScore,
      bestDays,
      reasoning: this.getSurfingReasoning(avgScore, bestDays[0])
    };
  }

  rankOutdoorSightseeing(daily) {
    const scores = daily.time.map((date, i) => {
      const tempMax = daily.temperature_2m_max[i];
      const tempMin = daily.temperature_2m_min[i];
      const precipitation = daily.precipitation_sum[i];
      const cloudCover = daily.cloudcover_mean[i];
      const windSpeed = daily.windspeed_10m_max[i];
      
      let score = 0;
      
      // Temperature score (35%)
      const avgTemp = (tempMax + tempMin) / 2;
      if (avgTemp >= 15 && avgTemp <= 25) score += 0.35;
      else if (avgTemp >= 10 && avgTemp <= 30) score += 0.2;
      else if (avgTemp >= 5 && avgTemp <= 35) score += 0.1;
      
      // Precipitation score (35%)
      if (precipitation === 0) score += 0.35;
      else if (precipitation < 2) score += 0.2;
      else if (precipitation < 5) score += 0.1;
      
      // Cloud cover score (20%)
      if (cloudCover < 30) score += 0.2;
      else if (cloudCover < 60) score += 0.1;
      
      // Wind score (10%)
      if (windSpeed < 15) score += 0.1;
      
      return { date, score };
    });

    const avgScore = scores.reduce((sum, day) => sum + day.score, 0) / scores.length;
    const bestDays = scores.sort((a, b) => b.score - a.score).slice(0, 3);

    return {
      activity: 'Outdoor Sightseeing',
      score: avgScore,
      bestDays,
      reasoning: this.getOutdoorReasoning(avgScore, bestDays[0])
    };
  }

  rankIndoorSightseeing(daily) {
    const scores = daily.time.map((date, i) => {
      const tempMax = daily.temperature_2m_max[i];
      const tempMin = daily.temperature_2m_min[i];
      const precipitation = daily.precipitation_sum[i];
      const windSpeed = daily.windspeed_10m_max[i];
      const weatherCode = daily.weathercode[i];
      
      // Indoor activities score higher on bad weather days
      let score = 0;
      
      // Bad temperature score (30%)
      const avgTemp = (tempMax + tempMin) / 2;
      if (avgTemp < 5 || avgTemp > 30) score += 0.3;
      else if (avgTemp < 10 || avgTemp > 25) score += 0.15;
      
      // Precipitation score (40%)
      if (precipitation > 10) score += 0.4;
      else if (precipitation > 5) score += 0.3;
      else if (precipitation > 2) score += 0.2;
      else if (precipitation > 0) score += 0.1;
      
      // Wind score (20%)
      if (windSpeed > 30) score += 0.2;
      else if (windSpeed > 20) score += 0.1;
      
      // Severe weather bonus (10%)
      if ([45, 48, 51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode)) {
        score += 0.1;
      }
      
      return { date, score };
    });

    const avgScore = scores.reduce((sum, day) => sum + day.score, 0) / scores.length;
    const bestDays = scores.sort((a, b) => b.score - a.score).slice(0, 3);

    return {
      activity: 'Indoor Sightseeing',
      score: avgScore,
      bestDays,
      reasoning: this.getIndoorReasoning(avgScore, bestDays[0])
    };
  }

  getSkiingReasoning(score, bestDay) {
    if (score > 0.7) return `Excellent skiing conditions expected! Fresh snow and ideal temperatures make this a perfect destination for skiing, especially on ${bestDay.date}.`;
    if (score > 0.5) return `Good skiing conditions with favorable temperatures. Best conditions expected on ${bestDay.date}.`;
    if (score > 0.3) return `Moderate skiing conditions. Some days may have suitable weather, particularly ${bestDay.date}.`;
    return 'Poor skiing conditions expected. Consider alternative activities or destinations.';
  }

  getSurfingReasoning(score, bestDay) {
    if (!bestDay) return 'This location is not suitable for surfing.';
    if (score > 0.7) return `Excellent surfing conditions! Perfect waves and temperatures expected, especially on ${bestDay.date}.`;
    if (score > 0.5) return `Good surfing conditions with decent waves. Best day for surfing: ${bestDay.date}.`;
    if (score > 0.3) return `Fair surfing conditions. Some suitable days, with ${bestDay.date} being the most promising.`;
    return 'Poor surfing conditions expected this week.';
  }

  getOutdoorReasoning(score, bestDay) {
    if (score > 0.7) return `Perfect weather for outdoor activities! Clear skies and comfortable temperatures, especially on ${bestDay.date}.`;
    if (score > 0.5) return `Good conditions for outdoor sightseeing. Best weather expected on ${bestDay.date}.`;
    if (score > 0.3) return `Mixed conditions for outdoor activities. Plan for ${bestDay.date} for the best experience.`;
    return 'Challenging conditions for outdoor activities. Consider indoor alternatives.';
  }

  getIndoorReasoning(score, bestDay) {
    if (score > 0.7) return `Perfect time for museums and indoor attractions! Poor outdoor weather makes indoor activities ideal, especially on ${bestDay.date}.`;
    if (score > 0.5) return `Good opportunity for indoor sightseeing due to unfavorable outdoor conditions on ${bestDay.date}.`;
    if (score > 0.3) return `Some days favor indoor activities, particularly ${bestDay.date}.`;
    return 'Weather is generally good for outdoor activities - indoor sightseeing less necessary.';
  }
}

// GraphQL Resolvers
const weatherService = new WeatherService();
const activityRanker = new ActivityRanker();

const resolvers = {
  Query: {
    async getActivityRankings(_, { city, latitude, longitude }) {
      try {
        let coords = { latitude, longitude };
        let cityData = null;

        // If coordinates not provided, search for city
        if (!latitude || !longitude) {
          const cities = await weatherService.searchCities(city);
          if (!cities || cities.length === 0) {
            throw new Error(`City "${city}" not found`);
          }
          cityData = cities[0];
          coords = { latitude: cityData.latitude, longitude: cityData.longitude };
        } else {
          // Create city data from provided info
          cityData = {
            name: city,
            country: 'Unknown',
            latitude: coords.latitude,
            longitude: coords.longitude
          };
        }

        // Validate coordinates
        if (Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) {
          throw new Error(`Invalid coordinates: ${coords.latitude}, ${coords.longitude}`);
        }

        console.log(`Fetching weather for ${cityData.name} at ${coords.latitude}, ${coords.longitude}`);
        
        const weatherData = await weatherService.getWeatherForecast(coords.latitude, coords.longitude);
        const rankings = activityRanker.rankActivities(weatherData);

        // Format forecast data with validation
        const forecast = weatherData.daily.time.map((date, i) => ({
          date,
          temperatureMax: weatherData.daily.temperature_2m_max?.[i] ?? 0,
          temperatureMin: weatherData.daily.temperature_2m_min?.[i] ?? 0,
          precipitation: weatherData.daily.precipitation_sum?.[i] ?? 0,
          windSpeed: weatherData.daily.windspeed_10m_max?.[i] ?? 0,
          cloudCover: weatherData.daily.cloudcover_mean?.[i] ?? 0,
          snowfall: weatherData.daily.snowfall_sum?.[i] ?? 0,
          waveHeight: weatherData.daily.wave_height_max?.[i] ?? null,
          weatherCode: weatherData.daily.weathercode?.[i] ?? 0
        }));

        return {
          city: cityData,
          rankings,
          forecast
        };
      } catch (error) {
        console.error('Error in getActivityRankings:', error);
        throw new Error(`Failed to get activity rankings: ${error.message}`);
      }
    },

    async searchCities(_, { query }) {
      try {
        const results = await weatherService.searchCities(query);
        return results.map(city => ({
          name: city.name,
          country: city.country,
          latitude: city.latitude,
          longitude: city.longitude,
          admin1: city.admin1 || null
        }));
      } catch (error) {
        console.error('Error in searchCities:', error);
        throw new Error(`Failed to search cities: ${error.message}`);
      }
    }
  }
};

// Express server setup
async function startServer() {
  const app = express();
  
  // CORS configuration
  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Allow any CloudFront distribution or configured frontend URL
      const allowedPatterns = [
        /^https:\/\/[a-z0-9]+\.cloudfront\.net$/,
        /^http:\/\/localhost:\d+$/,
      ];
      
      // Also allow the specific frontend URL if configured
      if (process.env.FRONTEND_URL) {
        callback(null, true); // Trust the configured URL
      } else if (allowedPatterns.some(pattern => pattern.test(origin))) {
        callback(null, true);
      } else {
        callback(null, true); // For development, allow all origins
        // In production, you might want to be more restrictive:
        // callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  };

  app.use(cors(corsOptions));

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    cache: 'bounded',
    persistedQueries: false,
    introspection: true, // Enable introspection in production for debugging
    formatError: (err) => {
      console.error('GraphQL Error:', err);
      return err;
    },
  });

  await server.start();
  
  // Apply middleware with explicit path
  server.applyMiddleware({ 
    app, 
    path: '/graphql',
    cors: false // We're handling CORS at the Express level
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Root endpoint for debugging
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Weather Activity API',
      graphql: '/graphql',
      health: '/health'
    });
  });

  // Catch-all for debugging
  app.use((req, res) => {
    console.log(`Unhandled request: ${req.method} ${req.path}`);
    res.status(404).json({ 
      error: 'Not Found', 
      path: req.path,
      method: req.method 
    });
  });

  const PORT = process.env.PORT || 4000;
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});