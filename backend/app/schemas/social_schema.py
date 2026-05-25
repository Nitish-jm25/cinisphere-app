from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    email: EmailStr


class EmailVerificationRequest(BaseModel):
    email: EmailStr


class EmailVerificationConfirmRequest(BaseModel):
    token: str = Field(min_length=10, max_length=255)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    token: str = Field(min_length=10, max_length=255)
    new_password: str = Field(min_length=8, max_length=128)


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    bio: str
    avatar_url: str | None = None
    is_email_verified: bool = False
    created_at: datetime


class UserProfileResponse(BaseModel):
    user: UserPublic
    followers_count: int
    following_count: int
    is_following: bool = False


class UpdateProfileRequest(BaseModel):
    bio: str | None = Field(default=None, max_length=500)
    avatar_url: str | None = Field(default=None, max_length=1024)


class PostCreateRequest(BaseModel):
    image_url: str = Field(min_length=1, max_length=1024)
    caption: str = Field(default="", max_length=2200)
    movie_title: str | None = Field(default=None, max_length=255)


class PostUpdateRequest(BaseModel):
    caption: str = Field(min_length=1, max_length=2200)


class PostAuthor(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None


class PostResponse(BaseModel):
    id: int
    user_id: int
    image_url: str
    caption: str
    created_at: datetime
    likes_count: int
    comments_count: int
    is_liked: bool
    is_saved: bool = False
    author: PostAuthor
    image_urls: list[str] = []


class CommentCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class CommentResponse(BaseModel):
    id: int
    post_id: int
    user_id: int
    content: str
    created_at: datetime
    author: PostAuthor


class PostCommentItem(BaseModel):
    id: int
    content: str
    created_at: datetime
    author: PostAuthor


class FollowActionResponse(BaseModel):
    success: bool
    message: str


class SearchUsersResponse(BaseModel):
    users: list[UserPublic]


class CommunitySummary(BaseModel):
    id: int
    name: str
    description: str
    image_url: str | None = None
    member_count: int
    joined: bool
    can_manage: bool = False


class CommunityCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=1000)
    image_url: str | None = Field(default=None, max_length=1024)


class CommunityUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=1000)
    image_url: str | None = Field(default=None, max_length=1024)


class CommunityListResponse(BaseModel):
    communities: list[CommunitySummary]


class CommunityMemberItem(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None
    bio: str


class CommunityMembersResponse(BaseModel):
    members: list[CommunityMemberItem]


class CommunityMessageCreate(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class CommunityMessageItem(BaseModel):
    id: int
    community_id: int
    created_at: datetime
    username: str
    avatar_url: str | None = None
    message: str


class DirectMessageCreate(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class DirectMessageItem(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    created_at: datetime
    read_at: datetime | None = None
    message: str


class DirectConversationItem(BaseModel):
    user: PostAuthor
    last_message: DirectMessageItem
    unread_count: int = 0


class CommunityPostCreate(BaseModel):
    caption: str = Field(default="", max_length=2200)
    image_url: str = Field(min_length=1, max_length=1024)
    movie_title: str | None = Field(default=None, max_length=255)


class MovieListItemCreate(BaseModel):
    movie_id: int
    title: str = Field(min_length=1, max_length=255)
    poster_path: str | None = Field(default=None, max_length=1024)
    release_date: str | None = Field(default=None, max_length=32)
    status: str = Field(default="watchlist", pattern="^(watchlist|watched)$")
    rating: float | None = Field(default=None, ge=0, le=5)
    notes: str = Field(default="", max_length=2000)


class MovieListItemUpdate(BaseModel):
    status: str | None = Field(default=None, pattern="^(watchlist|watched)$")
    rating: float | None = Field(default=None, ge=0, le=5)
    notes: str | None = Field(default=None, max_length=2000)


class MovieListItemResponse(BaseModel):
    id: int
    movie_id: int
    title: str
    poster_path: str | None = None
    release_date: str | None = None
    status: str
    rating: float | None = None
    notes: str
    created_at: datetime
    updated_at: datetime


class NotificationItem(BaseModel):
    id: int
    type: str
    actor_id: int | None = None
    actor_username: str | None = None
    actor_avatar_url: str | None = None
    resource_id: int | None = None
    message: str
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: list[NotificationItem]
    unread_count: int


class NotificationReadRequest(BaseModel):
    ids: list[int] = Field(default_factory=list)


class BlockUserRequest(BaseModel):
    user_id: int


class ModerationReportRequest(BaseModel):
    target_user_id: int | None = None
    target_post_id: int | None = None
    reason: str = Field(min_length=3, max_length=120)
    details: str = Field(default="", max_length=2000)
