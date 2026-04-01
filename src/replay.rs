use crate::waggle_data::WaggleData;
use chrono::{DateTime, Local};
use log::info;
use std::path::Path;
use std::sync::LazyLock;
use std::time::Instant;
use std::{
    fs,
    fs::{File, OpenOptions},
    io::{BufWriter, Write},
};
use tracing::error;

pub struct ReplayManager {
    writer: LazyLock<BufWriter<File>>,
    max_file_size_bytes: usize,
    last_write_timestamp: Option<Instant>,
}
impl Default for ReplayManager {
    fn default() -> ReplayManager {
        Self {
            writer: LazyLock::new(|| Self::create_replay_file()),
            max_file_size_bytes: 5_000_000_000,
            last_write_timestamp: None,
        }
    }
}
impl ReplayManager {
    pub fn write_to_file(&mut self, data: &WaggleData) -> Result<(), Box<dyn std::error::Error>> {
        const REPLAY_TIMEOUT: u128 = 1000;
        let replay_file_is_timed_out = if let Some(last_write_timestamp) = self.last_write_timestamp
        {
            last_write_timestamp.elapsed().as_millis() > REPLAY_TIMEOUT
        } else {
            false
        };
        self.last_write_timestamp = Some(Instant::now());

        let file_size = self.writer.get_ref().metadata()?.len();
        let replay_file_too_big = file_size > self.max_file_size_bytes.try_into()?;
        if replay_file_too_big || replay_file_is_timed_out {
            *self = ReplayManager::default();
        }

        let record = data.to_binary().map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
        let record_len: u32 = record.len().try_into().map_err(|_| "record too large for u32")?;
        self.writer.write_all(&record_len.to_le_bytes())?;
        self.writer.write_all(&record)?;
        self.writer.flush()?;

        Ok(())
    }

    fn create_replay_file() -> BufWriter<File> {
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
        if let Err(_e) = fs::write(replay_counter_path, (replay_counter + 1).to_string()) {
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

        let file_header = b"SCHEMA 3\n";
        file.write_all(file_header).expect("Failed to write header to file");
        BufWriter::new(file)
    }
}
