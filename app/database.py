from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import DeclarativeBase
from .configs import settings

#?sslmode=require&channel_binding=require add for neon
engine = create_engine(f"postgresql+psycopg://{settings.database_username}:{settings.database_password}@{settings.database_hostname}:{settings.database_port}/{settings.database_name}")

class Base(DeclarativeBase):
    pass

SessionLocal=sessionmaker(engine)
def get_db():
    db=SessionLocal()
    try:
        yield db
    finally:
        db.close()