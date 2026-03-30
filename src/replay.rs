use std::{fs::{File, OpenOptions, read, write}, io::Write};
use serde_json;
use chrono::Local;
use crate::waggle_data::WaggleData;
pub struct ReplayManager{
    file: File,
    max_file_size_bytes: usize,
}
impl ReplayManager{
    pub fn new()->ReplayManager{
        
        let file_name = format!("replays/replay_{}.waggle", Local::now().format("%Y_%m_%d_%H:%M:%S"));

        let mut _file = match OpenOptions::new()
            .write(true)
            .append(true)
            .create(true)
            .open(&file_name)
        {
            Ok(f)=>f,
            Err(e) => {
                panic!("Error: {}", e);
            }
        };

        let file_header = "HEADER\n";
        _file.write_all(file_header.as_bytes()).expect("Failed to write header to file");

        Self{
            file: _file,
            max_file_size_bytes: 5_000_000_000,
        }

       

    }

    pub fn write_to_file(&mut self , data: &WaggleData) -> Result<(), Box<dyn std::error::Error>>{
        
        let file_size = self.file.metadata()?.len() as usize;

        if  file_size > self.max_file_size_bytes {
            *self = ReplayManager::new();
        }

        let mut json: String = match serde_json::to_string(&data){
            Ok(s) => s,
            Err(e) =>{
                panic!("Error: {}", e);
            }
        };

        json.push('\n');

        if let Err(e) = self.file.write_all(json.as_bytes()) {
            //TODO: resolve error
            return Err(Box::new(e));
        }

        Ok(())
    }

}