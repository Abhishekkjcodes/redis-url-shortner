from datetime import timedelta

from fastapi import APIRouter,HTTPException,Response,status,Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database import get_db
from .. import schemas,models,utils,oauth2
from fastapi.security import OAuth2PasswordRequestForm


router=APIRouter( tags=["login"])


@router.post("/login",response_model=schemas.Token)
def login(user_credentials:OAuth2PasswordRequestForm=Depends(),db:Session=Depends(get_db)):
    user=db.scalars(select(models.User).where(models.User.email==user_credentials.username)).first()
    if(not user):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="Invalid credentials")
    allowed=utils.verify(user_credentials.password,user.password)
    if(not allowed):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="Invalid credentials")
    
    access_token_expires = timedelta(minutes=oauth2.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token=oauth2.create_access_token(data={"user_id":user.id},expires_delta=access_token_expires)
    return {"access_token":access_token,"token_type":"bearer"}