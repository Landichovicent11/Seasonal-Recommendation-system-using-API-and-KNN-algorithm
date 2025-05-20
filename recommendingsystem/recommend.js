console.log("Starting movie recommendation system...");
const axios = require("axios");
const KNN = require("ml-knn");

const TMDB_API_KEY = "25d658eb1c2550a73b8edd8e5a81fd13";

// --- Get Current Season ---
function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    if (month === 1) return "New Year";
    if (month === 2) return "Valentine";
    if (month === 3 || month === 5) return "Spring";
    if (month === 4) return "Easter";
    if (month === 6 || month === 7) return "Summer";
    if (month === 8) return "Back to School";
    if (month === 9) return "Fall";
    if (month === 10) return "Halloween";
    if (month === 11) return "Thanksgiving";
    if (month === 12) return "Christmas";
    return null;
}
// --- Fetch Movie Keywords ---
async function fetchMovieKeywords(movieId) {
    const url = `https://api.themoviedb.org/3/movie/${movieId}/keywords?api_key=${TMDB_API_KEY}`;
    const { data } = await axios.get(url);
    if (data.keywords) return data.keywords.map(k => k.id);
    if (data.results) return data.results.map(k => k.id);
    return [];
}

// --- Fetch Movies by Keyword ---
async function fetchMoviesByKeyword(keyword) {
    const keywordSearchUrl = `https://api.themoviedb.org/3/search/keyword?api_key=${TMDB_API_KEY}&query=${keyword}`;
    const { data } = await axios.get(keywordSearchUrl);

    if (data.results && data.results.length > 0) {
        const keywordId = data.results[0].id;
        const discoverUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_keywords=${keywordId}`;
        const { data: movieData } = await axios.get(discoverUrl);
        const movies = [];

        for (let movie of movieData.results) {
            movie.keyword_ids = await fetchMovieKeywords(movie.id);
            movies.push(movie);
        }
        return movies;
    }
    return [];
}

// --- Fetch Popular Movies ---
async function fetchPopularMovies() {
    const url = `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}`;
    const { data } = await axios.get(url);
    const movies = [];

    for (let movie of data.results) {
        movie.keyword_ids = await fetchMovieKeywords(movie.id);
        movies.push(movie);
    }
    console.log("Popular movies fetched:", data.results.length);

    return movies;
}

// --- Extract One-Hot Genre Features ---
function extractFeatures(movies) {
    const genreSet = new Set();
    movies.forEach(m => m.genre_ids.forEach(g => genreSet.add(g)));
    const allGenres = Array.from(genreSet).sort();

    const features = movies.map(movie =>
        allGenres.map(genreId => (movie.genre_ids.includes(genreId) ? 1 : 0))
    );

    return { features, allGenres };
}

// --- Recommend Using KNN ---
function knnRecommend(movies, userMovieIndex, features, k = 5) {
    const labels = Array.from({ length: movies.length }, (_, i) => i);
    const knn = new KNN(features, labels, { k: k + 1 });

    const result = knn.predict([features[userMovieIndex]]);
    const distances = knn.k; // the KNN instance stores neighbors internally

    console.log(`Generating recommendations...`);

    const recommendations = [];
    for (let i = 0; i < features.length; i++) {
        if (i !== userMovieIndex && result.includes(i)) {
            recommendations.push(movies[i]);
        }
    }

    return recommendations;
}

// --- Main Entry ---
async function main(userLikedMovieId = null) {
    const season = getCurrentSeason();
    console.log("Detected Season:", season);

    const movies = season
        ? await fetchMoviesByKeyword(season)
        : await fetchPopularMovies();

    if (!movies || movies.length === 0) {
        console.log("No movies found.");
        return;
    }

    const { features } = extractFeatures(movies);

    let userIndex = null;
    if (userLikedMovieId) {
        userIndex = movies.findIndex(m => m.id === userLikedMovieId);
        if (userIndex === -1) userIndex = null;
    }

    const recommendations =
        userIndex !== null
            ? knnRecommend(movies, userIndex, features)
            : movies.slice(0, 15);

    recommendations.forEach(movie => {
        console.log(`${movie.title} (ID: ${movie.id}) [Keywords: ${movie.keyword_ids.join(", ")}]`);
    });
}
main();

