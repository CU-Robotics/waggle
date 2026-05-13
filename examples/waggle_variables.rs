use waggle::waggle_data::{ConfigurableVarData};
use reqwest::Client;
use std::collections::HashMap;
#[derive(serde::Serialize)]
struct ConfigurableIntRequest {
    name: String,
    default: i32,
}
#[derive(serde::Serialize)]
struct ConfigurableDoubleRequest {
    name: String,
    default: f64,
}

#[tokio::main]
async fn main(){
    let url_int = "http://localhost:3000/configurable-int";
    let url_double = "http://localhost:3000/configurable-double";

    let client = Client::new();

    let int_request = ConfigurableIntRequest {
        name: "int1".to_string(),
        default: 42,
    };
    
    let double_request = ConfigurableDoubleRequest {
        name: "double1".to_string(),
        default: 3.14,
    };
    
    let resp_int = client.post(url_int)
        .json(&int_request)
        .send()
        .await;

    let resp_double = client.post(url_double)
        .json(&double_request)
        .send()
        .await;

    loop{}
}