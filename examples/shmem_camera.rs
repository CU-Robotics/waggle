use anyhow::{Context, Result, bail};
use chrono::Local;
use clap::Parser;
use nokhwa::Camera;
use nokhwa::utils::{
    CameraFormat, CameraIndex, FrameFormat, RequestedFormat, RequestedFormatType, Resolution,
};
use rand::Rng;
use shared_memory::{Shmem, ShmemConf};
use std::collections::HashMap;
use std::mem::size_of;
use std::sync::atomic::{AtomicU64, Ordering};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use waggle::waggle_data::{
    ConfigurableVarData, GraphData, ImageData, LogData, StringData, SvgData, WaggleData,
};

const SHMEM_PATH: &str = "/tmp/waggle-shared-memory";
const MESSAGE_BUFFER_SIZE: usize = 50_000_000;

#[repr(C)]
struct SharedMemHeader {
    write_counter: AtomicU64,
    read_counter: AtomicU64,
    message_len: usize,
    message_buffer: [u8; MESSAGE_BUFFER_SIZE],
}

#[derive(Parser)]
struct Args {
    #[arg(long, default_value = "0")]
    camera_index: u32,

    #[arg(long, default_value = "640")]
    width: u32,

    #[arg(long, default_value = "480")]
    height: u32,

    #[arg(long, default_value = "30")]
    fps: u32,

    #[arg(long, default_value = SHMEM_PATH)]
    shmem_path: String,
}

fn main() -> Result<()> {
    let args = Args::parse();
    let fps = args.fps.max(1);
    let tick_rate = Duration::from_micros(1_000_000 / u64::from(fps));

    let mut shmem = create_shmem(&args.shmem_path)?;
    init_header(&mut shmem);
    let header = unsafe { &mut *(shmem.as_ptr() as *mut SharedMemHeader) };

    let mut camera = open_camera(args.camera_index, args.width, args.height, fps)?;

    println!("Writing camera frames and bogus telemetry to {} at {} fps", args.shmem_path, fps);
    println!("Start the waggle server separately; it will open this shmem file link.");

    let mut frame_id = 0_u64;
    loop {
        let start = Instant::now();
        let frame = camera.frame().context("failed to read camera frame")?;
        let jpeg_bytes = frame.buffer().to_vec();

        frame_id = frame_id.wrapping_add(1);
        let waggle_data = build_frame(frame_id, jpeg_bytes, args.width, args.height);
        write_frame(header, &waggle_data)?;

        if frame_id % u64::from(fps) == 0 {
            println!("sent frame {}", frame_id);
        }

        let elapsed = start.elapsed();
        if elapsed < tick_rate {
            thread::sleep(tick_rate - elapsed);
        }
    }
}

fn create_shmem(path: &str) -> Result<Shmem> {
    ShmemConf::new()
        .size(size_of::<SharedMemHeader>())
        .flink(path)
        .force_create_flink()
        .create()
        .with_context(|| format!("failed to create shared memory at {path}"))
}

fn init_header(shmem: &mut Shmem) {
    let header = unsafe { &mut *(shmem.as_ptr() as *mut SharedMemHeader) };
    header.write_counter.store(0, Ordering::Release);
    header.read_counter.store(0, Ordering::Release);
    header.message_len = 0;
}

fn open_camera(index: u32, width: u32, height: u32, fps: u32) -> Result<Camera> {
    let format = CameraFormat::new(Resolution::new(width, height), FrameFormat::MJPEG, fps);
    let requested =
        RequestedFormat::with_formats(RequestedFormatType::Exact(format), &[FrameFormat::MJPEG]);
    let mut camera = Camera::new(CameraIndex::Index(index), requested)
        .with_context(|| format!("failed to open camera index {index}"))?;
    camera.open_stream().context("failed to open camera stream")?;
    Ok(camera)
}

fn build_frame(frame_id: u64, jpeg_bytes: Vec<u8>, width: u32, height: u32) -> WaggleData {
    let now_ms = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;
    let now_s = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs_f64();
    let t = frame_id as f64 / 20.0;
    let mut rng = rand::thread_rng();

    let mut images = HashMap::new();
    images.insert(
        "camera".to_string(),
        ImageData {
            image_data: jpeg_bytes,
            scale: 1,
            flip: false,
            svg_overlay: None,
            svg_overlays: camera_overlays(frame_id, width, height),
        },
    );

    let mut svg_data = HashMap::new();
    svg_data.insert("bogus_scope".to_string(), SvgData { svg_string: bogus_scope_svg(frame_id) });

    let mut graph_data = HashMap::new();
    graph_data.insert("bogus_sine".to_string(), vec![GraphData { x: Some(now_s), y: t.sin() }]);
    graph_data.insert(
        "bogus_noise".to_string(),
        vec![GraphData { x: Some(now_s), y: rng.gen_range(-1.0..1.0) }],
    );

    let mut string_data = HashMap::new();
    string_data.insert("frame".to_string(), StringData { value: frame_id.to_string() });
    string_data.insert(
        "bogus_state".to_string(),
        StringData {
            value: match frame_id % 4 {
                0 => "search",
                1 => "track",
                2 => "align",
                _ => "idle",
            }
            .to_string(),
        },
    );

    let mut log_data = HashMap::new();
    log_data.insert(
        "shmem_camera".to_string(),
        LogData {
            lines: vec![format!(
                "[{}] frame={} bogus_sine={:.3} bogus_noise={:.3}",
                Local::now().format("%H:%M:%S%.3f"),
                frame_id,
                t.sin(),
                rng.gen_range(-1.0..1.0),
            )],
        },
    );

    let mut configurable_vars = ConfigurableVarData::default();
    configurable_vars.configurable_ints.insert("bogus_threshold".to_string(), 42);
    configurable_vars.configurable_doubles.insert("bogus_gain".to_string(), 0.75);

    WaggleData {
        sent_timestamp: now_ms,
        images,
        svg_data,
        graph_data,
        string_data,
        log_data,
        configurable_vars,
    }
}

fn camera_overlays(frame_id: u64, width: u32, height: u32) -> HashMap<String, String> {
    let w = f64::from(width);
    let h = f64::from(height);
    let box_size = (w.min(h) * 0.22).max(40.0);
    let x = ((frame_id * 7) % width.max(1) as u64) as f64;
    let x = x.min((w - box_size).max(0.0));
    let y = (h * 0.35).min((h - box_size).max(0.0));

    let detection = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" preserveAspectRatio="none">
<rect x="{x:.1}" y="{y:.1}" width="{box_size:.1}" height="{box_size:.1}" fill="none" stroke="lime" stroke-width="4"/>
<text x="{text_x:.1}" y="{text_y:.1}" fill="lime" font-size="24" font-family="monospace">bogus target</text>
</svg>"#,
        text_x = x + 6.0,
        text_y = (y - 10.0).max(24.0),
    );

    let aim = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" preserveAspectRatio="none">
<line x1="0" y1="{cy:.1}" x2="{width}" y2="{cy:.1}" stroke="cyan" stroke-width="3" stroke-dasharray="12 8"/>
<line x1="{cx:.1}" y1="0" x2="{cx:.1}" y2="{height}" stroke="cyan" stroke-width="3" stroke-dasharray="12 8"/>
<circle cx="{cx:.1}" cy="{cy:.1}" r="{radius:.1}" fill="none" stroke="orange" stroke-width="4"/>
</svg>"#,
        cx = w / 2.0,
        cy = h / 2.0,
        radius = 30.0 + (frame_id % 40) as f64,
    );

    HashMap::from([("detection".to_string(), detection), ("aim".to_string(), aim)])
}

fn bogus_scope_svg(frame_id: u64) -> String {
    let cx = 40 + (frame_id % 420);
    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="500" height="120" viewBox="0 0 500 120">
<rect width="500" height="120" fill="#111827"/>
<line x1="0" y1="60" x2="500" y2="60" stroke="#334155" stroke-width="2"/>
<circle cx="{cx}" cy="60" r="18" fill="#22c55e"/>
<text x="16" y="30" fill="#e5e7eb" font-family="monospace" font-size="18">bogus scope frame {frame_id}</text>
</svg>"##
    )
}

fn write_frame(header: &mut SharedMemHeader, data: &WaggleData) -> Result<()> {
    let bytes = data.to_binary().map_err(|e| anyhow::anyhow!(e))?;
    if bytes.len() > MESSAGE_BUFFER_SIZE {
        bail!(
            "serialized frame is {} bytes, but shmem message buffer is {} bytes",
            bytes.len(),
            MESSAGE_BUFFER_SIZE
        );
    }

    let write_seq = header.write_counter.load(Ordering::Acquire);
    while header.read_counter.load(Ordering::Acquire) != write_seq {
        thread::sleep(Duration::from_micros(100));
    }

    header.message_buffer[..bytes.len()].copy_from_slice(&bytes);
    header.message_len = bytes.len();
    header.write_counter.store(write_seq + 1, Ordering::Release);
    Ok(())
}
