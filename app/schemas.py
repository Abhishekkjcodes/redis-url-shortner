from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict, EmailStr

class User(BaseModel):
    name: str
    age: int

class CreateUser(User):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str
class UserInfo(BaseModel):
    name:str
    email:EmailStr
    active_links: ListUrls
    deactivated_links: ListUrls
    model_config = ConfigDict(from_attributes=True)
class Urls(BaseModel):
    original_url: str
    alias: str
class UrlsInfo(Urls):

    clicks: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
class UrlsCreate(Urls):
    expire_time:datetime
    view_once: bool=False
class ListUrls(BaseModel):
    urls_list: List[Urls]
    model_config = ConfigDict(from_attributes=True)
