use clap::Parser;
use easy_svg::elements::{Circle, Rect, Svg, Text};
use easy_svg::types::Color;
use parking_lot::Mutex;
use rand::distributions::Alphanumeric;
use rand::Rng;
use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};
use waggle::main::{GraphData, LogData, StringData, SvgData, WaggleData};

#[derive(Parser)]
#[command(about = "Waggle simulator that streams demo data")]
struct Args {
    /// Enable camera capture and stream frames as image data
    #[arg(long)]
    camera: bool,
}

fn create_svg(cx: f64, cy: f64) -> Svg {
    Svg::new()
        .width(500)
        .height(500)
        .add_child_shape_element(Rect::new().width(500.).height(500.).fill(Color::DarkOliveGreen))
        .add_child_text(
            Text::new()
                .x(30.)
                .y(70.)
                .fill(Color::DarkMagenta)
                .add_child_string("Hello World".to_string())
                .font_family("Arial".to_string()),
        )
        .add_child_shape_element(Circle::new().fill(Color::DarkBlue).r(20.).cx(cx).cy(cy))
}
fn spawn_camera_thread() -> Arc<Mutex<Option<Vec<u8>>>> {
    let latest: Arc<Mutex<Option<Vec<u8>>>> = Arc::new(Mutex::new(None));
    let latest_clone = Arc::clone(&latest);

    std::thread::spawn(move || {
        let index = nokhwa::utils::CameraIndex::Index(0);
        let requested = nokhwa::utils::RequestedFormat::new::<nokhwa::pixel_format::RgbFormat>(
            nokhwa::utils::RequestedFormatType::AbsoluteHighestFrameRate,
        );
        let mut cam = match nokhwa::Camera::new(index, requested) {
            Ok(mut cam) => {
                cam.open_stream().expect("Failed to open camera stream");
                println!("Camera opened successfully");
                cam
            },
            Err(e) => {
                eprintln!("Failed to open camera: {e}. Running without camera.");
                return;
            },
        };

        loop {
            let Ok(frame) = cam.frame_raw() else {
                continue;
            };

            *latest_clone.lock() = Some(frame.to_vec());        }
    });

    latest
}
#[tokio::main]
async fn main() {
    let args = Args::parse();

    let camera_frame = if args.camera { Some(spawn_camera_thread()) } else { None };

    let target_fps = 60;
    let tick_rate = Duration::from_micros(1_000_000 / target_fps);
    let mut i = 0;
    let client = Client::new();

    loop {
        i += 1;
        let start = Instant::now();
        let mut string_data = HashMap::<String, StringData>::new();
        string_data.insert("test".to_string(), StringData { value: generate_random_string(5) });

        let mut svg_data = HashMap::<String, SvgData>::new();
        svg_data.insert(
            "demo_svg_1".to_string(),
            SvgData { svg_string: create_svg(((i * 1) % 500) as f64, 80.).to_string() },
        );
        svg_data.insert(
            "demo_svg_2".to_string(),
            SvgData { svg_string: create_svg(((i * 3) % 500) as f64, 80.).to_string() },
        );
        svg_data.insert(
            "demo_svg_3".to_string(),
            SvgData { svg_string: create_svg(((i * 5) % 500) as f64, 80.).to_string() },
        );
        svg_data.insert(
            "demo_svg_4".to_string(),
            SvgData { svg_string: create_svg(((i * 10) % 500) as f64, 80.).to_string() },
        );
        svg_data.insert(
            "demo_svg_5".to_string(),
            SvgData { svg_string: create_svg(((i * 15) % 500) as f64, 80.).to_string() },
        );

        let mut log_data = HashMap::<String, LogData>::new();
        let (level, color_code) = match i % 4 {
            0 => ("INFO", "\x1b[36m"),  // cyan
            1 => ("DEBUG", "\x1b[90m"), // gray
            2 => ("WARN", "\x1b[33m"),  // yellow
            _ => ("ERROR", "\x1b[31m"), // red
        };
        let line = format!(
            "{}[{}]\x1b[0m tick {} cos={:.4} str={}",
            color_code,
            level,
            i,
            f64::cos(i as f64 / 10.),
            string_data.get("test").unwrap().value
        );
        log_data.insert("simulator1".to_string(), LogData { lines: vec![line.clone()] });
        log_data.insert("simulator2".to_string(), LogData { lines: vec![line] });

        let mut graph_data = HashMap::<String, Vec<GraphData>>::new();
        graph_data.insert(
            "cosine".to_string(),
            vec![GraphData {
                x: Some(
                    SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs_f64(),
                ),
                y: f64::cos(i as f64 / 10.),
            }],
        );

        let request = WaggleData {
            sent_timestamp: 0,
            images: HashMap::new(),
            svg_data,
            graph_data,
            string_data,
            log_data,
        };

        // Send non-image data as JSON
        let c = client.clone();
        tokio::spawn(async move {
            if let Err(e) = c.post("http://localhost:3000/batch").json(&request).send().await {
                eprintln!("Send failed: {e}");
            }
        });

        // Send camera frame as raw binary to /image/webcam
        if let Some(ref latest) = camera_frame {
            let frame = latest.lock().clone();
            match frame {
                Some(jpeg_bytes) => {
                    println!("Sending image frame: {} bytes", jpeg_bytes.len());
                    let c = client.clone();
                    tokio::spawn(async move {
                        if let Err(e) = c
                            .post("http://localhost:3000/image/webcam")
                            .header("content-type", "application/octet-stream")
                            .body(jpeg_bytes)
                            .send()
                            .await
                        {
                            eprintln!("Image send failed: {e}");
                        }
                    });
                },
                None => {
                    if i % 60 == 0 {
                        println!("No camera frame available yet");
                    }
                },
            }
        }

        let elapsed = start.elapsed();

        if elapsed < tick_rate {
            tokio::time::sleep(tick_rate - elapsed).await;
        } else {
            println!("Missed target fps by {:.1}ms", (elapsed - tick_rate).as_secs_f64() * 1000.0);
        }
    }
}

fn generate_random_string(length: usize) -> String {
    rand::thread_rng().sample_iter(&Alphanumeric).take(length).map(char::from).collect()
}
