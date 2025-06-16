import React, { useState, useCallback, useMemo } from 'react';
import { ApolloClient, InMemoryCache, ApolloProvider, gql, useQuery, useLazyQuery } from '@apollo/client';
import './App.css';

// Debug: Log the GraphQL endpoint
console.log('GraphQL Endpoint:', process.env.REACT_APP_GRAPHQL_URL || '/graphql');

// Apollo Client setup
const client = new ApolloClient({
  uri: process.env.REACT_APP_GRAPHQL_URL || '/graphql',
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-first',
    },
  },
  onError: ({ networkError, graphQLErrors }) => {
    if (networkError) {
      console.error('Network error:', networkError);
    }
    if (graphQLErrors) {
      graphQLErrors.forEach(({ message }) => {
        console.error('GraphQL error:', message);
      });
    }
  },
});

// GraphQL Queries
const SEARCH_CITIES = gql`
  query SearchCities($query: String!) {
    searchCities(query: $query) {
      name
      country
      latitude
      longitude
      admin1
    }
  }
`;

const GET_ACTIVITY_RANKINGS = gql`
  query GetActivityRankings($city: String!, $latitude: Float, $longitude: Float) {
    getActivityRankings(city: $city, latitude: $latitude, longitude: $longitude) {
      city {
        name
        country
        latitude
        longitude
      }
      rankings {
        activity
        score
        bestDays {
          date
          score
        }
        reasoning
      }
      forecast {
        date
        temperatureMax
        temperatureMin
        precipitation
        windSpeed
        cloudCover
        snowfall
        waveHeight
        weatherCode
      }
    }
  }
`;

// Weather icons mapping
const weatherIcons = {
  0: '☀️', // Clear
  1: '🌤️', // Mainly clear
  2: '⛅', // Partly cloudy
  3: '☁️', // Overcast
  45: '🌫️', // Foggy
  51: '🌦️', // Light drizzle
  61: '🌧️', // Light rain
  71: '🌨️', // Light snow
  95: '⛈️', // Thunderstorm
};

// Activity icons
const activityIcons = {
  'Skiing': '⛷️',
  'Surfing': '🏄',
  'Outdoor Sightseeing': '🚶',
  'Indoor Sightseeing': '🏛️',
};

// City Search Component
function CitySearch({ onCitySelect }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchCities, { loading }] = useLazyQuery(SEARCH_CITIES);

  const handleSearch = useCallback(async (value) => {
    setQuery(value);
    
    if (value.length > 2) {
      const result = await searchCities({ variables: { query: value } });
      if (result.data) {
        setSuggestions(result.data.searchCities);
        setShowSuggestions(true);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchCities]);

  const handleCitySelect = (city) => {
    setQuery(`${city.name}, ${city.country}`);
    setShowSuggestions(false);
    onCitySelect(city);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      handleCitySelect(suggestions[0]);
    }
  };

  const handleSearchClick = () => {
    if (suggestions.length > 0) {
      handleCitySelect(suggestions[0]);
    }
  };

  return (
    <div className="city-search">
      <div className="search-container">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search for a city..."
          className="search-input"
        />
        <button 
          onClick={handleSearchClick}
          disabled={loading || suggestions.length === 0}
          className="search-button"
        >
          Search
        </button>
      </div>
      {loading && <div className="loading-indicator">Searching...</div>}
      {showSuggestions && suggestions.length > 0 && (
        <ul className="suggestions">
          {suggestions.map((city, index) => (
            <li 
              key={index} 
              onClick={() => handleCitySelect(city)}
              className="suggestion-item"
            >
              <strong>{city.name}</strong>
              {city.admin1 && `, ${city.admin1}`}
              , {city.country}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Activity Card Component
function ActivityCard({ ranking, isTopRanked }) {
  const scorePercentage = Math.round(ranking.score * 100);
  const scoreClass = scorePercentage > 70 ? 'excellent' : scorePercentage > 50 ? 'good' : 'fair';

  return (
    <div className={`activity-card ${isTopRanked ? 'top-ranked' : ''}`}>
      <div className="activity-header">
        <span className="activity-icon">{activityIcons[ranking.activity]}</span>
        <h3>{ranking.activity}</h3>
        {isTopRanked && <span className="badge">Best Choice</span>}
      </div>
      <div className="score-container">
        <div className="score-bar">
          <div 
            className={`score-fill ${scoreClass}`} 
            style={{ width: `${scorePercentage}%` }}
          />
        </div>
        <span className="score-text">{scorePercentage}%</span>
      </div>
      <p className="reasoning">{ranking.reasoning}</p>
      <div className="best-days">
        <strong>Best days:</strong>
        <div className="day-chips">
          {ranking.bestDays.map((day, index) => (
            <span key={index} className="day-chip">
              {new Date(day.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Weather Forecast Component
function WeatherForecast({ forecast }) {
  return (
    <div className="forecast-container">
      <h3>7-Day Weather Forecast</h3>
      <div className="forecast-grid">
        {forecast.map((day, index) => {
          const date = new Date(day.date);
          const weatherIcon = weatherIcons[Math.floor(day.weatherCode / 10) * 10] || weatherIcons[day.weatherCode] || '🌈';
          
          return (
            <div key={index} className="forecast-day">
              <div className="day-name">
                {date.toLocaleDateString('en', { weekday: 'short' })}
              </div>
              <div className="weather-icon">{weatherIcon}</div>
              <div className="temps">
                <span className="temp-high">{Math.round(day.temperatureMax)}°</span>
                <span className="temp-low">{Math.round(day.temperatureMin)}°</span>
              </div>
              <div className="conditions">
                {day.precipitation > 0 && (
                  <span className="condition">💧 {day.precipitation.toFixed(1)}mm</span>
                )}
                {day.snowfall > 0 && (
                  <span className="condition">❄️ {day.snowfall.toFixed(1)}cm</span>
                )}
                <span className="condition">💨 {Math.round(day.windSpeed)}km/h</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Results Component
function Results({ city }) {
  const { loading, error, data } = useQuery(GET_ACTIVITY_RANKINGS, {
    variables: {
      city: city.name,
      latitude: city.latitude,
      longitude: city.longitude,
    },
  });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Analyzing weather conditions...</p>
      </div>
    );
  }

  if (error) {
    console.error('GraphQL Error:', error);
    return (
      <div className="error-container">
        <h3>Unable to load weather data</h3>
        <p>{error.message}</p>
        <p className="error-hint">
          This might happen if:
          <ul>
            <li>The location is not covered by the weather service</li>
            <li>The coordinates are invalid</li>
            <li>There's a temporary service issue</li>
          </ul>
          Try searching for a different city or refresh the page.
        </p>
      </div>
    );
  }

  const { rankings, forecast, city: cityData } = data.getActivityRankings;

  return (
    <div className="results">
      <div className="location-header">
        <h2>{cityData.name}, {cityData.country}</h2>
        <p className="coordinates">
          {cityData.latitude.toFixed(2)}°N, {cityData.longitude.toFixed(2)}°E
        </p>
      </div>

      <div className="rankings-grid">
        {rankings.map((ranking, index) => (
          <ActivityCard 
            key={ranking.activity} 
            ranking={ranking} 
            isTopRanked={index === 0}
          />
        ))}
      </div>

      <WeatherForecast forecast={forecast} />
    </div>
  );
}

// Main App Component
function App() {
  const [selectedCity, setSelectedCity] = useState(null);

  return (
    <ApolloProvider client={client}>
      <div className="app">
        <header className="app-header">
          <h1>🌍 Weather Activity Planner</h1>
          <p>Find the best activities for any city based on weather forecasts</p>
        </header>

        <main className="app-main">
          <CitySearch onCitySelect={setSelectedCity} />
          
          {selectedCity && <Results city={selectedCity} />}
          
          {!selectedCity && (
            <div className="welcome-message">
              <h2>Welcome to Weather Activity Planner!</h2>
              <p>Search for any city to see which activities are best suited for the weather over the next 7 days.</p>
              <div className="activity-examples">
                {Object.entries(activityIcons).map(([activity, icon]) => (
                  <div key={activity} className="activity-example">
                    <span>{icon}</span>
                    <span>{activity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        <footer className="app-footer">
          <p>Weather data provided by Open-Meteo</p>
        </footer>
      </div>
    </ApolloProvider>
  );
}

export default App;