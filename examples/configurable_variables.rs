use reqwest::Client;
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
async fn main() {
    let url_int = "http://localhost:3000/configurable-int";
    let url_double = "http://localhost:3000/configurable-double";

    let client = Client::new();

    let int_request = ConfigurableIntRequest { name: "int1".to_string(), default: 42 };

    let double_request = ConfigurableDoubleRequest { name: "double1".to_string(), default: 3.14 };

    client.post(url_int).json(&int_request).send().await.expect("TODO: panic message");

    client.post(url_double).json(&double_request).send().await.expect("TODO: panic message");

    loop {
        let int_value: i32 = client
            .get(url_int)
            .query(&[("name", "int1"), ("default", "42")])
            .send()
            .await
            .expect("failed to GET int")
            .json::<serde_json::Value>()
            .await
            .expect("failed to parse int response")
            ["default"]
            .as_i64()
            .expect("missing int default") as i32;

        let double_value: f64 = client
            .get(url_double)
            .query(&[("name", "double1"), ("default", "3.14")])
            .send()
            .await
            .expect("failed to GET double")
            .json::<serde_json::Value>()
            .await
            .expect("failed to parse double response")
            ["default"]
            .as_f64()
            .expect("missing double default");

        println!("int1 = {}, double1 = {}", int_value, double_value);

        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }
}
