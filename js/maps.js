// ===== MAPS / DISTANCE MODULE =====
// Uses OSRM (Open Source Routing Machine) - 100% free, no API key needed

const MapsService = {
    // OSRM demo server (free, no key needed)
    baseUrl: 'https://router.project-osrm.org',

    // Nominatim for geocoding (free, no key needed)
    nominatimUrl: 'https://nominatim.openstreetmap.org',

    async loadApiKey() {
        // No API key needed for OSRM/Nominatim
    },

    // Search for a city and get coordinates
    async geocode(cityName) {
        try {
            const query = encodeURIComponent(cityName + ', Brasil');
            const response = await fetch(`${this.nominatimUrl}/search?q=${query}&format=json&limit=5&countrycodes=br`, {
                headers: { 'Accept-Language': 'pt-BR' }
            });
            const results = await response.json();
            if (results.length === 0) return null;
            return results.map(r => ({
                name: r.display_name,
                lat: parseFloat(r.lat),
                lon: parseFloat(r.lon)
            }));
        } catch (e) {
            console.error('Geocoding error:', e);
            return null;
        }
    },

    // Calculate route distance between two coordinates
    async getRouteDistance(originLat, originLon, destLat, destLon) {
        try {
            const url = `${this.baseUrl}/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=false`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                return {
                    distanceKm: Math.round(route.distance / 1000),
                    durationMin: Math.round(route.duration / 60),
                    durationText: this.formatDuration(route.duration)
                };
            }
            return null;
        } catch (e) {
            console.error('Route error:', e);
            return null;
        }
    },

    // Calculate distance between two city names
    async getDistanceBetweenCities(originCity, destCity) {
        const originResults = await this.geocode(originCity);
        if (!originResults || originResults.length === 0) {
            return { error: `Cidade não encontrada: ${originCity}` };
        }

        const destResults = await this.geocode(destCity);
        if (!destResults || destResults.length === 0) {
            return { error: `Cidade não encontrada: ${destCity}` };
        }

        const origin = originResults[0];
        const dest = destResults[0];

        const route = await this.getRouteDistance(origin.lat, origin.lon, dest.lat, dest.lon);
        if (!route) {
            return { error: 'Não foi possível calcular a rota' };
        }

        return {
            distanceKm: route.distanceKm,
            durationText: route.durationText,
            originName: origin.name,
            destName: dest.name
        };
    },

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${mins}min`;
        return `${mins}min`;
    },

    // Search suggestions for city input
    async searchCities(query) {
        if (!query || query.length < 3) return [];
        try {
            const encoded = encodeURIComponent(query + ', Brasil');
            const response = await fetch(`${this.nominatimUrl}/search?q=${encoded}&format=json&limit=5&countrycodes=br&addressdetails=1`, {
                headers: { 'Accept-Language': 'pt-BR' }
            });
            const results = await response.json();
            return results.map(r => {
                const parts = [];
                if (r.address?.city || r.address?.town || r.address?.village) parts.push(r.address.city || r.address.town || r.address.village);
                if (r.address?.state) parts.push(r.address.state);
                return {
                    label: parts.join(' - ') || r.display_name.split(',').slice(0, 2).join(','),
                    fullName: r.display_name,
                    lat: parseFloat(r.lat),
                    lon: parseFloat(r.lon)
                };
            });
        } catch (e) {
            return [];
        }
    }
};
