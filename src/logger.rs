use axum::{
    body::Body,
    http::{Request, Response},
    middleware::Next,
};
use std::time::Instant;
use tracing::{error, info};

pub async fn log_request(req: Request<Body>, next: Next) -> Response<Body> {
    let start = Instant::now();
    let path = req.uri().path().to_owned();
    let method = req.method().clone();

    let response = next.run(req).await;

    let status = response.status();
    let duration = start.elapsed();

    if status.is_success() {
        info!(
            "Request: {} {} - Status: {} - Duration: {:?}",
            method, path, status, duration
        );
    } else {
        error!(
            "Request: {} {} - Status: {} - Duration: {:?}",
            method, path, status, duration
        );
    }

    response
}
