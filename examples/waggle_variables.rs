use waggle::waggle_data::{ConfigurableVarData};
use reqwest::Client;
use std::collections::HashMap;

#[tokio::main]
async fn main(){
    let url = "http://localhost:3000/configurable_int";
    let client = Client::new();

    let mut data = ConfigurableVarData {
        configurable_ints: HashMap::new(),
        configurable_doubles: HashMap::new(),
    };

    data.configurable_ints.insert("int1".to_string(), 42);
    data.configurable_doubles.insert("double1".to_string(), 3.145);

    let resp = client.post(url)
        .json(&data)
        .send()
        .await;
}