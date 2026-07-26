# CiniSphere Interview Revision README

CiniSphere is a full-stack movie discovery and social platform. It combines a movie browsing experience, personalized recommendations, mood/survey-based recommendations, watchlists, user profiles, posts, communities, direct/community chat, notifications, and moderation.

The project is split into three main parts:

- `frontend/`: React + TypeScript single-page app.
- `backend/`: FastAPI API server.
- `ml_engine/`: offline and serving code for movie recommendation models.

## One-Line Project Explanation

CiniSphere helps users discover movies through TMDB-style browsing, personalized ML recommendations, and social features where users can post, follow, chat, join communities, and maintain a watchlist.

## Tech Stack

Frontend:

- React 19 for building the UI.
- TypeScript for typed frontend code.
- Vite for fast development and production builds.
- React Router for client-side routing.
- Tailwind CSS for styling.
- Framer Motion for animations.
- Lucide React for icons.

Backend:

- FastAPI for building REST APIs and WebSocket endpoints.
- Uvicorn as the ASGI server.
- Pydantic for request/response validation and settings.
- SQLAlchemy for relational database models and queries.
- PyMongo for MongoDB access.
- Python-Jose for JWT authentication.
- bcrypt/passlib for password hashing.
- Requests for external TMDB API calls.

Machine Learning:

- scikit-learn for TF-IDF vectorization.
- SciPy sparse matrices for memory-efficient similarity search.
- NumPy and Pandas for scoring, feature engineering, and ranking.
- Joblib for saving/loading the trained vectorizer.

Databases:

- MongoDB stores movie catalog data and recommendation-related user preference data.
- PostgreSQL/SQLAlchemy stores social app data such as users, posts, follows, communities, chat messages, notifications, and watchlist items.

Deployment:

- Vercel config exists for frontend/static SPA routing.
- Backend is designed for a service like Render, Railway, Fly, or any Python host.

## High-Level Architecture

```text
User Browser
  |
  | React + Vite SPA
  v
FastAPI Backend
  |
  |-- Movie browsing routes -> TMDB API or MongoDB fallback
  |-- Recommendation routes -> ML engine + MongoDB movie lookup
  |-- Social routes -> PostgreSQL through SQLAlchemy
  |-- Auth routes -> JWT for social module
  |-- Upload routes -> local uploads folder
  |-- Chat routes -> WebSocket + SQL persistence
  |
MongoDB + PostgreSQL
```

## Main Features

Movie discovery:

- Trending movies.
- Popular movies.
- Top-rated movies.
- Upcoming movies.
- Tamil movie discovery.
- Search by title.
- Movie details and credits.
- Mood-based picks.

Recommendation system:

- Text-based recommendations using TF-IDF similarity.
- Hybrid ranking using content similarity, popularity, and freshness.
- Diversity reranking so recommendations do not all come from the same genre.
- Tailor Fit survey recommendations based on user mood, language, genre, and release preference.
- Similar-user/taste matching support for collaborative signals.

Social platform:

- Register/login using JWT.
- Profiles with avatar and bio.
- Follow/unfollow users.
- Create posts with uploaded images.
- Like, comment, save, and delete posts.
- Communities with membership and owners.
- Community posts.
- Direct messages.
- Community chat.
- Notifications.
- Watchlist/watched movie list.
- Blocking and reporting.

## Folder Walkthrough

`frontend/src/App.tsx`

- Defines the main frontend routes.
- Uses lazy loading so pages load only when needed.
- Wraps the app with `AuthProvider` and `AppProvider`.
- Protects internal pages with `ProtectedRoute`.

Important frontend pages:

- `Landing.tsx`: entry page.
- `Home.tsx`: main home/movie rows.
- `Discover.tsx`: movie discovery.
- `MovieDetail.tsx`: detailed movie page.
- `TailorFit.tsx`: personalized survey recommendations.
- `CommunityFeed.tsx`: social feed.
- `Communities.tsx`: community UI.
- `Messages.tsx`: chat/direct messaging.
- `MovieList.tsx`: watchlist/watched list.
- `Profile.tsx`: user profile.

Important frontend services:

- `services/tmdb.ts`: calls movie endpoints under `/api/tmdb`.
- `services/socialApi.ts`: calls auth/social APIs and attaches JWT tokens.
- `services/apiBase.ts`: normalizes backend API base URLs.

`backend/app/main.py`

- Creates the FastAPI app.
- Adds CORS.
- Registers all routers.
- Serves uploaded files from `/uploads`.
- Serves frontend `dist` files when available.
- Initializes SQL tables on startup.
- Seeds default communities if configured.

`backend/app/core/config.py`

- Reads environment variables.
- Configures MongoDB, TMDB, SQLAlchemy/PostgreSQL, JWT, CORS, and frontend URL.

`backend/app/db/mongo.py`

- Connects to MongoDB.
- Provides the `movies` collection.
- Defines indexes for fast movie browsing/search queries.

`backend/app/db/sql.py`

- Creates the SQLAlchemy engine.
- Provides DB sessions using dependency injection.
- Creates relational tables from SQLAlchemy models.

`backend/app/models/social_models.py`

- Defines the relational schema for the social part: users, posts, media, likes, comments, follows, communities, memberships, messages, watchlists, notifications, blocks, and reports.

`ml_engine/`

- Contains offline training/vector-building code and runtime recommendation code.
- `offline_pipeline/vector_pipeline.py` creates TF-IDF artifacts.
- `models/` stores saved model files: `tfidf_vectorizer.pkl`, `movie_matrix.npz`, and `movie_index_mapping.json`.
- `serving/` loads those artifacts and ranks recommendations.

## Why Two Databases Are Used

This is one of the most important interview points.

The project uses MongoDB and PostgreSQL because the data has two different shapes.

MongoDB is used for movie and recommendation data because:

- Movie documents can be large and flexible.
- TMDB/Kaggle movie data may have changing fields like genres, keywords, credits, posters, backdrops, popularity, and metadata.
- MongoDB is convenient for storing imported JSON-like movie documents.
- Recommendation code frequently reads many movie records and metadata.
- It works well for catalog/search/discovery data where the schema can evolve.

PostgreSQL/SQLAlchemy is used for social data because:

- Social data is highly relational.
- Users, posts, likes, comments, follows, communities, messages, and notifications have strong relationships.
- Unique constraints are important, such as one like per user per post.
- Foreign keys and cascading deletes are useful.
- SQL is better for joins, counts, feeds, ownership checks, and consistency.

Good interview answer:

> We used MongoDB for flexible movie catalog and ML recommendation data, because movie metadata comes from TMDB/Kaggle and can vary in structure. We used PostgreSQL for the social module because relationships like users, follows, posts, comments, communities, and notifications need constraints, joins, and transactional consistency.

There is also a `backend/cinisphere.db` file in the repo, but the active configuration defaults to PostgreSQL through `SQLALCHEMY_DATABASE_URI`. That file appears to be a local/legacy SQLite artifact, not the main production database design.

## Authentication Explanation

There are two auth-related paths in the project:

1. Older recommendation auth:

- Route prefix: `/api/auth`.
- Files: `backend/app/api/routes/auth.py`, `backend/app/services/auth_service.py`.
- Uses MongoDB users.
- Supports signup/signin and stores recommendation survey/profile data.

2. Newer social auth:

- Route prefix: `/auth`.
- File: `backend/app/api/routes/social_auth.py`.
- Uses SQLAlchemy/PostgreSQL users.
- Returns JWT access tokens.
- Frontend `AuthContext` currently uses this social auth path.

Interview explanation:

> The project evolved in phases. The recommendation module originally used MongoDB users because preference profiles and user history were stored near the recommendation data. Later, the social module introduced SQL users and JWT auth because social features need relational integrity. The current frontend login/register flow uses the SQL/JWT social auth.

## Recommendation System Flow

Text recommendation endpoint:

```text
Frontend sends user text
  -> POST /api/recommend
  -> recommendation_service.generate_recommendations()
  -> MLService.recommend()
  -> hybrid_ranker.get_hybrid_recommendations()
  -> diversity_reranker.rerank_for_diversity()
  -> fetch movie details from MongoDB
  -> return sorted movie cards to frontend
```

How the hybrid ranker works:

- User text is converted into a TF-IDF vector.
- The system computes similarity between the user vector and all movie vectors.
- It adds popularity and freshness scores.
- Final score:

```text
0.6 * content_similarity + 0.3 * popularity + 0.1 * freshness
```

Why TF-IDF:

- It is simple, explainable, and fast.
- Movie overviews/genres/keywords can be transformed into text vectors.
- User input can be transformed with the same vectorizer.
- Similarity can be calculated efficiently with sparse matrix dot products.

Why sparse matrix:

- Movie text vectors contain many zeros.
- Sparse matrices save memory.
- Dot-product similarity becomes faster and scalable.

Why diversity reranking:

- Pure similarity can return too many similar movies.
- Diversity reranking penalizes repeated genres.
- The result feels broader and less repetitive.

## Tailor Fit Flow

Tailor Fit is survey-based recommendation.

The user provides preferences like:

- mood
- language
- movie type/genre
- release preference
- release period

Backend flow:

```text
Survey input
  -> normalize survey values
  -> load candidate movies from MongoDB
  -> apply language/genre/release/mood filters
  -> calculate survey similarity
  -> add collaborative score from similar users if available
  -> add quality score
  -> diversify results
  -> save recently shown movies
  -> return recommendations
```

This avoids recommending only keyword-matching movies and improves result quality.

## Movie/TMDB Flow

Movie routes are in `backend/app/api/routes/tmdb.py`.

The backend can use TMDB API if `TMDB_API_KEY` exists and `TMDB_USE_MONGO_ONLY` is false. If TMDB is unavailable or disabled, the backend falls back to MongoDB.

Examples:

- `/api/tmdb/trending`
- `/api/tmdb/top-rated`
- `/api/tmdb/upcoming`
- `/api/tmdb/popular`
- `/api/tmdb/search`
- `/api/tmdb/movie/{movie_id}`
- `/api/tmdb/movie/{movie_id}/credits`

Why backend proxies TMDB instead of frontend calling TMDB directly:

- Keeps API key hidden.
- Allows caching/retries.
- Allows MongoDB fallback.
- Normalizes data format for the frontend.
- Lets the backend apply safety/quality filters.

## Social Module Flow

Register/login:

```text
React AuthContext
  -> socialApi.register/login
  -> /auth/register or /auth/login
  -> SQL User table
  -> bcrypt password hashing
  -> JWT token returned
  -> token stored in localStorage
```

Authenticated request:

```text
Frontend reads token from localStorage
  -> sends Authorization: Bearer <token>
  -> FastAPI dependency decodes JWT
  -> loads current user from PostgreSQL
  -> route performs action
```

Social actions:

- Posts are stored in SQL.
- Likes and saved posts use unique constraints to prevent duplicates.
- Comments reference users and posts.
- Follows reference follower/following users.
- Communities use memberships and owner records.
- Chat messages are stored as SQL rows.
- Notifications are created when relevant social actions happen.

## Important Backend Design Choices

CORS:

- Configured in `main.py`.
- Allows local frontend and configured deployed frontend origins.

Environment variables:

- Stored in `.env`.
- Example file: `backend/.env.example`.
- Includes Mongo URI, database name, TMDB API key, SQL database URI, JWT secret, frontend URL, CORS origins.

Lazy ML service:

- `dependencies.ml_service` starts as `None`.
- Recommendation service initializes `MLService` only when recommendations are requested.
- This avoids loading ML artifacts unnecessarily during basic startup.

Caching:

- ML recommendations use `lru_cache` for repeated text queries.
- TMDB responses use an in-memory TTL cache.

Indexes:

- MongoDB indexes are defined for popularity, rating, language, release date, poster filtering, title, and movie IDs.
- SQL models use indexes and unique constraints for common lookup and consistency patterns.

## How To Run Locally

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Environment:

```bash
# backend/.env
MONGO_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
DATABASE_NAME=cinisphere
TMDB_API_KEY=your_tmdb_api_key
SQLALCHEMY_DATABASE_URI=postgresql+psycopg2://USER:PASSWORD@HOST:5432/DATABASE
JWT_SECRET_KEY=replace-with-a-long-random-secret
FRONTEND_BASE_URL=http://localhost:5173
BACKEND_CORS_ORIGINS=http://localhost:5173
```

```bash
# frontend/.env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_SOCIAL_API_BASE_URL=http://localhost:8000
```

## Common Interview Questions And Answers

### What is CiniSphere?

CiniSphere is a movie discovery and social platform. It lets users browse movies, get personalized recommendations, save movies to watchlists, post movie-related content, follow users, join communities, chat, and receive notifications.

### Why did you use FastAPI?

FastAPI is fast, async-friendly, easy to structure with routers, and provides automatic validation through Pydantic. It is also suitable for ML-backed APIs because Python integrates well with scikit-learn, NumPy, Pandas, and SciPy.

### Why did you use React?

React works well for a dynamic SPA with many pages and reusable components. The app needs protected routes, modals, movie cards, feeds, profiles, and chat screens, so component-based UI development is a good fit.

### Why Vite?

Vite gives fast local development, quick hot reload, and simple production builds for React + TypeScript.

### Why MongoDB?

MongoDB stores movie catalog and recommendation data. Movie documents are flexible and can contain variable fields like genres, keywords, credits, posters, metadata, and TMDB data. It is also convenient for importing Kaggle/TMDB datasets.

### Why PostgreSQL?

PostgreSQL stores relational social data. Social features need constraints and relationships: users have posts, posts have comments, users follow users, users join communities, and messages belong to users/communities. SQL makes this cleaner and safer.

### Why not use only one database?

Using one database is possible, but this project benefits from polyglot persistence. MongoDB fits flexible movie catalog documents, while PostgreSQL fits relational social data with constraints and joins.

### How does JWT auth work here?

After login/register, the backend creates a JWT with the user ID as the subject. The frontend stores it in `localStorage` and sends it in the `Authorization` header. Backend dependencies decode the token and load the current user from SQL.

### How are passwords protected?

Passwords are hashed with bcrypt. In social auth, the password is first SHA-256 normalized before bcrypt to avoid bcrypt's 72-byte input limit.

### How does recommendation work?

The system converts user text into a TF-IDF vector, compares it against movie vectors, blends content similarity with popularity and freshness, then reranks for genre diversity. Finally, it fetches movie details from MongoDB and returns them.

### What is TF-IDF?

TF-IDF converts text into numerical vectors based on word importance. Common words get lower weight, while more meaningful words get higher weight. It helps compare user preferences with movie descriptions, genres, and keywords.

### Why use a hybrid recommender?

Pure content similarity may recommend obscure or repetitive movies. The hybrid approach adds popularity and freshness so recommendations are relevant, reasonably known, and not outdated unless the content match is strong.

### Why use diversity reranking?

Without diversity, the top results may all be from the same genre. Diversity reranking penalizes repeated genres so the final list has more variety.

### What is Tailor Fit?

Tailor Fit is a survey-based recommender. It takes mood, language, genre, and release preferences, filters candidates, scores them using survey similarity, quality, and collaborative signals, then returns diversified recommendations.

### What happens if TMDB API fails?

The backend catches failures and falls back to MongoDB data. This keeps the app usable even if TMDB is unavailable, slow, or not configured.

### Why proxy TMDB through backend?

To hide the API key, add retries/cache, apply filters, normalize responses, and support MongoDB fallback.

### How is the frontend protected?

Protected routes are wrapped inside `ProtectedRoute`. If the user is not authenticated, the app prevents access to internal pages.

### How is chat implemented?

The frontend has WebSocket support for community chat. The backend authenticates the user from the token, handles the socket connection, and stores messages in SQL tables.

### What are the main challenges in this project?

Main challenges include combining two databases, keeping movie data and social data separate, designing recommendation ranking, handling external TMDB failures, managing JWT authentication, and keeping frontend API base URLs consistent across local and deployed environments.

### What would you improve next?

Good answers:

- Add Alembic migrations instead of `Base.metadata.create_all`.
- Add automated backend tests for auth, posts, and recommendation endpoints.
- Add Redis for caching TMDB responses and recommendation results.
- Move uploads to cloud storage like S3 or Cloudinary.
- Add refresh tokens and stricter token expiry handling.
- Unify or migrate the older Mongo auth path if it is no longer needed.
- Add better observability with structured logs and metrics.
- Use background jobs for expensive ML/data refresh tasks.

## Interview Talking Points

Use this short explanation when asked to describe the project:

> CiniSphere is a full-stack movie discovery and social platform. The frontend is built with React, TypeScript, Vite, and Tailwind. The backend is FastAPI. MongoDB stores movie catalog and recommendation data because the movie documents are flexible and come from TMDB/Kaggle. PostgreSQL stores the social module because users, posts, likes, comments, follows, communities, messages, and notifications are relational and need constraints. The recommendation engine uses TF-IDF vectors, hybrid ranking with content/popularity/freshness, and diversity reranking. The app also proxies TMDB through the backend so API keys stay safe and MongoDB can be used as a fallback.

## Quick Revision Checklist

Before the interview, revise these:

- Explain the project in 60 seconds.
- Explain why MongoDB and PostgreSQL are both used.
- Explain JWT login flow.
- Explain frontend route protection.
- Explain TF-IDF recommendation flow.
- Explain hybrid ranking formula.
- Explain TMDB fallback to MongoDB.
- Explain one social feature end to end, such as creating a post or liking a post.
- Explain one improvement you would make, such as migrations, tests, Redis cache, or cloud uploads.
