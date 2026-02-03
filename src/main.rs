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
use serde::{Deserialize, Serialize};
use shared_memory::ShmemConf;
use std::io::Cursor;
use std::sync::atomic::{AtomicU64, Ordering};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::sync::mpsc;
use tracing::{debug, error, info};

#[repr(C)]
pub struct SharedMemHeader {
    /// Incremented by writer after each write
    write_seq: AtomicU64,
    /// Incremented by reader after each read
    read_seq: AtomicU64,
    message_len: usize,
    message_buffer: [u8; 10000],
}
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
    State((_clients, buffer, _client_ready)): State<(Clients, Buffer, ClientsReady)>,
    Json(data): Json<WaggleData>,
) {
    add_data_to_batch(buffer, data);
}

fn add_data_to_batch(buffer: Buffer, mut data: WaggleData) {
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

    // Channel for shmem thread to send parsed data to async runtime
    let (shmem_tx, mut shmem_rx) = mpsc::unbounded_channel::<WaggleData>();

    // Blocking thread for shared memory (Shmem contains raw pointers, not Send)
    std::thread::spawn(move || {
        let shmem_path = "/tmp/waggle-shared-memory";

        info!("Waiting for writer to create shared memory at '{}'...", shmem_path);

        let shmem = loop {
            match ShmemConf::new().flink(shmem_path).open() {
                Ok(m) => {
                    info!("Successfully opened shared memory.");
                    break m;
                },
                Err(e) => {
                    debug!("Shared memory not ready yet ({:?}), retrying in 500ms...", e);
                    std::thread::sleep(Duration::from_millis(500));
                },
            }
        };

        let header = unsafe { &*(shmem.as_ptr() as *const SharedMemHeader) };
        info!("Shared memory opened, starting backpressure reader loop");

        loop {
            // Wait for new data (write_seq > read_seq)
            let read_seq = header.read_seq.load(Ordering::Acquire);
            loop {
                let write_seq = header.write_seq.load(Ordering::Acquire);
                if write_seq > read_seq {
                    break;
                }
                std::hint::spin_loop();
            }

            // Read the data
            let msg_len = header.message_len;
            let msg_bytes = &header.message_buffer[..msg_len];

            // Parse and process the message
            let received_message = match std::str::from_utf8(msg_bytes) {
                Ok(m) => m,
                Err(e) => {
                    error!("Unable to convert received message to UTF-8: {:?}", e);
                    // Signal read complete even on error to unblock writer
                    header.read_seq.store(read_seq + 1, Ordering::Release);
                    continue;
                },
            };

            let waggle_data_result: Result<WaggleData, _> = serde_json::from_str(received_message);

            // Signal read complete to unblock writer
            header.read_seq.store(read_seq + 1, Ordering::Release);

            if let Ok(waggle_data) = waggle_data_result {
                debug!("Received waggle data (read_seq {})", read_seq + 1);
                if shmem_tx.send(waggle_data).is_err() {
                    error!("Failed to send waggle data to async runtime");
                    break;
                }
            } else {
                error!("Failed to parse waggle data: {:?}", waggle_data_result);
            }
        }
    });

    // Async task to receive from shmem thread and add to buffer
    let buffer_shmem = Arc::clone(&buffer);
    tokio::spawn(async move {
        while let Some(waggle_data) = shmem_rx.recv().await {
            add_data_to_batch(Arc::clone(&buffer_shmem), waggle_data);
        }
    });

    let buffer_clone = Arc::clone(&buffer);
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

    let buffer_clone = Arc::clone(&buffer);
    let app = Router::new()
        .route("/batch", post(batch_handler))
        .route("/ws", get(ws_handler))
        .fallback_service(tower_http::services::ServeDir::new("./client/dist"))
        .with_state((clients, buffer_clone, client_ready));

    info!("Starting server on :3000");

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();

    axum::serve(listener, app.into_make_service()).await.unwrap();
}
