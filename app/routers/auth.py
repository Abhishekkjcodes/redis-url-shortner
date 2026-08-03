from fastapi import FastAPI, HTTPException, Response,status,Depends,APIRouter

router=APIRouter(prefix="/login",tags=["Log In"])

