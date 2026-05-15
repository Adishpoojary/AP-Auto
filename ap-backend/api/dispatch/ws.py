from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict
from utils.auth import verify_ws_token

router = APIRouter(prefix="/dispatch", tags=["Dispatch", "WebSockets"])

class ConnectionManager:
    def __init__(self):
        # Maps driver_id to WebSocket connection
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, driver_id: int):
        await websocket.accept()
        self.active_connections[driver_id] = websocket
        print(f"🔗 [Dispatch] Driver {driver_id} connected to WebSocket.")

    def disconnect(self, driver_id: int):
        if driver_id in self.active_connections:
            del self.active_connections[driver_id]
            print(f"❌ [Dispatch] Driver {driver_id} disconnected.")

    async def send_personal_message(self, message: dict, driver_id: int):
        if driver_id in self.active_connections:
            ws = self.active_connections[driver_id]
            try:
                await ws.send_json(message)
                print(f"📬 [Dispatch] Sent message to driver {driver_id}: {message.get('type')}")
                return True
            except Exception as e:
                print(f"⚠️ [Dispatch] Failed to send to driver {driver_id}: {e}")
                self.disconnect(driver_id)
        return False

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """
    WebSocket for driver apps to listen for incoming ride requests.
    Connection requires valid JWT token as a query parameter.
    """
    try:
        user_data = verify_ws_token(token)
        if not user_data or user_data.get("role") != "driver":
            await websocket.close(code=1008, reason="Only valid drivers can connect to dispatch")
            return
            
        # Map user_id to active connections
        user_id = user_data["user_id"]
        
        await manager.connect(websocket, user_id)
        
        try:
            while True:
                # Keep connection alive, listen for heartbeat if needed
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
        except WebSocketDisconnect:
            manager.disconnect(user_id)
            
    except Exception as e:
        print(f"WebSocket Connect Error: {e}")
        await websocket.close(code=1008, reason="Authentication failed")
