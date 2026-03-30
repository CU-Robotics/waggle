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
use parking_lot::Mutex;
use shared_memory::ShmemConf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::sync::mpsc;
use tracing::{debug, error, info};
use waggle::replay::ReplayManager;
use waggle::waggle_data::{ImageData, WaggleData, WaggleNonImageData};

#[repr(C)]
pub struct SharedMemHeader {
    write_counter: AtomicU64,
    read_counter: AtomicU64,
    message_len: usize,
    message_buffer: [u8; 10000000],
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

struct WaggleServer {
    clients: Mutex<HashMap<uuid::Uuid, mpsc::UnboundedSender<Message>>>,
    buffer: Mutex<Vec<WaggleData>>,
    clients_ready: Mutex<bool>,
    replay_manager: Mutex<ReplayManager>,
}

impl WaggleServer {
    fn new() -> Self {
        Self {
            clients: Mutex::new(HashMap::new()),
            buffer: Mutex::new(Vec::new()),
            clients_ready: Mutex::new(false),
            replay_manager: Mutex::new(ReplayManager::default()),
        }
    }

    fn add_data_to_batch(&self, data: WaggleData) {
        info!("received batch data");
        if let Err(e) = self.replay_manager.lock().write_to_file(&data) {
            error!("Failed to write replay: {}", e);
        }
        let mut buf = self.buffer.lock();
        buf.push(data);
        if buf.len() > 10 {
            buf.remove(0);
        }
    }
}

type ServerState = Arc<WaggleServer>;

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(server): State<ServerState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| ws_connected(socket, server))
}

async fn ws_connected(
    mut socket: WebSocket,
    server: ServerState,
) {
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let id = uuid::Uuid::new_v4();
    server.clients.lock().insert(id, tx.clone());
    info!("New client connected");
    {
        let mut ready = server.clients_ready.lock();
        *ready = true;
    }
    loop {
        tokio::select! {
            Some(Ok(msg)) = socket.next() => {
                if matches!(msg, Message::Text(_) | Message::Binary(_)) {
                    *server.clients_ready.lock() = true;
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
    server.clients.lock().remove(&id);
}

async fn batch_handler(
    State(server): State<ServerState>,
    Json(data): Json<WaggleData>,
) {
    server.add_data_to_batch(data);
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let server: ServerState = Arc::new(WaggleServer::new());
    info!("Initialized server with replay manager");

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
                Ok(waggle_data) => {
                    debug!("Received waggle data (read_seq {})", read_seq + 1);
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

    let server_shmem = Arc::clone(&server);
    tokio::spawn(async move {
        while let Some(waggle_data) = shmem_rx.recv().await {
            server_shmem.add_data_to_batch(waggle_data);
        }
    });

    let server_broadcast = Arc::clone(&server);
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(1000 / 100));

        loop {
            interval.tick().await;
            if *server_broadcast.clients_ready.lock() {
                let to_send = {
                    let mut buf = server_broadcast.buffer.lock();
                    let drained: Vec<_> = buf.drain(..).collect();
                    serde_json::to_string(&drained).unwrap_or_else(|_| "{}".into())
                };

                let mut failed_ids = Vec::new();
                for (id, tx) in server_broadcast.clients.lock().iter() {
                    if tx.send(Message::Text(to_send.clone())).is_err() {
                        failed_ids.push(*id);
                    }
                }

                let mut guard = server_broadcast.clients.lock();
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
        .with_state(server);

    info!("Starting server on :3000");

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();

    axum::serve(listener, app.into_make_service()).await.unwrap();
}
