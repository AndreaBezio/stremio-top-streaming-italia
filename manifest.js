const manifest = {
  id: "it.topstreaming.comprehensive",
  version: "1.0.0",
  name: "Top Streaming Italia",
  description: "Contenuti più popolari su tutte le piattaforme italiane",
  resources: ["catalog"],
  types: ["movie", "series"],
  catalogs: [
      { type: "movie", id: "netflix-movies-it", name: "🔴 Netflix - Film Popolari" },
      { type: "series", id: "netflix-series-it", name: "🔴 Netflix - Serie Popolari" },
      { type: "movie", id: "prime-movies-it", name: "📦 Prime Video - Film Popolari" },
      { type: "series", id: "prime-series-it", name: "📦 Prime Video - Serie Popolari" },
      { type: "movie", id: "disney-movies-it", name: "🏰 Disney+ - Film Popolari" },
      { type: "series", id: "disney-series-it", name: "🏰 Disney+ - Serie Popolari" },
      { type: "movie", id: "hbo-movies-it", name: "🎭 HBO Max - Film Popolari" },
      { type: "series", id: "hbo-series-it", name: "🎭 HBO Max - Serie Popolari" },
      { type: "movie", id: "appletv-movies-it", name: "🍎 Apple TV+ - Film Popolari" },
      { type: "series", id: "appletv-series-it", name: "🍎 Apple TV+ - Serie Popolari" }
  ]
};

module.exports = { manifest };