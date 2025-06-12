const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// DEBUG TEMPORANEO - Rimuovere dopo
console.log('🔍 DEBUG - Tutte le env variables:');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('TRAKT_CLIENT_ID presente:', !!process.env.TRAKT_CLIENT_ID);
console.log('TMDB_API_KEY presente:', !!process.env.TMDB_API_KEY);
console.log('TRAKT_CLIENT_ID lunghezza:', process.env.TRAKT_CLIENT_ID?.length);
console.log('TMDB_API_KEY lunghezza:', process.env.TMDB_API_KEY?.length);

// Se sono undefined, vediamo cosa c'è
if (!process.env.TRAKT_CLIENT_ID) {
    console.log('⚠️ TRAKT_CLIENT_ID è undefined!');
    console.log('Tutte le env che contengono TRAKT:', Object.keys(process.env).filter(k => k.includes('TRAKT')));
}

app.use(cors());

const manifest = {
    "id": "it.topstreaming.emaschi.complete",
    "version": "2.0.0",
    "name": "Top Streaming Italia - Emanuele Schiano",
    "description": "Tutte le Top 10 delle piattaforme streaming italiane - Liste curate da Emanuele Schiano",

    // LOGO E BACKGROUND
    "logo": "https://i.imgur.com/BwIJNcS.png",
    "background": "https://via.placeholder.com/1920x1080/1a1a1a/FF6B35?text=TOP+STREAMING+ITALIA+-+EMANUELE+SCHIANO",

    "resources": ["catalog", "meta"],
    "types": ["movie", "series"],
    "catalogs": [
        // Netflix
        {"type": "movie", "id": "netflix-movies-it", "name": "🔴 Netflix - Top 10 Italia"},
        {"type": "series", "id": "netflix-series-it", "name": "🔴 Netflix - Top 10 Italia"},

        // Amazon Prime
        {"type": "movie", "id": "amazon-movies-it", "name": "📦 Amazon Prime - Top 10 Italia"},
        {"type": "series", "id": "amazon-series-it", "name": "📦 Amazon Prime - Top 10 Italia"},

        // Disney+
        {"type": "movie", "id": "disney-movies-it", "name": "🏰 Disney+ - Top 10 Italia"},
        {"type": "series", "id": "disney-series-it", "name": "🏰 Disney+ - Top 10 Italia"},

        // Apple TV+
        {"type": "movie", "id": "apple-movies-it", "name": "🍎 Apple TV+ - Top 10 Italia"},
        {"type": "series", "id": "apple-series-it", "name": "🍎 Apple TV+ - Top 10 Italia"},

        // Paramount+
        {"type": "movie", "id": "paramount-movies-it", "name": "⭐ Paramount+ - Top 10 Italia"},
        {"type": "series", "id": "paramount-series-it", "name": "⭐ Paramount+ - Top 10 Italia"},

        // NowTV
        {"type": "movie", "id": "nowtv-movies-it", "name": "📺 NowTV - Top 10 Italia"},
        {"type": "series", "id": "nowtv-series-it", "name": "📺 NowTV - Top 10 Italia    "}
    ],
    "idPrefixes": ["tt", "tmdb:", "trakt:"]
};

// Tutte le liste di Emanuele Schiano
const traktLists = {
    netflix: 'emaschi/lists/netflix-top-10',
    amazon: 'emaschi/lists/amazon-top-10',
    disney: 'emaschi/lists/disney-top-10',
    apple: 'emaschi/lists/apple-top-10',
    paramount: 'emaschi/lists/paramount-top-10',
    nowtv: 'emaschi/lists/nowtv-top-10'
};

const cache = new Map();
const metaCache = new Map();
const CACHE_DURATION = 1000 * 60 * 30; // 30 minuti

// Funzione per ottenere dati TMDb
async function getTMDbDetails(tmdbId, type) {
    try {
        const TMDB_API_KEY = process.env.TMDB_API_KEY;
        if (!TMDB_API_KEY) {
            return null;
        }

        const endpoint = type === 'movie' ? 'movie' : 'tv';
        const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`;

        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error(`❌ Errore TMDb per ${tmdbId}:`, error.message);
        return null;
    }
}

// Funzione per creare un oggetto meta completo
function createMetaObject(content, tmdbData, type, platform = '', rank = 0) {
    let contentId;
    if (content.ids.imdb) {
        contentId = content.ids.imdb.startsWith('tt') ? content.ids.imdb : `tt${content.ids.imdb}`;
    } else if (content.ids.tmdb) {
        contentId = `tmdb:${content.ids.tmdb}`;
    } else {
        contentId = `trakt:${content.ids.trakt}`;
    }

    const platformNames = {
        'netflix': 'Netflix',
        'amazon': 'Amazon Prime Video',
        'disney': 'Disney+',
        'apple': 'Apple TV+',
        'paramount': 'Paramount+',
        'nowtv': 'NowTV'
    };

    const meta = {
        id: contentId,
        type: type,
        name: content.title || content.name,
        description: tmdbData?.overview || content.overview || `Dalla Top 10 ${platformNames[platform] || platform.toUpperCase()} di Emanuele Schiano`,
        year: content.year || (tmdbData && new Date(tmdbData.release_date || tmdbData.first_air_date).getFullYear()) || new Date().getFullYear(),
        imdbRating: tmdbData?.vote_average || content.rating || 0,
        genre: tmdbData?.genres?.map(g => g.name) || content.genres || ['Top 10'],

        releaseInfo: content.year ? content.year.toString() : undefined,
        runtime: tmdbData?.runtime || tmdbData?.episode_run_time?.[0] || undefined,
        country: tmdbData?.production_countries?.map(c => c.iso_3166_1) || undefined,
        language: tmdbData?.original_language || undefined
    };

    // Poster e background
    if (tmdbData && tmdbData.poster_path) {
        meta.poster = `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}`;
    }

    if (tmdbData && tmdbData.backdrop_path) {
        meta.background = `https://image.tmdb.org/t/p/w1280${tmdbData.backdrop_path}`;
    }

    if (rank > 0) {
        meta.description = `#${rank} nella Top 10 ${platformNames[platform] || platform}\n\n${meta.description}`;
    }

    return meta;
}

async function getTraktListData(platform, type) {
    const cacheKey = `${platform}-${type}`;

    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log(`📋 Cache hit per ${platform}-${type}`);
            return cached.data;
        }
    }

    try {
        const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;
        if (!TRAKT_CLIENT_ID) {
            console.log('⚠️ TRAKT_CLIENT_ID non configurata');
            return getMockData(platform, type);
        }

        const listPath = traktLists[platform];
        if (!listPath) {
            console.log(`⚠️ Lista non trovata per ${platform}`);
            return getMockData(platform, type);
        }

        const url = `https://api.trakt.tv/users/${listPath}/items`;
        console.log(`🔍 Chiamando Trakt ${platform.toUpperCase()}: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
                'trakt-api-version': '2',
                'trakt-api-key': TRAKT_CLIENT_ID
            }
        });

        console.log(`📥 ${platform.toUpperCase()} - Risposta ricevuta: ${response.data.length} items totali`);

        // Filtra per tipo
        const allItems = response.data || [];
        const filteredItems = allItems.filter(item => {
            if (type === 'movie') {
                return item.type === 'movie' && item.movie;
            } else if (type === 'series') {
                return item.type === 'show' && item.show;
            }
            return false;
        });

        console.log(`🔍 ${platform.toUpperCase()} - Filtrati ${filteredItems.length} ${type} da ${allItems.length} totali`);

        const items = filteredItems.slice(0, 20);
        const metas = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const content = item.movie || item.show;

            let tmdbData = null;
            if (content.ids && content.ids.tmdb) {
                tmdbData = await getTMDbDetails(content.ids.tmdb, type);
            }

            const meta = createMetaObject(content, tmdbData, type, platform, i + 1);
            metas.push(meta);

            // Salva nella cache dei metadati
            metaCache.set(meta.id, {
                data: meta,
                timestamp: Date.now()
            });

            console.log(`📋 ${platform.toUpperCase()} - Creato meta: ${meta.name} (${meta.id})`);

            if (i < items.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        cache.set(cacheKey, {
            data: metas,
            timestamp: Date.now()
        });

        console.log(`✅ ${platform.toUpperCase()} completato: ${metas.length} ${type}`);
        return metas;

    } catch (error) {
        console.error(`❌ Errore lista ${platform.toUpperCase()}:`, error.message);
        return getMockData(platform, type);
    }
}

function getMockData(platform, type) {
    const platformNames = {
        'netflix': 'Netflix',
        'amazon': 'Amazon Prime',
        'disney': 'Disney+',
        'apple': 'Apple TV+',
        'paramount': 'Paramount+',
        'nowtv': 'NowTV'
    };

    return Array.from({length: 5}, (_, i) => ({
        id: `tt${Math.random().toString().substr(2, 7)}`,
        type: type,
        name: `${type === 'movie' ? 'Film' : 'Serie'} #${i+1} - ${platformNames[platform]} Mock`,
        poster: `https://via.placeholder.com/300x450/FF6B35/FFFFFF?text=${platformNames[platform]}+%23${i+1}`,
        description: `Mock data per ${platformNames[platform]}`,
        year: 2024,
        imdbRating: 8.0,
        genre: ['Mock']
    }));
}

// Funzione per identificare la piattaforma dall'ID del catalog
function getPlatformFromCatalogId(catalogId) {
    if (catalogId.includes('netflix-')) return 'netflix';
    if (catalogId.includes('amazon-')) return 'amazon';
    if (catalogId.includes('disney-')) return 'disney';
    if (catalogId.includes('apple-')) return 'apple';
    if (catalogId.includes('paramount-')) return 'paramount';
    if (catalogId.includes('nowtv-')) return 'nowtv';
    return 'netflix'; // fallback
}

// ENDPOINT CATALOG
app.get('/catalog/:type/:id.json', async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { type, id } = req.params;
    console.log(`📺 Catalog richiesto: ${type}/${id}`);

    const platform = getPlatformFromCatalogId(id);

    try {
        const metas = await getTraktListData(platform, type);
        res.json({ metas });
    } catch (error) {
        console.error('❌ Errore nel catalog:', error);
        res.json({ metas: [] });
    }
});

// ENDPOINT META
app.get('/meta/:type/:id.json', async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { type, id } = req.params;
    console.log(`🎬 Meta richiesto: ${type}/${id}`);

    try {
        // Controlla cache
        if (metaCache.has(id)) {
            const cached = metaCache.get(id);
            if (Date.now() - cached.timestamp < CACHE_DURATION) {
                console.log(`📋 Meta cache hit per ${id}`);
                return res.json({ meta: cached.data });
            }
        }

        // Ricostruzione da TMDb se necessario
        let tmdbId = null;
        if (id.startsWith('tmdb:')) {
            tmdbId = id.replace('tmdb:', '');
        } else if (id.startsWith('tt')) {
            const meta = {
                id: id,
                type: type,
                name: 'Contenuto dal catalogo',
                description: 'Dettagli del contenuto dalla Top 10',
                year: 2024,
                poster: `https://via.placeholder.com/300x450/4CAF50/FFFFFF?text=Loading...`
            };
            return res.json({ meta });
        }

        if (tmdbId) {
            const tmdbData = await getTMDbDetails(tmdbId, type);
            if (tmdbData) {
                const meta = {
                    id: id,
                    type: type,
                    name: tmdbData.title || tmdbData.name,
                    description: tmdbData.overview || 'Nessuna descrizione disponibile',
                    year: new Date(tmdbData.release_date || tmdbData.first_air_date).getFullYear(),
                    imdbRating: tmdbData.vote_average || 0,
                    genre: tmdbData.genres?.map(g => g.name) || [],
                    poster: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : null,
                    background: tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbData.backdrop_path}` : null
                };

                metaCache.set(id, {
                    data: meta,
                    timestamp: Date.now()
                });

                return res.json({ meta });
            }
        }

        res.json({ 
            meta: {
                id: id,
                type: type,
                name: 'Contenuto non trovato',
                description: 'Impossibile recuperare i dettagli'
            }
        });

    } catch (error) {
        console.error('❌ Errore nel meta:', error);
        res.json({ 
            meta: {
                id: id,
                type: type,
                name: 'Errore',
                description: 'Errore nel recupero dei metadati'
            }
        });
    }
});

app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(manifest);
});

// Test endpoint per tutte le piattaforme
app.get('/test-all-platforms', async (req, res) => {
    const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;

    if (!TRAKT_CLIENT_ID) {
        return res.json({ error: 'TRAKT_CLIENT_ID non configurata' });
    }

    const results = {};

    for (const [platform, listPath] of Object.entries(traktLists)) {
        try {
            const url = `https://api.trakt.tv/users/${listPath}/items`;
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'trakt-api-version': '2',
                    'trakt-api-key': TRAKT_CLIENT_ID
                }
            });

            const allItems = response.data || [];
            const movies = allItems.filter(item => item.type === 'movie');
            const shows = allItems.filter(item => item.type === 'show');

            results[platform] = {
                status: 'success',
                total: allItems.length,
                movies: movies.length,
                shows: shows.length,
                first_movie: movies[0]?.movie?.title || 'N/A',
                first_show: shows[0]?.show?.title || 'N/A'
            };
        } catch (error) {
            results[platform] = {
                status: 'error',
                error: error.message
            };
        }
    }

    res.json({
        message: '🎉 Test di tutte le piattaforme completato!',
        platforms: results
    });
});

app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`
        <h1>🎬 Top Streaming Italia - Emanuele Schiano COMPLETO</h1>
        <p><strong>✅ Addon completo con 6 piattaforme!</strong></p>
        <p>🔑 Trakt API: ${process.env.TRAKT_CLIENT_ID ? '✅' : '❌'}</p>
        <p>🔑 TMDb API: ${process.env.TMDB_API_KEY ? '✅' : '❌'}</p>
        <p><a href="/manifest.json">📋 Manifest</a></p>
        <p><a href="/test-all-platforms">🧪 Test Tutte le Piattaforme</a></p>
        <hr>
        <h3>🔗 URL per Stremio:</h3>
        <code>https://${req.get('host')}</code>
        <hr>
        <h3>📊 Piattaforme integrate:</h3>
        <ul>
            <li>🔴 <strong>Netflix</strong> - emaschi/lists/netflix-top-10</li>
            <li>📦 <strong>Amazon Prime</strong> - emaschi/lists/amazon-top-10</li>
            <li>🏰 <strong>Disney+</strong> - emaschi/lists/disney-top-10</li>
            <li>🍎 <strong>Apple TV+</strong> - emaschi/lists/apple-top-10</li>
            <li>⭐ <strong>Paramount+</strong> - emaschi/lists/paramount-top-10</li>
            <li>📺 <strong>NowTV</strong> - emaschi/lists/nowtv-top-10</li>
        </ul>
        <p><strong>Totale: 12 categorie (6 piattaforme × 2 tipi)</strong></p>
        <p>📊 Cache: ${cache.size} cataloghi, ${metaCache.size} metadati</p>
    `);
});

// Aggiungi questo al tuo index.js
app.get('/ping', (req, res) => {
    res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Endpoint per mantenere attivo
setInterval(() => {
    console.log('🏓 Keep-alive ping');
}, 25 * 60 * 1000); // Ogni 25 minuti

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Top Streaming Italia COMPLETO (6 piattaforme) attivo su porta ${PORT}`);
    console.log(`🔑 Trakt API: ${process.env.TRAKT_CLIENT_ID ? 'CONFIGURATA' : 'MANCANTE'}`);
    console.log(`🔑 TMDb API: ${process.env.TMDB_API_KEY ? 'CONFIGURATA' : 'MANCANTE'}`);
});
