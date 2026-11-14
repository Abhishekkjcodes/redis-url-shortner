from typing import List
from app.cache import rconn 
from fastapi import FastAPI, HTTPException, Response,status,Depends,APIRouter
from sqlalchemy import delete, exists, select, update
from sqlalchemy.orm import Session, joinedload, selectinload
from ..database import get_db
from .. import schemas,models,utils,oauth2
import uuid

router=APIRouter(prefix="/urls",tags=["URLs"])

@router.post("/",response_model=schemas.Urls)
def create_short_url(url:schemas.CreateUrls,db:Session=Depends(get_db),user_id:int=Depends(oauth2.get_current_user)):
    if not url.alias:
        url.alias=uuid.uuid4().hex[:6]
        check_url=db.scalar(select(models.Url).where(models.Url.shortened == url.alias))
        while check_url:
            url.alias=uuid.uuid4().hex[:6]
            check_url=db.scalar(select(models.Url).where(models.Url.shortened == url.alias))

    check_url = db.scalar(select(models.Url).where(models.Url.alias == url.alias))
    if check_url:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Url with alias-{url.alias} already exists! please try a new alias")      
     
    if("https://" not in url.original and "http://" not in url.original):
        url.original="https://"+url.original
    new_url=models.Url(user_id=user_id,shortened=url.alias,**url.model_dump())
    db.add(new_url)
    db.commit()
    db.refresh(new_url)
    resp=schemas.Urls(id=new_url.id,original=new_url.original,shortened=new_url.shortened)
    return resp

@router.get("/",response_model=List[schemas.Urls])
def get_urls(db:Session=Depends(get_db),user_id:int=Depends(oauth2.get_current_user)):
    data=db.scalars(select(models.Url).where(models.Url.user_id==user_id)).all()
    return (data)

@router.put("/{id}",response_model=schemas.Urls)
def update_short_url(id:int,url:schemas.CreateUrls,db:Session=Depends(get_db),user_id:int=Depends(oauth2.get_current_user)):
    update_url=db.get(models.Url,id)
    if not update_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="URL NOT FOUND!")
    if(update_url.user_id!=user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You can not modify this URL.")
    if("https://" not in url.original and "http://" not in url.original):
        url.original="https://"+url.original
    
    old_alias = update_url.alias
    update_url.original = url.original
    if url.alias:
        update_url.alias = url.alias
        update_url.shortened = url.alias
    update_url.expire_at = url.expire_at
    update_url.active = url.active
    update_url.view_once = url.view_once

    db.commit()
    db.refresh(update_url)

    if old_alias != update_url.alias and rconn.exists(f"url:{old_alias}"):
        rconn.delete(f"url:{old_alias}")

    if rconn.exists(f"url:{update_url.alias}"):
        cache_key=f"url:{update_url.alias}"
        cache_data = {
            "original": update_url.original,
            "active": str(update_url.active),
            "view_once": str(update_url.view_once),
            "expire_at": update_url.expire_at.isoformat() if update_url.expire_at else ""
        }
        rconn.hset(cache_key, mapping=cache_data)

    resp=schemas.Urls(id=update_url.id,original=update_url.original,shortened=update_url.shortened)
    return resp

@router.delete("/{id}",status_code=status.HTTP_204_NO_CONTENT)
def delete_url(id:int,db:Session=Depends(get_db),user_id:int=Depends(oauth2.get_current_user)):
    url=db.get(models.Url, id)
    if not url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="URL not found!")
    if url.user_id!=user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You are not authorized!")
    db.delete(url)
    db.commit()
    if rconn.exists(f"url:{url.alias}"):
        rconn.delete(f"url:{url.alias}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/{id}",response_model=schemas.UrlsInfo)
def url_info(id:int,db:Session=Depends(get_db),user_id:int=Depends(oauth2.get_current_user)):
    url = db.scalar(
    select(models.Url)
    .options(joinedload(models.Url.user))
    .where(models.Url.id==id)
    )
    if not url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="URL not found!")
    if url.user_id!=user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You are not authorized!")
    return url

