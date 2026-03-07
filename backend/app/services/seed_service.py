from datetime import datetime
import random

import bcrypt
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.social_models import (
    Community,
    CommunityMembership,
    CommunityPost,
    Post,
    PostMedia,
    User,
)

SEED_USERS = [
    ("anime_akira", "Anime essays and scene breakdowns.", "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"),
    ("hiddengem_hana", "Collecting underrated movies from every decade.", "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150"),
    ("indie_iris", "Indie cinema lover.", "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150"),
    ("theory_tariq", "Film language and narrative structures.", "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150"),
    ("cine_neha", "General cinephile. Always watching.", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150"),
    ("otaku_omar", "Anime opening songs and edits.", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"),
    ("arthouse_anu", "Slow cinema, long takes, minimal dialogue.", "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150"),
    ("retro_ria", "80s and 90s underseen classics.", "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150"),
    ("frame_by_faiz", "Cinematography nerd.", "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=150"),
    ("script_sam", "Writing about scripts and dialogue.", "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=150"),
    ("pixel_priya", "Animation + anime + visual style.", "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150"),
    ("festival_farah", "Festival circuit discoveries.", "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=150"),
    ("cine_karan", "Mainstream + classics balance.", "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150"),
    ("mystery_meera", "Thrillers and puzzle films.", "https://images.unsplash.com/photo-1493666438817-866a91353ca9?w=150"),
    ("noir_nikhil", "Neo-noir and crime cinema.", "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=150"),
    ("scene_sonali", "Actor performances and character arcs.", "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=150"),
    ("cine_milo", "Movie clubs and discussions.", "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150"),
    ("visual_vik", "Color palettes in film.", "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?w=150"),
    ("cult_chris", "Cult favorites and midnight movies.", "https://images.unsplash.com/photo-1463453091185-61582044d556?w=150"),
    ("essay_esha", "Long-form reviews and analysis.", "https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?w=150"),
]
SEED_DOMAIN = "seed.example.com"

COMMUNITIES = [
    ("Anime", "Anime films, series, and visual storytelling.", "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=500&auto=format&fit=crop"),
    ("Underrated", "Hidden gems and overlooked masterpieces.", "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=500&auto=format&fit=crop"),
    ("IndieCinema", "Independent films and festival picks.", "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=500&auto=format&fit=crop"),
    ("MovieTheory", "Film analysis, symbolism, and theory.", "https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=500&auto=format&fit=crop"),
    ("CinePhiles", "General movie lovers community.", "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=500&auto=format&fit=crop"),
]

POST_IMAGES = [
    "https://image.tmdb.org/t/p/w780/qJ2tW6WMUDux911r6m7haRef0WH.jpg",  # The Dark Knight
    "https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",  # Interstellar
    "https://image.tmdb.org/t/p/w780/8UlWHLMpgZm9bx6QYh0NFoq67TZ.jpg",  # The Dark Knight Rises
    "https://image.tmdb.org/t/p/w780/w7PJ7fBEYOuaAMKfYa4zmw45v3N.jpg",  # Dune
    "https://image.tmdb.org/t/p/w780/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",  # Parasite
    "https://image.tmdb.org/t/p/w780/6ELJEzQJ3Y45HczvreC3dg0GV5R.jpg",  # Spider-Verse
    "https://image.tmdb.org/t/p/w780/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg",  # Joker
    "https://image.tmdb.org/t/p/w780/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",  # Inception
]


def _hash_seed_password() -> str:
    return bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode("utf-8")


def seed_social_data(db: Session) -> None:
    # Migrate legacy invalid seed emails to a valid domain for EmailStr validation.
    legacy_seed_users = db.query(User).filter(User.email.like("%@seed.local")).all()
    for u in legacy_seed_users:
        local_part = u.email.split("@", 1)[0]
        u.email = f"{local_part}@{SEED_DOMAIN}"
        db.add(u)

    has_seed_users = db.query(func.count(User.id)).filter(User.username.in_([u[0] for u in SEED_USERS])).scalar() or 0

    pw_hash = _hash_seed_password()
    user_rows: list[User] = []
    for idx, (username, bio, avatar) in enumerate(SEED_USERS):
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            user_rows.append(existing)
            continue
        row = User(
            username=username,
            email=f"{username}@{SEED_DOMAIN}",
            password_hash=pw_hash,
            bio=bio,
            avatar_url=avatar,
        )
        db.add(row)
        db.flush()
        user_rows.append(row)

    community_map: dict[str, Community] = {}
    for name, desc, image in COMMUNITIES:
        row = db.query(Community).filter(Community.name == name).first()
        if not row:
            row = Community(name=name, description=desc, image_url=image)
            db.add(row)
            db.flush()
        community_map[name] = row

    groups = {
        "Anime": [0, 5, 10, 16, 19, 2],
        "Underrated": [1, 7, 11, 14, 18, 3],
        "IndieCinema": [2, 6, 11, 15, 19, 8],
        "MovieTheory": [3, 4, 8, 9, 13, 17],
        "CinePhiles": list(range(20)),
    }

    for cname, indices in groups.items():
        community = community_map[cname]
        for i in indices:
            uid = user_rows[i].id
            exists = (
                db.query(CommunityMembership)
                .filter(CommunityMembership.community_id == community.id, CommunityMembership.user_id == uid)
                .first()
            )
            if not exists:
                db.add(CommunityMembership(community_id=community.id, user_id=uid))

    db.flush()

    # Normalize seeded posts to fixed movie-poster images so feed visuals stay relevant.
    seeded_user_ids = [u.id for u in user_rows]
    seeded_posts = (
        db.query(Post)
        .filter(Post.user_id.in_(seeded_user_ids), Post.caption.like("Seed post by @%"))
        .all()
    )
    for idx, post in enumerate(seeded_posts):
        target_image = POST_IMAGES[idx % len(POST_IMAGES)]
        if post.image_url != target_image:
            post.image_url = target_image
            db.add(post)

        media_rows = db.query(PostMedia).filter(PostMedia.post_id == post.id).order_by(PostMedia.position.asc()).all()
        if media_rows:
            first = media_rows[0]
            if first.image_url != target_image:
                first.image_url = target_image
                db.add(first)
            for extra in media_rows[1:]:
                db.delete(extra)
        else:
            db.add(PostMedia(post_id=post.id, image_url=target_image, position=0))

    for i, user in enumerate(user_rows):
        existing_posts = db.query(func.count(Post.id)).filter(Post.user_id == user.id).scalar() or 0
        if existing_posts >= 1:
            continue

        caption = f"Seed post by @{user.username}: sharing today's watch and thoughts."
        image = random.choice(POST_IMAGES)
        post = Post(user_id=user.id, image_url=image, caption=caption)
        db.add(post)
        db.flush()
        db.add(PostMedia(post_id=post.id, image_url=image, position=0))

        # Attach seeded post to 1-2 communities the user belongs to.
        memberships = db.query(CommunityMembership).filter(CommunityMembership.user_id == user.id).all()
        random.shuffle(memberships)
        for m in memberships[:2]:
            exists_link = (
                db.query(CommunityPost)
                .filter(CommunityPost.community_id == m.community_id, CommunityPost.post_id == post.id)
                .first()
            )
            if not exists_link:
                db.add(CommunityPost(community_id=m.community_id, post_id=post.id))

    db.commit()
