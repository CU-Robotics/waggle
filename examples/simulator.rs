use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use clap::Parser;
use easy_svg::elements::{Circle, Rect, Svg, Text};
use easy_svg::types::Color;
use nokhwa::utils::{CameraFormat, CameraIndex, FrameFormat, RequestedFormat, RequestedFormatType, Resolution};
use nokhwa::Camera;
use rand::distributions::Alphanumeric;
use rand::Rng;
use reqwest::Client;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};
use waggle::main::{GraphData, ImageData, LogData, StringData, SvgData, WaggleData};

#[derive(Parser)]
struct Args {
    /// Enable camera capture and send frames as image data
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
#[tokio::main]
async fn main() {
    let args = Args::parse();

    let target_fps = 100;
    let tick_rate = Duration::from_micros(1_000_000 / target_fps);
    let mut i = 0;

    let url = "http://localhost:3000/batch";
    let client = Client::new();

    let latest_frame: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));

    if args.camera {
        let frame_ref = Arc::clone(&latest_frame);
        std::thread::spawn(move || {
            let index = CameraIndex::Index(0);
            let format = CameraFormat::new(
                Resolution::new(640, 480),
                FrameFormat::MJPEG,
                30,
            );
            let requested = RequestedFormat::with_formats(
                RequestedFormatType::Exact(format),
                &[FrameFormat::MJPEG],
            );
            let mut cam = Camera::new(index, requested).expect("Failed to open camera");
            cam.open_stream().expect("Failed to open camera stream");
            println!("Camera opened successfully (MJPEG)");
            loop {
                let t0 = Instant::now();
                if let Ok(frame) = cam.frame() {
                    let t_capture = t0.elapsed();

                    let t1 = Instant::now();
                    let b64 = BASE64.encode(frame.buffer());
                    let t_b64 = t1.elapsed();

                    *frame_ref.lock().unwrap() = Some(b64);
                    println!(
                        "camera: capture={:?} b64={:?} total={:?}",
                        t_capture, t_b64, t0.elapsed()
                    );
                }
            }
        });
    }

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
        let mut images = HashMap::<String, ImageData>::new();

        if let Some(b64) = latest_frame.lock().unwrap().take() {
            images
                .insert("camera".to_string(), ImageData { image_data: b64, scale: 1, flip: false });
        }

        let request =
            WaggleData { sent_timestamp: 0, images, svg_data, graph_data, string_data, log_data };
        let client = client.clone();
        tokio::spawn(async move {
            client.post(url).json(&request).send().await.expect("TODO: panic message");
        });
        let elapsed = start.elapsed();

        if elapsed < tick_rate {
            tokio::time::sleep(tick_rate - elapsed).await;
        } else {
            println!("Missed target fps by {:?}", tick_rate.as_secs_f32() - elapsed.as_secs_f32());
        }
    }
}

fn generate_random_string(length: usize) -> String {
    rand::thread_rng().sample_iter(&Alphanumeric).take(length).map(char::from).collect()
}
