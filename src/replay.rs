use std::{fs::{File, OpenOptions, read, write}, io::Write};
use serde_json;
use chrono::Local;
use crate::main::WaggleData;
pub struct ReplayManager{
    file: File,
}

impl ReplayManager{
    pub fn new()->ReplayManager{
        
        let file_name = format!("replay_{}.waggle", Local::now().format("%Y-%m-%d %H:%M:%S"));

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
        }

       

    }

    pub fn write_to_file(&mut self , data: &WaggleData) -> Result<(), Box<dyn std::error::Error>>{
        let json: String = match serde_json::to_string(&data){
            Ok(s) => s,
            Err(e) =>{
                panic!("Error: {}", e);
            }
        };

        if let Err(e) = self.file.write_all(json.as_bytes()) {
            //TODO: resolve error
            return Err(Box::new(e));
        }
        Ok(())
    }

}