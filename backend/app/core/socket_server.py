import socketio
import os

# We use the AsyncRedisManager so that Celery worker processes 
# can emit WebSocket messages to the FastAPI server process via Redis.
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

mgr = socketio.AsyncRedisManager(redis_url)
sio = socketio.AsyncServer(
    async_mode='asgi',
    client_manager=mgr,
    cors_allowed_origins='*' # Standard for development
)

# This is the ASGI app that FastAPI will mount
socket_app = socketio.ASGIApp(sio)

@sio.event
async def connect(sid, environ):
    print(f"[Socket.IO] Client connected: {sid}")
    await sio.emit("system_status", {"message": "Connected to SpillSense C2 API"}, to=sid)

@sio.event
async def disconnect(sid):
    print(f"[Socket.IO] Client disconnected: {sid}")
