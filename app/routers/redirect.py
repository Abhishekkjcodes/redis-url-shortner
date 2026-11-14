from datetime import datetime, timezone
from typing import List
from fastapi import FastAPI, HTTPException, Response,status,Depends,APIRouter,BackgroundTasks
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload
from ..database import get_db
from .. import schemas,models,utils,oauth2
from fastapi.responses import RedirectResponse
from app.cache import rconn 
router=APIRouter(tags=["Redirect"])

def sync_url_analytics(alias:str,is_view_once: bool):
    db: Session = next(get_db())
    try:
        url=db.scalars(select(models.Url).where(models.Url.alias==alias)).first()
        if url:
            url.clicks += 1
            if is_view_once:
                url.active = False
                rconn.delete(f"rate:{alias}")
                rconn.delete(f"url:{alias}")
            db.commit()
    finally:
        db.close()

@router.get("/{alias}")
def redirect(alias:str,background_tasks: BackgroundTasks,db:Session=Depends(get_db),):
    rate_key = f"rate:{alias}"
    
    clicks=rconn.incr(rate_key,1)

    if(clicks==1):
        rconn.expire(rate_key,600)
    
    if clicks>10:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded."
        )
    current_time = datetime.now(timezone.utc)
    cached_data = rconn.hgetall(f"url:{alias}")
    if cached_data:
        long_url=cached_data.get("original")
        active=cached_data.get("active").lower()=="true"
        view_once=cached_data.get("view_once").lower()=="true"
        expire_at_str=cached_data.get("expire_at")

        if not active:
            raise HTTPException(status_code=status.HTTP_410_GONE,detail="URL not active!")
        if expire_at_str:
            expire_time=datetime.fromisoformat(expire_at_str)
            if expire_time.tzinfo is None:
                expire_time = expire_time.replace(tzinfo=timezone.utc)
            if(expire_time<current_time):
                rconn.hset(f"url:{alias}", "active", "False")
                raise HTTPException(status_code=status.HTTP_410_GONE,detail="URL not active!")
        background_tasks.add_task(sync_url_analytics, alias=alias, is_view_once=view_once)
        return RedirectResponse(url=long_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    url=db.scalars(select(models.Url).where(models.Url.alias==alias)).first()
    if not url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="URL doesnt exist!")

    if not url.active:
        raise HTTPException(status_code=status.HTTP_410_GONE,detail="URL not active!")
    if url.expire_at and url.expire_at<current_time:
        url.active=False
        db.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE,detail="URL not active!")

    if url.view_once:
        url.active=False
        url.clicks+=1
        db.commit()
        rconn.delete(f"url:{alias}")
        return RedirectResponse(url=url.original, status_code=307)

    cache_key=f"url:{alias}"
    cache_data = {
        "original": url.original,
        "active": str(url.active),
        "view_once": str(url.view_once),
        "expire_at": url.expire_at.isoformat() if url.expire_at else ""
    }
    rconn.hset(cache_key, mapping=cache_data)
    ttl = 600
    if url.expire_at:
        seconds_left = int((url.expire_at - current_time).total_seconds())
        ttl = max(1, min(600, seconds_left))
    rconn.expire(cache_key, ttl)

    url.clicks+=1
    db.commit()

    return RedirectResponse(url=url.original, status_code=307)
