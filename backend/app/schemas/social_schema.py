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


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    bio: str
    avatar_url: str | None = None
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


class CommunityPostCreate(BaseModel):
    caption: str = Field(default="", max_length=2200)
    image_url: str = Field(min_length=1, max_length=1024)
    movie_title: str | None = Field(default=None, max_length=255)
