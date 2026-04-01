use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::Local;

#[derive(Debug, Clone)]
pub struct ImageData {
    pub image_data: Vec<u8>,
    pub scale: i32,
    pub flip: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SvgData {
    pub svg_string: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphData {
    pub x: Option<f64>,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StringData {
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogData {
    pub lines: Vec<String>,
}
impl Into<StringData> for String {
    fn into(self) -> StringData {
        StringData { value: self }
    }
}

#[derive(Debug, Clone)]
pub struct WaggleData {
    pub sent_timestamp: i64,
    pub images: HashMap<String, ImageData>,
    pub svg_data: HashMap<String, SvgData>,
    pub graph_data: HashMap<String, Vec<GraphData>>,
    pub string_data: HashMap<String, StringData>,
    pub log_data: HashMap<String, LogData>,
}
impl Default for WaggleData {
    fn default() -> Self {
        Self {
            sent_timestamp: Local::now().timestamp_millis(),
            images: HashMap::new(),
            svg_data: HashMap::new(),
            graph_data: HashMap::new(),
            string_data: HashMap::new(),
            log_data: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaggleNonImageData {
    pub sent_timestamp: i64,
    pub svg_data: HashMap<String, SvgData>,
    pub graph_data: HashMap<String, Vec<GraphData>>,
    pub string_data: HashMap<String, StringData>,
    #[serde(default)]
    pub log_data: HashMap<String, LogData>,
}

fn push_u32(out: &mut Vec<u8>, val: usize) -> Result<(), String> {
    let val: u32 = val.try_into().map_err(|_| format!("value {} too large for u32", val))?;
    out.extend_from_slice(&val.to_le_bytes());
    Ok(())
}

impl WaggleData {
    /// Serialize to the binary wire format used for WebSocket and replay:
    /// [u32 json_len][json][u32 num_images][per image: u32 name_len, name, i32 scale, u8 flip, u32 data_len, jpeg]
    pub fn to_binary(&self) -> Result<Vec<u8>, String> {
        let non_image = WaggleNonImageData {
            sent_timestamp: self.sent_timestamp,
            svg_data: self.svg_data.clone(),
            graph_data: self.graph_data.clone(),
            string_data: self.string_data.clone(),
            log_data: self.log_data.clone(),
        };
        let json = serde_json::to_vec(&non_image).map_err(|e| format!("json error: {e}"))?;

        let mut out = Vec::new();
        push_u32(&mut out, json.len())?;
        out.extend_from_slice(&json);
        push_u32(&mut out, self.images.len())?;
        for (name, img) in &self.images {
            let name_bytes = name.as_bytes();
            push_u32(&mut out, name_bytes.len())?;
            out.extend_from_slice(name_bytes);
            out.extend_from_slice(&img.scale.to_le_bytes());
            out.push(if img.flip { 1 } else { 0 });
            push_u32(&mut out, img.image_data.len())?;
            out.extend_from_slice(&img.image_data);
        }
        Ok(out)
    }

    /// Serialize a batch of WaggleData to binary for WebSocket:
    /// [u32 num_entries][per entry: u32 entry_len, entry_bytes]
    pub fn batch_to_binary(batch: &[WaggleData]) -> Result<Vec<u8>, String> {
        let mut out = Vec::new();
        push_u32(&mut out, batch.len())?;
        for entry in batch {
            let entry_bytes = entry.to_binary()?;
            push_u32(&mut out, entry_bytes.len())?;
            out.extend_from_slice(&entry_bytes);
        }
        Ok(out)
    }
}
