from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import hashlib, secrets, os, json
from datetime import datetime

app = FastAPI(title="Forge API", version="1.0.0")

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# ── SIMPLE IN-MEMORY STORE (replace with DB later) ──
users_db: dict = {}
sessions_db: dict = {}
projects_db: dict = {}

# ── MODELS ──
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class ChatMessage(BaseModel):
    message: str
    project_id: Optional[str] = None

# ── HELPERS ──
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token() -> str:
    return secrets.token_hex(32)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    if token not in sessions_db:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    return sessions_db[token]

# ── ROOT ──
@app.get("/")
def root():
    return {"status": "ok", "message": "Forge API is running", "version": "1.0.0"}

# ── AUTH ROUTES ──
@app.post("/auth/register")
def register(body: RegisterRequest):
    if body.email in users_db:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = secrets.token_hex(8)
    users_db[body.email] = {
        "id": user_id,
        "name": body.name,
        "email": body.email,
        "password": hash_password(body.password),
        "created_at": datetime.utcnow().isoformat()
    }
    token = generate_token()
    sessions_db[token] = {"id": user_id, "email": body.email, "name": body.name}
    
    return {
        "token": token,
        "user": {"id": user_id, "name": body.name, "email": body.email}
    }

@app.post("/auth/login")
def login(body: LoginRequest):
    user = users_db.get(body.email)
    if not user or user["password"] != hash_password(body.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = generate_token()
    sessions_db[token] = {"id": user["id"], "email": user["email"], "name": user["name"]}
    
    return {
        "token": token,
        "user": {"id": user["id"], "name": user["name"], "email": user["email"]}
    }

@app.post("/auth/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    sessions_db.pop(token, None)
    return {"message": "Logged out successfully"}

@app.get("/auth/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user

# ── PROJECTS ROUTES ──
@app.get("/api/v1/projects/")
def list_projects(current_user: dict = Depends(get_current_user)):
    user_projects = [
        p for p in projects_db.values()
        if p["owner_id"] == current_user["id"]
    ]
    return {"projects": user_projects, "total": len(user_projects)}

@app.post("/api/v1/projects/")
def create_project(body: ProjectCreate, current_user: dict = Depends(get_current_user)):
    project_id = secrets.token_hex(8)
    project = {
        "id": project_id,
        "name": body.name,
        "description": body.description,
        "owner_id": current_user["id"],
        "created_at": datetime.utcnow().isoformat()
    }
    projects_db[project_id] = project
    return project

@app.get("/api/v1/projects/{project_id}")
def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = projects_db.get(project_id)
    if not project or project["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.delete("/api/v1/projects/{project_id}")
def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = projects_db.get(project_id)
    if not project or project["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Project not found")
    del projects_db[project_id]
    return {"message": "Project deleted"}

# ── CHAT ROUTES ──
chat_history: dict = {}

@app.get("/api/v1/chat/sessions")
def list_sessions(current_user: dict = Depends(get_current_user)):
    user_sessions = [
        s for s in chat_history.values()
        if s["user_id"] == current_user["id"]
    ]
    return {"sessions": user_sessions, "total": len(user_sessions)}

@app.post("/api/v1/chat/sessions")
def create_session(current_user: dict = Depends(get_current_user)):
    session_id = secrets.token_hex(8)
    session = {
        "id": session_id,
        "user_id": current_user["id"],
        "messages": [],
        "created_at": datetime.utcnow().isoformat()
    }
    chat_history[session_id] = session
    return session

@app.post("/api/v1/chat/sessions/{session_id}/messages")
def send_message(
    session_id: str,
    body: ChatMessage,
    current_user: dict = Depends(get_current_user)
):
    session = chat_history.get(session_id)
    if not session or session["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Session not found")
    
    msg = {
        "role": "user",
        "content": body.message,
        "timestamp": datetime.utcnow().isoformat()
    }
    session["messages"].append(msg)
    
    # Placeholder AI response — wire up your LLM here
    reply = {
        "role": "assistant",
        "content": f"Received: {body.message}",
        "timestamp": datetime.utcnow().isoformat()
    }
    session["messages"].append(reply)
    
    return {"message": msg, "reply": reply}

@app.get("/api/v1/chat/sessions/{session_id}")
def get_session(session_id: str, current_user: dict = Depends(get_current_user)):
    session = chat_history.get(session_id)
    if not session or session["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

# ── HEALTH ──
@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}