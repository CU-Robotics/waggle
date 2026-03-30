use crate::waggle_data::WaggleData;
use chrono::Local;
use serde_json;
use std::path::Path;
use std::{
    fs,
    fs::{File, OpenOptions},
    io::Write,
};
use tracing::error;

pub struct ReplayManager {
    file: File,
    max_file_size_bytes: usize,
}
impl Default for ReplayManager {
    fn default() -> ReplayManager {
        let replay_folder = Path::new("./replays");

        fs::create_dir_all(replay_folder).unwrap();

        let replay_counter_path = Path::join(replay_folder, "counter");
        let replay_counter_string = fs::read_to_string(&replay_counter_path);
        let replay_counter = if let Ok(string) = replay_counter_string {
            let as_int_result = string.parse::<i32>();
            as_int_result.unwrap_or(0)
        } else {
            1
        };
        if let Err(e) = fs::write(replay_counter_path, (replay_counter + 1).to_string()) {
            error!("Failed to write replay counter");
        }

        let file_name = format!(
            "replay_{}_at_{}.waggle",
            replay_counter,
            Local::now().format("%Y_%m_%d_%H:%M:%S")
        );
        let file_path = Path::join(replay_folder, &file_name);
        let mut file =
            match OpenOptions::new().write(true).append(true).create(true).open(&file_path) {
                Ok(f) => f,
                Err(e) => {
                    panic!("Error: {}", e);
                },
            };

        let file_header = "SCHEMA 2\n";
        file.write_all(file_header.as_bytes()).expect("Failed to write header to file");

        Self { file, max_file_size_bytes: 5_000_000_000 }
    }
}
impl ReplayManager {
    pub fn write_to_file(&mut self, data: &WaggleData) -> Result<(), Box<dyn std::error::Error>> {
        let file_size = self.file.metadata()?.len() as usize;

        if file_size > self.max_file_size_bytes {
            *self = ReplayManager::default();
        }

        let mut json: String = match serde_json::to_string(&data) {
            Ok(s) => s,
            Err(e) => {
                panic!("Error: {}", e);
            },
        };

        json.push('\n');

        if let Err(e) = self.file.write_all(json.as_bytes()) {
            //TODO: resolve error
            return Err(Box::new(e));
        }

        Ok(())
    }
}
