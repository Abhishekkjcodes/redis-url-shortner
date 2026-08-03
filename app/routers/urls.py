from fastapi import FastAPI, HTTPException, Response,status,Depends,APIRouter

router=APIRouter(prefix="/urls",tags=["URLs"])