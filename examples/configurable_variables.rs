use reqwest::Client;
#[tokio::main]
async fn main() {
    let url_int = "http://localhost:3000/configurable-int";
    let url_double = "http://localhost:3000/configurable-double";
    let url_batch = "http://localhost:3000/batch";

    let client = Client::new();

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

        let batch_body = serde_json::json!({
            "sent_timestamp": chrono::Local::now().timestamp_millis(),
            "svg_data": {},
            "graph_data": {},
            "string_data": {},
        });
        client
            .post(url_batch)
            .json(&batch_body)
            .send()
            .await
            .expect("failed to POST batch");

        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }
}
