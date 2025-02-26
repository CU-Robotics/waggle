use axum::{
    Router,
    error_handling::HandleErrorLayer,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use std::net::SocketAddr;
use std::time::Duration;
use tower::ServiceBuilder;
use tower_http::{services::ServeDir, timeout::TimeoutLayer, trace::TraceLayer};
use tracing::{error, info};

// Import our local modules
mod handlers;
mod helpers;
mod logger;
mod socket;

use crate::{handlers::*, socket::ws_handler};

// Our data structures
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ImageData {
    image_data: String,
    scale: i32,
    flip: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct GraphDataSettings {
    clear_data: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct GraphDataPoint {
    x: f64,
    y: f64,
    settings: GraphDataSettings,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RobotPosition {
    x: f64,
    y: f64,
    heading: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct StringData {
    value: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RobotData {
    sent_timestamp: f64,
    images: std::collections::HashMap<String, ImageData>,
    graph_data: std::collections::HashMap<String, Vec<GraphDataPoint>>,
    string_data: std::collections::HashMap<String, StringData>,
    robot_position: RobotPosition,
}

#[derive(Debug)]
pub enum AppError {
    JsonError(String),
    IoError(String),
    WebSocketError(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::JsonError(msg) => write!(f, "JSON error: {}", msg),
            AppError::IoError(msg) => write!(f, "IO error: {}", msg),
            AppError::WebSocketError(msg) => write!(f, "WebSocket error: {}", msg),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match self {
            AppError::JsonError(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::IoError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
            AppError::WebSocketError(msg) => (StatusCode::BAD_GATEWAY, msg),
        };

        error!("{}: {}", status, message);
        (status, message).into_response()
    }
}

async fn handle_error(error: BoxError) -> impl IntoResponse {
    error!("Internal error: {}", error);
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        format!("Internal Server Error: {}", error),
    )
}

type BoxError = Box<dyn std::error::Error + Send + Sync>;

#[derive(Clone)]
struct AppState {}

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    let state = AppState {};

    // Build our application with routes
    let app = Router::new()
        .route("/batch", post(handlers::batch_handler))
        .route("/ws", get(socket::ws_handler))
        .route("/get-folder", post(handlers::get_folder_handler))
        .route("/get-file", post(handlers::get_file_handler))
        .route("/put-file", post(handlers::put_file_handler))
        .fallback_service(ServeDir::new("client/dist"))
        .with_state(state)
        // Add middleware in reverse order
        .layer(axum::middleware::from_fn(logger::log_request))
        .layer(TraceLayer::new_for_http())
        .layer(TimeoutLayer::new(Duration::from_secs(30)))
        .layer(HandleErrorLayer::new(handle_error));

    // Run our app
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    info!("listening on {}", addr);

    axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app)
        .await
        .unwrap();
}
