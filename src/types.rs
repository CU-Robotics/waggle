use serde::{Deserialize, Serialize};
use std::collections::HashMap;
#[derive(Debug, Clone)]
pub struct ImageData {
    pub image_data: Vec<u8>,
    pub scale: i32,
    pub flip: bool,
    pub show_base: bool,
    pub svg_overlays: HashMap<String, String>,
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
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ConfigurableVarData {
    pub configurable_ints: HashMap<String, i64>,
    pub configurable_doubles: HashMap<String, f64>,
}

impl ConfigurableVarData {
    /// Entries in `self` whose value differs from `prev` (added or changed). Removals are not represented.
    pub fn diff_against(&self, prev: &ConfigurableVarData) -> ConfigurableVarData {
        let mut configurable_ints = HashMap::new();
        for (k, v) in &self.configurable_ints {
            if prev.configurable_ints.get(k) != Some(v) {
                configurable_ints.insert(k.clone(), *v);
            }
        }
        let mut configurable_doubles = HashMap::new();
        for (k, v) in &self.configurable_doubles {
            if prev.configurable_doubles.get(k) != Some(v) {
                configurable_doubles.insert(k.clone(), *v);
            }
        }
        ConfigurableVarData { configurable_ints, configurable_doubles }
    }
}
