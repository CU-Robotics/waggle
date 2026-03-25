use std::{fs::{File, OpenOptions, read, write}, io::Write};
use serde_json;
use crate::main::WaggleData;
struct ReplayManager{
    file_name: String,
    file: File,
}

impl ReplayManager{
    fn new(_file_name: String)->ReplayManager{
        let now = std::time::SystemTime;
        let _file = match OpenOptions::new()
            .write(true)
            .append(true)
            .create(true)
            .open(&_file_name)
        {
            Ok(f)=>f,
            Err(e) => {
                panic!("Error: {}", e);
            }
        };

        Self{
            file_name: _file_name,
            file: _file,
        }
    }

    pub fn writeToFile(&mut self , data: WaggleData){
        let json: String = match serde_json::to_string(&data){
            Ok(s) => s,
            Err(e) =>{
                panic!("Error: {}", e);
            }
        };
        //write to file
        self.file.write_all(json.as_bytes());
    }   


}