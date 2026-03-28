use clap::Parser;
use easy_svg::elements::{Circle, Rect, Svg, Text};
use easy_svg::types::Color;
use nokhwa::utils::{CameraFormat, CameraIndex, FrameFormat, RequestedFormat, RequestedFormatType, Resolution};
use nokhwa::Camera;
use rand::distributions::Alphanumeric;
use rand::Rng;
use reqwest::Client;
use std::collections::HashMap;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::time::{Duration, Instant, SystemTime};
use waggle::main::{GraphData, LogData, StringData, SvgData, WaggleData};

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

    if args.camera {
        let cam_client = Client::new();
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
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            loop {
                let t0 = Instant::now();
                if let Ok(frame) = cam.frame() {
                    let t_capture = t0.elapsed();
                    let jpeg_bytes = frame.buffer().to_vec();
                    let t1 = Instant::now();
                    let mut hasher = DefaultHasher::new();
                    jpeg_bytes.hash(&mut hasher);
                    let prefix = hasher.finish();
                    let resp = rt.block_on(async {
                        cam_client
                            .post("http://localhost:3000/image")
                            .header("x-image-name", "camera")
                            .header("x-image-scale", "1")
                            .header("x-image-flip", "false")
                            .body(jpeg_bytes)
                            .send()
                            .await
                    });
                    match resp {
                        Ok(r) => {
                            if !r.status().is_success() {
                                println!("image POST failed: {}", r.status());
                            }
                        }
                        Err(e) => println!("image POST error: {}", e),
                    }
                    let t_send = t1.elapsed();
                    println!(
                        "camera: capture={:?} send={:?} total={:?} hash={:?}",
                        t_capture, t_send, t0.elapsed(), prefix
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
        let request = WaggleData {
            sent_timestamp: 0,
            images: HashMap::new(),
            svg_data,
            graph_data,
            string_data,
            log_data,
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
