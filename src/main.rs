use axum::{
    Json, Router,
    body::Bytes,
    extract::{
        DefaultBodyLimit, Path, Query, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
    routing::{get, post},
};
use base64::{Engine as _, engine::general_purpose};
use futures::StreamExt;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use shared_memory::ShmemConf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::sync::mpsc;
use tracing::{debug, error, info};

#[repr(C)]
pub struct SharedMemHeader {
    write_counter: AtomicU64,
    read_counter: AtomicU64,
    message_len: usize,
    message_buffer: [u8; 10000000],
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageData {
    /// JPEG-encoded image bytes as base64.
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
    pub x: Option<f64>,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StringData {
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogData {
    pub lines: Vec<String>,
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
    #[serde(default)]
    pub log_data: HashMap<String, LogData>,
}
impl Default for WaggleData {
    fn default() -> Self {
        Self {
            sent_timestamp: 0,
            images: HashMap::new(),
            svg_data: HashMap::new(),
            graph_data: HashMap::new(),
            string_data: HashMap::new(),
            log_data: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
struct WaggleNonImageData {
    pub sent_timestamp: i64,
    pub svg_data: HashMap<String, SvgData>,
    pub graph_data: HashMap<String, Vec<GraphData>>,
    pub string_data: HashMap<String, StringData>,
    #[serde(default)]
    pub log_data: HashMap<String, LogData>,
}

fn parse_shmem_message(buf: &[u8]) -> Result<WaggleData, String> {
    let mut pos = 0;

    let read_u32 = |pos: &mut usize| -> Result<u32, String> {
        if *pos + 4 > buf.len() {
            return Err("unexpected end of buffer reading u32".into());
        }
        let val = u32::from_le_bytes(buf[*pos..*pos + 4].try_into().unwrap());
        *pos += 4;
        Ok(val)
    };

    let read_i32 = |pos: &mut usize| -> Result<i32, String> {
        if *pos + 4 > buf.len() {
            return Err("unexpected end of buffer reading i32".into());
        }
        let val = i32::from_le_bytes(buf[*pos..*pos + 4].try_into().unwrap());
        *pos += 4;
        Ok(val)
    };

    let json_len = read_u32(&mut pos)? as usize;
    if pos + json_len > buf.len() {
        return Err("json section exceeds buffer".into());
    }
    let meta: WaggleNonImageData = serde_json::from_slice(&buf[pos..pos + json_len])
        .map_err(|e| format!("json parse error: {e}"))?;
    pos += json_len;

    // Images section
    let num_images = read_u32(&mut pos)? as usize;
    let mut images = HashMap::with_capacity(num_images);

    for _ in 0..num_images {
        let name_len = read_u32(&mut pos)? as usize;
        if pos + name_len > buf.len() {
            return Err("image name exceeds buffer".into());
        }
        let name = std::str::from_utf8(&buf[pos..pos + name_len])
            .map_err(|e| format!("invalid image name: {e}"))?
            .to_owned();
        pos += name_len;

        let scale = read_i32(&mut pos)?;

        if pos >= buf.len() {
            return Err("unexpected end of buffer reading flip".into());
        }
        let flip = buf[pos] != 0;
        pos += 1;

        let data_len = read_u32(&mut pos)? as usize;
        if pos + data_len > buf.len() {
            return Err("image data exceeds buffer".into());
        }
        // Raw JPEG bytes → base64 for the browser
        let b64 = general_purpose::STANDARD.encode(&buf[pos..pos + data_len]);
        pos += data_len;

        images.insert(name, ImageData { image_data: b64, scale, flip });
    }

    Ok(WaggleData {
        sent_timestamp: meta.sent_timestamp,
        images,
        svg_data: meta.svg_data,
        graph_data: meta.graph_data,
        string_data: meta.string_data,
        log_data: meta.log_data,
    })
}

/// Raw image frame stored as pre-encoded binary WS frame.
#[derive(Debug, Clone)]
struct RawImageFrame {
    /// Pre-encoded binary WS frame: [name_len:u16][name][scale:i32][flip:u8][jpeg_bytes]
    encoded_frame: Vec<u8>,
    /// Monotonic sequence number — incremented on each new image upload.
    seq: u64,
}

type ClientsReady = Arc<Mutex<bool>>;
type Clients = Arc<Mutex<HashMap<uuid::Uuid, mpsc::UnboundedSender<Message>>>>;
type Buffer = Arc<Mutex<Vec<WaggleData>>>;
type ImageBuffer = Arc<Mutex<HashMap<String, RawImageFrame>>>;
type ImageSeq = Arc<AtomicU64>;

type AppState = (Clients, Buffer, ClientsReady, ImageBuffer, ImageSeq);

/// Encode image as a binary WebSocket frame.
/// Format: [name_len:u16][name:utf8][scale:i32 LE][flip:u8][jpeg_bytes]
fn encode_image_frame(name: &str, scale: i32, flip: bool, jpeg_bytes: &[u8]) -> Vec<u8> {
    let name_bytes = name.as_bytes();
    let mut buf = Vec::with_capacity(2 + name_bytes.len() + 4 + 1 + jpeg_bytes.len());
    buf.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
    buf.extend_from_slice(name_bytes);
    buf.extend_from_slice(&scale.to_le_bytes());
    buf.push(if flip { 1 } else { 0 });
    buf.extend_from_slice(jpeg_bytes);
    buf
}

fn insert_image(image_buffer: &ImageBuffer, image_seq: &ImageSeq, name: String, scale: i32, flip: bool, jpeg_bytes: Vec<u8>) {
    let seq = image_seq.fetch_add(1, Ordering::Relaxed) + 1;
    let encoded_frame = encode_image_frame(&name, scale, flip, &jpeg_bytes);
    image_buffer.lock().insert(name, RawImageFrame { encoded_frame, seq });
}

/// WebSocket handler
async fn ws_handler(
    ws: WebSocketUpgrade,
    State((clients, buffer, clients_ready, _, _)): State<AppState>,
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
    State((_clients, buffer, _client_ready, image_buffer, image_seq)): State<AppState>,
    Json(mut data): Json<WaggleData>,
) {
    // Extract images from the JSON payload and store as raw bytes
    if !data.images.is_empty() {
        for (name, img) in data.images.drain() {
            if let Ok(jpeg_bytes) = general_purpose::STANDARD.decode(&img.image_data) {
                insert_image(&image_buffer, &image_seq, name, img.scale, img.flip, jpeg_bytes);
            }
        }
    }
    add_data_to_batch(buffer, data);
}

/// Query params for the binary image upload endpoint.
#[derive(Deserialize)]
struct ImageParams {
    #[serde(default = "default_scale")]
    scale: i32,
    #[serde(default)]
    flip: bool,
}
fn default_scale() -> i32 { 1 }

/// Binary image upload: POST /image/:name with raw JPEG body
async fn image_handler(
    State((_clients, _buffer, _client_ready, image_buffer, image_seq)): State<AppState>,
    Path(name): Path<String>,
    Query(params): Query<ImageParams>,
    body: Bytes,
) {
    insert_image(&image_buffer, &image_seq, name, params.scale, params.flip, body.to_vec());
}

fn add_data_to_batch(buffer: Buffer, data: WaggleData) {
    info!("received batch data");
    {
        let mut buf = buffer.lock();
        buf.push(data);
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
    let image_buffer: ImageBuffer = Arc::new(Mutex::new(HashMap::new()));
    let image_seq: ImageSeq = Arc::new(AtomicU64::new(0));

    let clients_clone: Clients = Arc::clone(&clients);
    let buffer_clone = Arc::clone(&buffer);
    let clients_ready_clone = Arc::clone(&client_ready);
    let image_buffer_clone = Arc::clone(&image_buffer);
    let image_seq_clone = Arc::clone(&image_seq);

    let (shmem_tx, mut shmem_rx) = mpsc::unbounded_channel::<WaggleData>();

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
            let read_seq = header.read_counter.load(Ordering::Acquire);
            loop {
                let write_seq = header.write_counter.load(Ordering::Acquire);
                if write_seq > read_seq {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_micros(100));
            }

            let msg_len = header.message_len;
            let msg_bytes = &header.message_buffer[..msg_len];

            let waggle_data_result = parse_shmem_message(msg_bytes);

            header.read_counter.store(read_seq + 1, Ordering::Release);

            match waggle_data_result {
                Ok(mut waggle_data) => {
                    debug!("Received waggle data (read_seq {})", read_seq + 1);
                    // Extract images from shmem data into the image buffer
                    if !waggle_data.images.is_empty() {
                        for (name, img) in waggle_data.images.drain() {
                            if let Ok(jpeg_bytes) = general_purpose::STANDARD.decode(&img.image_data) {
                                insert_image(&image_buffer_clone, &image_seq_clone, name, img.scale, img.flip, jpeg_bytes);
                            }
                        }
                    }
                    if shmem_tx.send(waggle_data).is_err() {
                        error!("Failed to send waggle data to async runtime");
                        break;
                    }
                },
                Err(e) => {
                    error!("Failed to parse waggle data: {}", e);
                },
            }
        }
    });

    let buffer_shmem = Arc::clone(&buffer);
    tokio::spawn(async move {
        while let Some(waggle_data) = shmem_rx.recv().await {
            add_data_to_batch(Arc::clone(&buffer_shmem), waggle_data);
        }
    });

    let buffer_clone = Arc::clone(&buffer);
    let image_buffer_broadcast = Arc::clone(&image_buffer);
    let image_seq_broadcast = Arc::clone(&image_seq);
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(1000 / 100));
        let mut last_sent_seq: u64 = 0;

        loop {
            interval.tick().await;
            if *clients_ready_clone.lock() {
                // Send non-image data as JSON text
                let to_send = {
                    let mut buf = buffer_clone.lock();
                    let drained: Vec<_> = buf.drain(..).collect();
                    serde_json::to_string(&drained).unwrap_or_else(|_| "{}".into())
                };

                // Only send images if they've changed since last broadcast
                let current_seq = image_seq_broadcast.load(Ordering::Relaxed);
                let image_frames: Option<Vec<Vec<u8>>> = if current_seq > last_sent_seq {
                    last_sent_seq = current_seq;
                    let img_buf = image_buffer_broadcast.lock();
                    Some(img_buf.values().map(|frame| frame.encoded_frame.clone()).collect())
                } else {
                    None
                };

                let mut failed_ids = Vec::new();
                for (id, tx) in clients_clone.lock().iter() {
                    // Send text JSON (non-image data)
                    if tx.send(Message::Text(to_send.clone())).is_err() {
                        failed_ids.push(*id);
                        continue;
                    }
                    // Send each image as a binary frame (only if changed)
                    if let Some(ref frames) = image_frames {
                        for frame_bytes in frames {
                            if tx.send(Message::Binary(frame_bytes.clone())).is_err() {
                                failed_ids.push(*id);
                                break;
                            }
                        }
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
        .route("/image/:name", post(image_handler))
        .route("/ws", get(ws_handler))
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024)) // 50 MB
        .fallback_service(tower_http::services::ServeDir::new("./client/dist"))
        .with_state((clients, buffer_clone, client_ready, image_buffer, image_seq));

    info!("Starting server on :3000");

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();

    axum::serve(listener, app.into_make_service()).await.unwrap();
}
