from fastapi import FastAPI
from .routers import auth,users,urls
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
origins=["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(router=urls.router)
app.include_router(router=users.router)
app.include_router(router=auth.router)

@app.get("/")
def root():
    return {"message": "Hello This is a URL shortner" }