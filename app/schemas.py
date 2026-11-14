from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict, EmailStr

class User(BaseModel):
    name: str

class CreateUser(User):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str
class UserInfo(BaseModel):
    name:str
    email:EmailStr
    active_links: List[Urls]
    deactivated_links: List[Urls]
    model_config = ConfigDict(from_attributes=True)

class Urls(BaseModel):
    id:int
    original: str
    shortened: str
    model_config = ConfigDict(from_attributes=True)
class UrlsInfo(Urls):
    alias:str
    clicks: int
    created_at: datetime
    active: bool
    view_once: bool
    expire_at: datetime | None
    user: User
    model_config = ConfigDict(from_attributes=True)

class CreateUrls(BaseModel):
    original: str
    alias: str | None=None
    expire_at:datetime | None =None
    active: bool=True
    view_once: bool=False
class ListUrls(BaseModel):
    urls_list: List[Urls]
    model_config = ConfigDict(from_attributes=True)

class login(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type:str

class TokenData(BaseModel):
    id: int

