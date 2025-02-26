use crate::{AppError, RobotData};
use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
};
use futures::{sink::SinkExt, stream::StreamExt};
use parking_lot::Mutex;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{error, info};

const MAX_BUFFER_SIZE: usize = 1000;

// Define the SocketState structure
pub struct SocketState {
    buffer: Mutex<Vec<RobotData>>,
    ready_to_send: Mutex<bool>,
    tx: broadcast::Sender<String>,
}

// Create a static SOCKET_STATE
lazy_static::lazy_static! {
    static ref SOCKET_STATE: Arc<SocketState> = {
        let (tx, _) = broadcast::channel(100);
        Arc::new(SocketState {
            buffer: Mutex::new(Vec::new()),
            ready_to_send: Mutex::new(false),
            tx,
        })
    };
}

// Add the missing ws_handler
pub async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(socket: WebSocket) {
    let state = SOCKET_STATE.clone();
    let mut rx = state.tx.subscribe();

    let (mut sender, mut receiver) = socket.split();

    info!("WebSocket connection established");

    let receive_future = {
        let state_clone = state.clone();
        async move {
            while let Some(Ok(_)) = receiver.next().await {
                let should_broadcast = {
                    let mut ready = state_clone.ready_to_send.lock();
                    if !*ready {
                        *ready = true;
                        true
                    } else {
                        false
                    }
                };
                if should_broadcast {
                    broadcast_message(state_clone.clone()).await;
                }
            }
            info!("WebSocket receive loop ended");
        }
    };

    let send_future = async move {
        while let Ok(msg) = rx.recv().await {
            if let Err(e) = sender.send(Message::Text(msg)).await {
                error!("Failed to send WebSocket message: {:?}", e);
                break;
            }
        }
        info!("WebSocket send loop ended");
    };

    tokio::select! {
        _ = receive_future => info!("Receive future completed first"),
        _ = send_future => info!("Send future completed first"),
    };

    info!("WebSocket connection closed");
}

pub fn add_data_to_buffer(data: RobotData) -> Result<(), AppError> {
    let state = SOCKET_STATE.clone();

    {
        let mut buffer = state.buffer.lock();
        buffer.push(data);

        if buffer.len() > MAX_BUFFER_SIZE {
            buffer.remove(0);
        }
    }

    if *state.ready_to_send.lock() {
        let state_clone = state.clone();
        tokio::spawn(async move {
            if let Err(e) = broadcast_message(state_clone).await {
                error!("Error broadcasting message: {}", e);
            }
        });
    }

    Ok(())
}

async fn broadcast_message(state: Arc<SocketState>) -> Result<(), AppError> {
    let message = {
        let buffer = state.buffer.lock();
        if buffer.is_empty() {
            "[]".to_string()
        } else {
            serde_json::to_string(&*buffer).map_err(|e| AppError::JsonError(e.to_string()))?
        }
    };

    if let Err(e) = state.tx.send(message) {
        error!("Broadcast error: {}", e);
        return Err(AppError::WebSocketError(
            "Failed to broadcast message".into(),
        ));
    }

    {
        let mut buffer = state.buffer.lock();
        buffer.clear();
        *state.ready_to_send.lock() = false;
    }

    Ok(())
}
