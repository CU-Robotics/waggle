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
use std::{collections::HashMap, sync::Arc};
use tokio::sync::mpsc;
use tower_http::services::ServeDir;
use tracing::{debug, error, info, warn};// Added debug for more verbose tracing
use raw_sync::events::{EventImpl, EventInit};
use raw_sync::{
    Timeout,
    events::{Event, EventState},
};
use shared_memory::{ShmemConf, ShmemError};
use std::io::{self, BufRead, BufReader, Write};
use std::str::Utf8Error;
use std::{error::Error, fmt, mem, ptr, time::Duration};


pub struct SharedMessage {
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

    let handle = std::thread::spawn(move || {
        let event1_size = unsafe { Event::size_of(None) };
        let event2_size = unsafe { Event::size_of(None) };
        let message_size = core::mem::size_of::<SharedMessage>();
        let total_shmem_size = (event1_size * 2) + message_size;

        info!("Calculated sizes: Event1={} bytes, Event2={} bytes, Message={} bytes, Total={} bytes",
            event1_size, event2_size, message_size, total_shmem_size
            );

        let shmem_name = "/tmp/waggle_shared_memory";

        info!("Attempting to create/open shared memory mapping '{}'",
            shmem_name
            );

        let mut shmem = match ShmemConf::new()
            .size(total_shmem_size)
            .flink("/tmp/waggle-shared-memory")
            .create()
        {
            Ok(m) => {
                m
            }
            Err(ShmemError::LinkExists) => {
                match  ShmemConf::new().flink("/tmp/waggle-shared-memory").open(){
                    Ok(m) => {
                        m
                    }
                    Err(e) => {
                        error!("Failed to create/open shared memory: {:?}", e);
                        panic!("Failed to open shared memory");
                        //todo: please don't panic when actual robot code
                    }
                }
            }
            Err(e) => {
                error!("Failed to create/open shared memory: {:?}", e);
                panic!("Failed to open shared memory");
                //todo: please don't panic when actual robot code
            }

        };


        let base_ptr = shmem.as_ptr();

        let writer_to_reader_event_ptr = base_ptr;
        let reader_to_writer_event_ptr = unsafe { base_ptr.add(event1_size) };
        let message_data_ptr: *mut SharedMessage =
            unsafe { base_ptr.add(event1_size + event2_size) as *mut SharedMessage };


        info!("This process is a READER of the shared memory.");

        let reader_to_writer_event = match
        unsafe { Event::from_existing(reader_to_writer_event_ptr) }{
            Ok(m)=>{
                m
            }
            Err(e) =>{
                panic!("unable to open reader to writer event");//todo: do not panic when using for actual robot
            }
        };
        info!("Opened existing 'Reader to Writer' Event from shared memory.");

        let writer_to_reader_event = match
        unsafe { Event::from_existing(writer_to_reader_event_ptr)}{
            Ok(m) => {
                m
            }
            Err(e) => {
                panic!("unable to open writer to reader event");//todo: do not panic when using for actual robot
            }
        };
        info!("Opened existing 'Writer to Reader' Event from shared memory.");

        let reader_message = unsafe { &*message_data_ptr };
        info!("Opened existing SharedMessage from shared memory.");


        loop {
            //shmem stuff
            debug!("Waiting for writer to signal");
            match writer_to_reader_event.0.wait(Timeout::Infinite) {
                Ok(_) => debug!("Signal received! Data is ready."),

                Err(e) => {
                    error!("Error waiting for signal: {:?}", e);
                }
            };

            let received_message_bytes = &reader_message.message_buffer[..reader_message.message_len];
            let received_message = match std::str::from_utf8(received_message_bytes) {
                Ok(m) => {
                    m
                }
                Err(e) => {
                    panic!("Unable to convert received message to UTF-8"); //todo: replace panic
                }
            };
            info!("Received message: '{}'", received_message);

            debug!("Signaling 'Reader to Writer' event back to the writer that data has been read...");
            match reader_to_writer_event.0.set(EventState::Signaled) {
                Ok(m) => {
                    m
                }
                Err(e) => {
                    panic!("Failed to send reader signal to writer") //todo: replace panic
                }
            };
            debug!("'Reader to Writer' Event sent back.");

            debug!("Reader process done.");
        }
    });

    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(1000 / 100));
            interval.tick().await;
        loop {
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
