use axum::{
    extract::{ws::{WebSocket, WebSocketUpgrade, Message}, State},
    routing::{get, post},
    response::IntoResponse,
    Json, Router,
};
use futures::{StreamExt, SinkExt};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::{Arc}};
use parking_lot::Mutex;
use tracing::{info, error};
use tokio::fs;
use base64::{engine::general_purpose, Engine as _};
use image::ImageFormat;
use std::io::Cursor;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ImageData {
    image_data: String,
    scale: Option<u32>,
    flip: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SvgData {
    svg_string: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GraphDataSettings {
    clear_data: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GraphDataPoint {
    x: f64,
    y: f64,
    settings: GraphDataSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RobotPosition {
    x: f64,
    y: f64,
    heading: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StringData {
    value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RobotData {
    sent_timestamp: f64,
    images: HashMap<String, ImageData>,
    svg_data: HashMap<String, SvgData>,
    graph_data: HashMap<String, Vec<GraphDataPoint>>,
    string_data: HashMap<String, StringData>,
    robot_position: RobotPosition,
    save_replay: bool,
}

type Clients = Arc<Mutex<HashMap<uuid::Uuid, tokio::sync::mpsc::UnboundedSender<Message>>>>;
type Buffer = Arc<Mutex<Vec<RobotData>>>;

/// WebSocket handler
async fn ws_handler(
    ws: WebSocketUpgrade,
    State((clients, buffer)): State<(Clients, Buffer)>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| ws_connected(socket, clients, buffer))
}

async fn ws_connected(
    mut socket: WebSocket,
    clients: Clients,
    buffer: Buffer,
) {
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Message>();
    let id = uuid::Uuid::new_v4();

    clients.lock().insert(id, tx);

    while let Some(Ok(msg)) = socket.next().await {
        match msg {
            Message::Text(_) | Message::Binary(_) => {
                let buf = buffer.lock();
                if !buf.is_empty() {
                    if let Ok(serialized) = serde_json::to_string(&*buf) {
                        if socket.send(Message::Text(serialized)).await.is_err() {
                            break;
                        }
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }
    clients.lock().remove(&id);
}

/// POST /batch handler
async fn batch_handler(
    State((clients, buffer)): State<(Clients, Buffer)>,
    Json(mut data): Json<RobotData>,
) {
    // Example: resize images before storing
    for (_name, img) in data.images.iter_mut() {
        if let Ok(bin) = general_purpose::STANDARD.decode(&img.image_data) {
            let cursor = Cursor::new(bin);
            if let Ok(decoded) = image::load(cursor, ImageFormat::Png) {
                let resized = decoded.thumbnail(500, 500);
                let mut buf = Vec::new();
                resized.write_to(&mut Cursor::new(&mut buf), ImageFormat::Jpeg).ok();
                img.image_data = general_purpose::STANDARD.encode(&buf);
            }
        }
    }

    // Append to buffer
    {
        let mut buf = buffer.lock();
        buf.push(data.clone());
        if buf.len() > 10 {
            buf.remove(0);
        }
    }

    // Broadcast
    let json = serde_json::to_string(&data).unwrap_or("{}".to_string());
    for tx in clients.lock().values() {
        let _ = tx.send(Message::Text(json.clone()));
    }

    // TODO: replay_manager.write_update(data)
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let clients: Clients = Arc::new(Mutex::new(HashMap::new()));
    let buffer: Buffer = Arc::new(Mutex::new(Vec::new()));

    let app = Router::new()
        .route("/batch", post(batch_handler))
        .route("/ws", get(ws_handler))
        .with_state((clients, buffer));

    info!("Starting server on :3000");
    axum::Server::bind(&"0.0.0.0:3000".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}