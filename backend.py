# backend.py (VERSÃO DE DIAGNÓSTICO)

import uvicorn
import requests
import json
import traceback # Importante para obter o erro completo
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional

# --- Modelos de Dados ---
class ChatRequest(BaseModel):
    model: str
    prompt: str
    images: Optional[List[str]] = None

class DeleteRequest(BaseModel):
    name: str

# --- Inicialização do App ---
app = FastAPI()
OLLAMA_HOST = "http://localhost:11434"

# --- API Endpoints ---

@app.get("/api/models")
def get_models():
    try:
        response = requests.get(f"{OLLAMA_HOST}/api/tags")
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.post("/api/delete")
def delete_model(request: DeleteRequest):
    try:
        response = requests.delete(f"{OLLAMA_HOST}/api/delete", json={"name": request.name})
        response.raise_for_status()
        return {"status": "success", "message": f"Modelo {request.name} deletado."}
    except requests.RequestException as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.post("/api/chat")
async def chat_with_model(request: ChatRequest):
    print("\n--- [BACKEND] Recebido pedido no endpoint /api/chat ---")
    print(f"--- [BACKEND] Modelo: {request.model}, Prompt: '{request.prompt[:50]}...'")

    try:
        payload = {
            "model": request.model,
            "prompt": request.prompt,
            "stream": True
        }
        if request.images:
            payload["images"] = request.images
            print("--- [BACKEND] Imagens anexadas ao payload.")

        print(">>> [BACKEND] Tentando contato com o servidor Ollama...")
        response = requests.post(f"{OLLAMA_HOST}/api/generate", json=payload, stream=True, timeout=60)
        response.raise_for_status() # Levanta um erro se o status não for 2xx

        print("<<< [BACKEND] Conexão com Ollama bem-sucedida! Iniciando streaming...")
        return StreamingResponse(response.iter_content(chunk_size=8192), media_type="application/x-ndjson")

    except requests.RequestException as e:
        print("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print("!!! [BACKEND] ERRO DE COMUNICAÇÃO COM OLLAMA !!!")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        # Imprime o erro completo e detalhado no terminal
        print(traceback.format_exc())
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n")
        return JSONResponse(
            content={"error": f"Não foi possível conectar ao servidor Ollama: {e}"},
            status_code=503 # Service Unavailable
        )

# --- Servir o Frontend ---
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    print("Servidor de diagnóstico iniciado. Acesse http://127.0.0.1:8000 no seu navegador.")
    uvicorn.run(app, host="0.0.0.0", port=8000)