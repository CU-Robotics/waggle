use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use image::ColorType;
use image::codecs::png::PngEncoder;
use image::{ImageBuffer, Rgb};
use std::io::Cursor;
use std::time::{SystemTime, UNIX_EPOCH};

/// Generates a procedurally generated image based on a timestamp.
/// The same timestamp will always produce the same image, and there
/// is continuous motion between successive timestamps.
///
/// Returns the image as a base64-encoded string.
pub fn generate_timestamp_image(width: u32, height: u32) -> String {
    let timestamp_ms = current_timestamp_ms() as f64;
    // Create a new RGB image buffer
    let mut img = ImageBuffer::new(width, height);

    // Normalize the timestamp for various visual elements
    let seconds = (timestamp_ms as f64) / 1000.0;

    // Draw the image
    for y in 0..height {
        for x in 0..width {
            // Normalized coordinates in [0, 1] range
            let nx = x as f64 / width as f64;
            let ny = y as f64 / height as f64;

            // Create moving patterns for motion detection
            // 1. Horizontal moving bars
            let h_bars = ((ny * 20.0 + seconds * 2.0).sin() * 0.5 + 0.5) * 255.0;

            // 2. Vertical moving bars
            let v_bars = ((nx * 20.0 + seconds * 1.5).sin() * 0.5 + 0.5) * 255.0;

            // 3. Moving circular pattern
            let cx = 0.5 + 0.3 * (seconds * 0.7).cos();
            let cy = 0.5 + 0.3 * (seconds * 0.5).sin();
            let dist = ((nx - cx).powi(2) + (ny - cy).powi(2)).sqrt();
            let circle = (dist * 20.0 + seconds * 3.0).sin() * 0.5 + 0.5;

            // 4. Digital clock display (seconds and milliseconds)
            let clock_val = if nx > 0.1 && nx < 0.9 && ny > 0.4 && ny < 0.6 {
                let seconds_int = (seconds % 60.0) as u32;
                let millis = ((timestamp_ms % 1000.0) / 1000.0 * 100.0) as u32;
                let seconds_str = format!("{:02}.{:02}", seconds_int, millis);

                // Simple "digital" display effect - check if this pixel is part of the text
                let pos_in_text = ((nx - 0.1) / 0.8 * seconds_str.len() as f64) as usize;
                if pos_in_text < seconds_str.len() {
                    255.0
                } else {
                    0.0
                }
            } else {
                0.0
            };

            // Combine patterns to create final color
            let r = (h_bars * 0.7 + clock_val * 0.3) as u8;
            let g = (v_bars * 0.6 + circle * 255.0 * 0.4) as u8;
            let b =
                ((nx * 255.0 * 0.3) + (ny * 255.0 * 0.2) + (seconds * 30.0).sin() * 30.0 + 120.0)
                    as u8;

            img.put_pixel(x, y, Rgb([r, g, b]));
        }
    }

    let mut bytes: Vec<u8> = Vec::new();
    img.write_to(&mut Cursor::new(&mut bytes), image::ImageFormat::Png);
    base64::encode(bytes)
}

/// Helper function to get the current timestamp in milliseconds
pub fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis() as u64
}
