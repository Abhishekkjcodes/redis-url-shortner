from fastapi import FastAPI, HTTPException, Response,status,Depends,APIRouter
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from ..database import get_db
from .. import schemas,models,utils,oauth2

router=APIRouter(prefix="/users",tags=["Users"])

@router.post("/",status_code=status.HTTP_201_CREATED)
def create_user(user:schemas.CreateUser,db:Session=Depends(get_db)):
    check_user = db.scalar(select(models.User).where(models.User.email == user.email))
    if check_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"User with email-{user.email} already exists! please try a new email or login using {user.email}")
    hashed_password = utils.hash(user.password) 
    user.password = hashed_password
    new_user=models.User(**(user.model_dump()))
    db.add(new_user)
    db.commit()
    return f"User was created with with name:{user.name} and has a email:{user.email}"

@router.get("/{id}",response_model=schemas.UserInfo)
def info(id:int,db:Session=Depends(get_db),user_id:int=Depends(oauth2.get_current_user)):
    if(id!=user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You are not allowed to view the account information.")
    user=db.scalars(select(models.User).options(selectinload(models.User.urls)).where(models.User.id==id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="User doesn't EXIST !!")

    active_links = [
    url for url in user.urls
    if url.active
    ]
    deactivated_links = [
        url for url in user.urls
        if not url.active
    ]
    resp=schemas.UserInfo(
        name=user.name,
        email=user.email,
        active_links=active_links,
        deactivated_links=deactivated_links
        )
    return resp
    

