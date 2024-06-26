use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::broadcast;
use warp::{http::StatusCode, Filter};
#[derive(Deserialize, Serialize, Debug, Clone)]
struct Message {
    text: String,
}

#[tokio::main]
async fn main() {
    let (tx, _rx) = broadcast::channel::<Value>(100);
    let tx = Arc::new(tx);

    let static_files = warp::fs::dir("static");

    let ping_route = warp::path("ping").map(|| warp::reply::with_status("pong", StatusCode::OK));

    let post_route = {
        let tx = tx.clone();
        warp::path("set")
            .and(warp::post())
            .and(warp::body::json())
            .map(move |msg: Value| {
                tx.send(msg.clone()).unwrap();
                warp::reply()
            })
    };

    let ws_route = {
        let tx = tx.clone();
        warp::path("ws")
            .and(warp::ws())
            .map(move |ws: warp::ws::Ws| {
                let tx = tx.clone();
                ws.on_upgrade(move |websocket| handle_ws(websocket, tx.clone()))
            })
    };

    let routes = ping_route.or(static_files).or(post_route).or(ws_route);
    warp::serve(routes).run(([127, 0, 0, 1], 3030)).await;
}

async fn handle_ws(ws: warp::ws::WebSocket, transmitter: Arc<broadcast::Sender<Value>>) {
    let (mut ws_transmitter, mut ws_reciever) = ws.split();
    let mut rx = transmitter.subscribe();

    // websocket reciever
    tokio::task::spawn(async move {
        while let Some(result) = ws_reciever.next().await {
            if let Ok(_msg) = result {}
        }
    });

    //websocket sender
    tokio::task::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let msg = warp::ws::Message::text(serde_json::to_string(&msg).unwrap());
            if ws_transmitter.send(msg).await.is_err() {
                break;
            }
        }
    });
}
