use base64::Engine;
use clap::Parser;
use easy_svg::elements::{Circle, Line, Rect, Svg, Text};
use easy_svg::types::{Color, PreserveAspectRatio};
use nokhwa::Camera;
use nokhwa::utils::{
    CameraFormat, CameraIndex, FrameFormat, RequestedFormat, RequestedFormatType, Resolution,
};
use rand::Rng;
use rand::distributions::Alphanumeric;
use reqwest::Client;
use std::collections::{BTreeMap, HashMap};
use std::hash::{DefaultHasher, Hash, Hasher};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use waggle::types::{GraphData, LogData, StringData, SvgData};
use waggle::waggle_data::WaggleNonImageData;

#[derive(Parser)]
struct Args {
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

fn overlay_svg() -> Svg {
    Svg::new()
        .width(640.)
        .height(480.)
        .view_box((0., 0., 640., 480.))
        .preserve_aspect_ratio(PreserveAspectRatio::None)
}

fn create_detection_overlay(cx: f64) -> String {
    overlay_svg()
        .add_child_shape_element(
            Rect::new()
                .x(cx)
                .y(160.)
                .width(160.)
                .height(160.)
                .fill(Color::Custom("none".to_string()))
                .stroke(Color::Lime)
                .stroke_width(4.),
        )
        .add_child_text(
            Text::new()
                .x(cx + 4.)
                .y(150.)
                .fill(Color::Lime)
                .font_size("24".to_string())
                .font_family("monospace".to_string())
                .add_child_string("camera".to_string()),
        )
        .to_string()
}

fn create_aim_overlay(radius: f64) -> String {
    let crosshair_style = "stroke-width: 3; stroke-dasharray: 12 8".to_string();

    overlay_svg()
        .add_child_shape_element(
            Line::new()
                .x1(0.)
                .y1(240.)
                .x2(640.)
                .y2(240.)
                .stroke(Color::Cyan)
                .style(crosshair_style.clone()),
        )
        .add_child_shape_element(
            Line::new()
                .x1(320.)
                .y1(0.)
                .x2(320.)
                .y2(480.)
                .stroke(Color::Cyan)
                .style(crosshair_style),
        )
        .add_child_shape_element(
            Circle::new()
                .cx(320.)
                .cy(240.)
                .r(radius)
                .fill(Color::Custom("none".to_string()))
                .stroke(Color::Orange)
                .stroke_width(4.),
        )
        .add_child_text(
            Text::new()
                .x(330.)
                .y(270.)
                .fill(Color::Orange)
                .font_size("22".to_string())
                .font_family("monospace".to_string())
                .add_child_string("aim".to_string()),
        )
        .to_string()
}

#[tokio::main]
async fn main() {
    let args = Args::parse();

    let target_fps = 100;
    let tick_rate = Duration::from_micros(1_000_000 / target_fps);
    let mut i = 0;

    let url = "http://localhost:3000/batch";
    let client = Client::new();

    if args.camera {
        let cam_client = Client::new();
        std::thread::spawn(move || {
            let index = CameraIndex::Index(0);
            let format = CameraFormat::new(Resolution::new(640, 480), FrameFormat::MJPEG, 30);
            let requested = RequestedFormat::with_formats(
                RequestedFormatType::Exact(format),
                &[FrameFormat::MJPEG],
            );
            let mut cam = Camera::new(index, requested).expect("Failed to open camera");
            cam.open_stream().expect("Failed to open camera stream");
            println!("Camera opened successfully (MJPEG)");
            let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
            let mut frame_n: u64 = 0;
            loop {
                let t0 = Instant::now();
                if let Ok(frame) = cam.frame() {
                    let t_capture = t0.elapsed();
                    let jpeg_bytes = frame.buffer().to_vec();
                    let t1 = Instant::now();
                    let mut hasher = DefaultHasher::new();
                    jpeg_bytes.hash(&mut hasher);
                    let prefix = hasher.finish();
                    frame_n = frame_n.wrapping_add(1);
                    let cx = (frame_n % 640) as f64;
                    let detection_overlay = create_detection_overlay(cx);
                    let aim_overlay = create_aim_overlay((35 + (frame_n % 40)) as f64);
                    let mut svg_overlays = BTreeMap::new();
                    svg_overlays.insert("aim".to_string(), aim_overlay);
                    svg_overlays.insert("detection".to_string(), detection_overlay);
                    let svg_overlays_json =
                        serde_json::to_string(&svg_overlays).expect("svg overlay json");
                    let svg_overlays_b64 = base64::engine::general_purpose::STANDARD
                        .encode(svg_overlays_json.as_bytes());
                    let resp = rt.block_on(async {
                        cam_client
                            .post("http://localhost:3000/image")
                            .header("x-image-name", "camera")
                            .header("x-image-scale", "1")
                            .header("x-image-flip", "false")
                            .header("x-image-svg-overlays-base64", svg_overlays_b64)
                            .body(jpeg_bytes)
                            .send()
                            .await
                    });
                    match resp {
                        Ok(r) => {
                            if !r.status().is_success() {
                                println!("image POST failed: {}", r.status());
                            }
                        },
                        Err(e) => println!("image POST error: {}", e),
                    }
                    let t_send = t1.elapsed();
                    println!(
                        "camera: capture={:?} send={:?} total={:?} hash={:?}",
                        t_capture,
                        t_send,
                        t0.elapsed(),
                        prefix
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
        let request = WaggleNonImageData {
            sent_timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis()
                as i64,
            svg_data,
            graph_data,
            string_data,
            log_data,
            configurable_vars: Default::default(),
        };
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
