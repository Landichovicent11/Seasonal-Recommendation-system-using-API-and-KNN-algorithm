import requests
from sklearn.neighbors import NearestNeighbors
import numpy as np
import datetime

TMDB_API_KEY = "25d658eb1c2550a73b8edd8e5a81fd13"

import datetime

def get_current_season():
    month = datetime.datetime.now().month

    if month == 1:
        return "New Year"
    elif month == 2:
        return "Valentine"
    elif month == 3:
        return "Spring"  # Could also check for Easter if desired
    elif month == 4:
        return "Easter"
    elif month == 5:
        return "Spring"
    elif month in [6, 7]:
        return "Summer"
    elif month == 8:
        return "Back to School"
    elif month == 9:
        return "Fall"
    elif month == 10:
        return "Halloween"
    elif month == 11:
        return "Thanksgiving"
    elif month == 12:
        return "Christmas"
    else:
        return None


def fetch_movie_keywords(movie_id):
    url = f"https://api.themoviedb.org/3/movie/{movie_id}/keywords?api_key={TMDB_API_KEY}"
    response = requests.get(url)
    data = response.json()
    if 'keywords' in data:
        return [kw['id'] for kw in data['keywords']]
    elif 'results' in data:  # Sometimes TMDB returns 'results' instead
        return [kw['id'] for kw in data['results']]
    return []

def fetch_movies_by_keyword(keyword, page=1):
    url = f"https://api.themoviedb.org/3/search/keyword?api_key={TMDB_API_KEY}&query={keyword}"
    response = requests.get(url).json()
    if response['results']:
        keyword_id = response['results'][0]['id']
        movies_url = f"https://api.themoviedb.org/3/discover/movie?api_key={TMDB_API_KEY}&with_keywords={keyword_id}&page={page}"
        movies_resp = requests.get(movies_url).json()
        movies = []
        if 'results' in movies_resp:
            for movie in movies_resp['results']:
                keywords = fetch_movie_keywords(movie['id'])
                movie['keyword_ids'] = keywords
                movies.append(movie)
            return movies
    return []


def fetch_popular_movies(page=1):
    url = f"https://api.themoviedb.org/3/movie/popular?api_key={TMDB_API_KEY}&page={page}"
    response = requests.get(url)
    data = response.json()
    movies = []
    if 'results' in data:
        for movie in data['results']:
            keywords = fetch_movie_keywords(movie['id'])
            movie['keyword_ids'] = keywords
            movies.append(movie)
    else:
        print("Error fetching popular movies:", data.get('status_message', 'No results key found'))
    return movies


def extract_features(movies):
    # Create a simple feature matrix using genres (one-hot encoding)
    all_genres = set()
    for movie in movies:
        for genre in movie['genre_ids']:
            all_genres.add(genre)
    all_genres = sorted(list(all_genres))
    
    feature_matrix = []
    for movie in movies:
        features = [1 if g in movie['genre_ids'] else 0 for g in all_genres]
        feature_matrix.append(features)
    return np.array(feature_matrix), all_genres

def knn_recommend(movies, user_movie_index, n_neighbors=5):
    features, all_genres = extract_features(movies)
    knn = NearestNeighbors(n_neighbors=n_neighbors+1, algorithm='auto').fit(features)
    distances, indices = knn.kneighbors([features[user_movie_index]])
    recommended = []
    for i in indices[0]:
        if i != user_movie_index:
            recommended.append(movies[i])
    return recommended

def main(user_liked_movie_id=None):
    season = get_current_season()
    
    if season:
        print(f"Season detected: {season}. Fetching seasonal movies...")
        movies = fetch_movies_by_keyword(season)
    else:
        print("No season detected. Fetching popular movies...")
        movies = fetch_popular_movies()
    
    if not movies:
        print("No movies found.")
        return []
    
    if user_liked_movie_id is None:
        return movies[:5]  # Return top 5 with keyword_ids
    
    user_index = next((i for i, m in enumerate(movies) if m['id'] == user_liked_movie_id), None)
    
    if user_index is None:
        return movies[:5]
    
    recommendations = knn_recommend(movies, user_index)
    return recommendations

# Replace 'YOUR_TMDB_API_KEY' with your actual TMDB API key before running
if __name__ == "__main__":
    recommended = main(user_liked_movie_id=None)
    for movie in recommended:
        print(movie['title'],movie['id'],movie['keyword_ids'])
