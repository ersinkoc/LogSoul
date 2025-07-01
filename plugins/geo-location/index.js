const geoip = require('geoip-lite');

class GeoLocationPlugin {
  constructor() {
    this.name = 'logsoul-geo-location';
    this.version = '1.0.0';
    this.description = 'Adds geographical location data to IP addresses';
    this.author = 'LogSoul Team';
    this.cache = new Map();
  }

  async onLoad() {
    console.log('🌍 GeoLocation plugin loaded');
    // Initialize any resources
  }

  async onUnload() {
    console.log('🌍 GeoLocation plugin unloaded');
    this.cache.clear();
  }

  async onLogEntry(entry) {
    try {
      // Add geolocation data to log entry
      const geo = this.getGeoLocation(entry.ip);
      if (geo) {
        entry.geo_location = {
          country: geo.country,
          region: geo.region, 
          city: geo.city,
          latitude: geo.ll ? geo.ll[0] : null,
          longitude: geo.ll ? geo.ll[1] : null,
          timezone: geo.timezone
        };
      }
    } catch (error) {
      console.error('GeoLocation plugin error:', error);
    }
  }

  getGeoLocation(ip) {
    // Check cache first
    if (this.cache.has(ip)) {
      return this.cache.get(ip);
    }

    // Skip private IPs
    if (this.isPrivateIP(ip)) {
      return null;
    }

    const geo = geoip.lookup(ip);
    
    // Cache the result
    this.cache.set(ip, geo);
    
    // Limit cache size
    if (this.cache.size > 10000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    return geo;
  }

  isPrivateIP(ip) {
    return (
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      ip.startsWith('172.') ||
      ip === '127.0.0.1' ||
      ip === 'localhost'
    );
  }

  async analyzeTraffic(entries) {
    const countries = new Map();
    const cities = new Map();

    for (const entry of entries) {
      if (entry.geo_location) {
        // Count by country
        const country = entry.geo_location.country;
        if (country) {
          countries.set(country, (countries.get(country) || 0) + 1);
        }

        // Count by city
        const city = `${entry.geo_location.city}, ${entry.geo_location.country}`;
        if (entry.geo_location.city) {
          cities.set(city, (cities.get(city) || 0) + 1);
        }
      }
    }

    return {
      top_countries: Array.from(countries.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      top_cities: Array.from(cities.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      total_geolocated: entries.filter(e => e.geo_location).length
    };
  }

  getRoutes() {
    return [
      {
        method: 'GET',
        path: '/geo-stats',
        handler: async (req, res) => {
          try {
            // This would typically fetch from database
            res.json({
              cache_size: this.cache.size,
              plugin_status: 'active',
              supported_features: ['country', 'city', 'coordinates', 'timezone']
            });
          } catch (error) {
            res.status(500).json({ error: error.message });
          }
        }
      },
      {
        method: 'POST',
        path: '/lookup',
        handler: async (req, res) => {
          try {
            const { ip } = req.body;
            if (!ip) {
              return res.status(400).json({ error: 'IP address required' });
            }

            const geo = this.getGeoLocation(ip);
            res.json({ ip, geo_location: geo });
          } catch (error) {
            res.status(500).json({ error: error.message });
          }
        }
      }
    ];
  }

  getConfig() {
    return {
      cache_size: this.cache.size,
      max_cache_size: 10000,
      enabled: true
    };
  }

  async setConfig(config) {
    // Handle configuration updates
    if (config.clear_cache) {
      this.cache.clear();
      console.log('🌍 GeoLocation cache cleared');
    }
  }
}

module.exports = GeoLocationPlugin;