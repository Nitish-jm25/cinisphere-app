import sys
from pathlib import Path

from sqlalchemy import delete

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))

from app.db.sql import SessionLocal
from app.models.social_models import CommunityMembership, Follow, Post, User


def main() -> None:
    db = SessionLocal()
    try:
        seed_users = db.query(User).filter(User.email.like("%@seed.example.com")).all()
        seed_user_ids = [u.id for u in seed_users]

        if seed_user_ids:
            db.execute(delete(Follow).where(Follow.follower_id.in_(seed_user_ids)))
            db.execute(delete(Follow).where(Follow.following_id.in_(seed_user_ids)))
            db.execute(delete(CommunityMembership).where(CommunityMembership.user_id.in_(seed_user_ids)))
            db.execute(delete(Post).where(Post.user_id.in_(seed_user_ids)))
            db.execute(delete(User).where(User.id.in_(seed_user_ids)))

        db.commit()
        print(f"Removed seed users: {len(seed_user_ids)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
