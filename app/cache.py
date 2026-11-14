from redis import Redis

rconn = Redis(
    host='redis',  
    port=6379,
    password='admin123',  
    decode_responses=True
)