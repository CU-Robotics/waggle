use axum::handler::HandlerWithoutStateExt;
use axum::{
    Json, Router,
    extract::{
        State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
    routing::{get, post},
};
use base64::{Engine as _, engine::general_purpose};
use futures::StreamExt;
use image::ImageFormat;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::mpsc;
use tower_http::services::ServeDir;
use tracing::info;
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


#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WaggleData {
    pub sent_timestamp: i64,
    pub images: HashMap<String, ImageData>,
    pub svg_data: HashMap<String, SvgData>,
    pub graph_data: HashMap<String, Vec<GraphData>>,
    pub string_data: HashMap<String, StringData>,
}



type Clients = Arc<Mutex<HashMap<uuid::Uuid, mpsc::UnboundedSender<Message>>>>;
type Buffer = Arc<Mutex<Vec<WaggleData>>>;

/// WebSocket handler
async fn ws_handler(
    ws: WebSocketUpgrade,
    State((clients, buffer)): State<(Clients, Buffer)>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| ws_connected(socket, clients, buffer))
}

async fn ws_connected(mut socket: WebSocket, clients: Clients, buffer: Buffer) {
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let id = uuid::Uuid::new_v4();
    clients.lock().insert(id, tx);

    // Reader loop
    while let Some(Ok(msg)) = socket.next().await {
        if matches!(msg, Message::Text(_) | Message::Binary(_)) {
            // Lock, copy, unlock BEFORE await
            let serialized = {
                let buf = buffer.lock();
                serde_json::to_string(&*buf).unwrap_or("[]".to_string())
            };

            if socket.send(Message::Text(serialized)).await.is_err() {
                break;
            }
        } else if matches!(msg, Message::Close(_)) {
            break;
        }
    }

    clients.lock().remove(&id);
}

/// POST /batch handler
async fn batch_handler(
    State((clients, buffer)): State<(Clients, Buffer)>,
    Json(mut data): Json<WaggleData>,
) {
    // Example: resize images before storing
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

    {
        let mut buf = buffer.lock();
        buf.push(data.clone());
        if buf.len() > 10 {
            buf.remove(0);
        }
    }

    let json = serde_json::to_string(&data).unwrap_or("{}".into());
    for tx in clients.lock().values() {
        let _ = tx.send(Message::Text(json.clone()));
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let clients: Clients = Arc::new(Mutex::new(HashMap::new()));
    let buffer: Buffer = Arc::new(Mutex::new(Vec::new()));

    let app = Router::new()
        .route("/batch", post(batch_handler))
        .route("/ws", get(ws_handler))
        .fallback_service(tower_http::services::ServeDir::new("./client/dist"))
        .with_state((clients, buffer));

    info!("Starting server on :3000");

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();

    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}
