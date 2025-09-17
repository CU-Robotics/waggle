use axum::handler::HandlerWithoutStateExt;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    }, response::IntoResponse,
    routing::{get, post},
    Json,
    Router,
};
use base64::{engine::general_purpose, Engine as _};
use futures::StreamExt;
use image::ImageFormat;
use parking_lot::Mutex;
use rand::{random, Rng};
use reqwest::ClientBuilder;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::ops::{Deref, DerefMut};
use std::thread::sleep;
use std::time::Duration;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::mpsc;
use tower_http::services::ServeDir;
use tracing::{debug, error, info, warn};
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageData {
    /// PNG-encoded image bytes as base64.
    pub image_data: String,
    /// Scale factor applied when rendering on the dashboard (1.0 = native).
    pub scale: i32,
    /// Whether the dashboard should flip horizontally+vertically.
    pub flip: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SvgData {
    pub svg_string: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphData {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StringData {
    pub value: String,
}
impl Into<StringData> for String {
    fn into(self) -> StringData {
        StringData { value: self }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaggleData {
    pub sent_timestamp: i64,
    pub images: HashMap<String, ImageData>,
    pub svg_data: HashMap<String, SvgData>,
    pub graph_data: HashMap<String, Vec<GraphData>>,
    pub string_data: HashMap<String, StringData>,
}
impl Default for WaggleData {
    fn default() -> Self {
        Self {
            sent_timestamp: 0,
            images: HashMap::new(),
            svg_data: HashMap::new(),
            graph_data: HashMap::new(),
            string_data: HashMap::new(),
        }
    }
}

type ClientsReady = Arc<Mutex<bool>>;
type Clients = Arc<Mutex<HashMap<uuid::Uuid, mpsc::UnboundedSender<Message>>>>;
type Buffer = Arc<Mutex<Vec<WaggleData>>>;

/// WebSocket handler
async fn ws_handler(
    ws: WebSocketUpgrade,
    State((clients, buffer, clients_ready)): State<(Clients, Buffer, ClientsReady)>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| ws_connected(socket, clients, buffer, clients_ready))
}

async fn ws_connected(
    mut socket: WebSocket,
    clients: Clients,
    buffer: Buffer,
    clients_ready: ClientsReady,
) {
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let id = uuid::Uuid::new_v4();
    clients.lock().insert(id, tx.clone());
    info!("New client connected");
    {
        let mut ready = clients_ready.lock();
        *ready = true;
    }
    let clients_clone = clients.clone();
    let buffer_clone = buffer.clone();
    loop {
        tokio::select! {
            Some(Ok(msg)) = socket.next() => {
                if matches!(msg, Message::Text(_) | Message::Binary(_)) {
                    *clients_ready.lock() = true;
                } else if matches!(msg, Message::Close(_)) {
                    break;
                }
            }
            Some(msg) = rx.recv() => {
                debug!("Received message: {:?}", msg);
                if socket.send(msg).await.is_err() {
                    break;
                }
            }
            else => { break; }
        }
    }

    error!("Client disconnected");
    clients.lock().remove(&id);
}

async fn batch_handler(
    State((clients, buffer, client_ready)): State<(Clients, Buffer, ClientsReady)>,
    Json(mut data): Json<WaggleData>,
) {
    for (_name, img) in data.images.iter_mut() {
        if let Ok(bin) = general_purpose::STANDARD.decode(&img.image_data) {
            let cursor = Cursor::new(bin);
            if let Ok(decoded) = image::load(cursor, ImageFormat::Png) {
                let resized = decoded.thumbnail(500, 500);
                let mut buf = Vec::new();
                let _ = resized.write_to(&mut Cursor::new(&mut buf), ImageFormat::Jpeg);
                img.image_data = general_purpose::STANDARD.encode(&buf);
            }
        }
    }
    info!("received batch data");
    {
        let mut buf = buffer.lock();
        buf.push(data.clone());
        if buf.len() > 10 {
            buf.remove(0);
        }
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let clients: Clients = Arc::new(Mutex::new(HashMap::new()));
    let buffer: Buffer = Arc::new(Mutex::new(Vec::new()));
    let client_ready: ClientsReady = Arc::new(Mutex::new(false));

    let clients_clone: Clients = Arc::clone(&clients);
    let buffer_clone = Arc::clone(&buffer);
    let clients_ready_clone = Arc::clone(&client_ready);
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(1000 / 100));
        loop {
            interval.tick().await;

            if *clients_ready_clone.lock() {
                let to_send = {
                    let mut buf = buffer_clone.lock();
                    let drained: Vec<_> = buf.drain(..).collect();
                    serde_json::to_string(&drained).unwrap_or_else(|_| "{}".into())
                };

                let mut failed_ids = Vec::new();
                for (id, tx) in clients_clone.lock().iter() {
                    if tx.send(Message::Text(to_send.clone())).is_err() {
                        failed_ids.push(*id);
                    }
                }

                let mut guard = clients_clone.lock();
                for id in failed_ids {
                    guard.remove(&id);
                }
            }
        }
    });
    let app = Router::new()
        .route("/batch", post(batch_handler))
        .route("/ws", get(ws_handler))
        .fallback_service(tower_http::services::ServeDir::new("./client/dist"))
        .with_state((clients, buffer, client_ready));

    info!("Starting server on :3000");

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();

    axum::serve(listener, app.into_make_service()).await.unwrap();
}
