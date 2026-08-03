from datetime import datetime

from .database import Base
from sqlalchemy import TIMESTAMP, ForeignKey, Integer, String, text,CheckConstraint
from sqlalchemy.orm import Mapped, relationship,mapped_column
class Url(Base):
    __tablename__="urls"

    id:Mapped[int]=mapped_column(Integer,primary_key=True)
    original:Mapped[str]=mapped_column(String,nullable=False)
    shortened:Mapped[str]=mapped_column(nullable=False,unique=True,index=True)
    active:Mapped[bool]=mapped_column(server_default=text('true'))
    created_at:Mapped[datetime]=mapped_column(TIMESTAMP(timezone=True),nullable=False,server_default=text('now()'))
    view_once:Mapped[bool]=mapped_column(server_default=text('false'))
    expire_at:Mapped[datetime|None]=mapped_column(TIMESTAMP(timezone=True),nullable=True,server_default=text('now()'))
    user_id:Mapped[int]=mapped_column(Integer,ForeignKey("users.id",ondelete="CASCADE"),nullable=False)

    user_info=relationship("User")

class User(Base):
    __tablename__="users"

    id:Mapped[int]=mapped_column(primary_key=True)
    email:Mapped[str]=mapped_column(nullable=False,unique=True)
    password:Mapped[str]=mapped_column(nullable=False)




