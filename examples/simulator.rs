use std::collections::HashMap;
use easy_svg::types::Color;
use easy_svg::elements::{Circle, Line, Rect, Text};
use easy_svg::elements::Svg;
use rand::Rng;
use std::sync::{Arc, Mutex};
use std::thread::sleep;
use std::time::Duration;
use rand::distributions::Alphanumeric;
use waggle::main::{StringData, SvgData, WaggleData};
use reqwest::Client;
use tracing_subscriber::registry::Data;

fn create_svg(cx: f64, cy: f64) -> Svg {
    Svg::new()
        .width(500)
        .height(500)
        .add_child_shape_element(
            Rect::new()
                .width(500.)
                .height(500.)
                .fill(Color::DarkOliveGreen),
        )
        .add_child_text(
            Text::new()
                .x(30.)
                .y(70.)
                .fill(Color::DarkMagenta)
                .add_child_string("Hello World".to_string())
                .font_family("Arial".to_string()),
        )
        .add_child_shape_element(Circle::new().fill(Color::DarkBlue).r(20.).cx(cx).cy(cy))
}
#[tokio::main]
async fn main() {
    for i in 0..100000 {
        let mut string_data = HashMap::<String, StringData>::new();
        string_data.insert("test".to_string(), StringData{value:generate_random_string(5)});

        let mut svg_data = HashMap::<String, SvgData>::new();
        svg_data.insert("demo_svg_1".to_string(), SvgData{ svg_string: create_svg(((i * 1) % 500) as f64, 80.).to_string() });
        svg_data.insert("demo_svg_2".to_string(), SvgData{ svg_string: create_svg(((i * 3) % 500) as f64, 80.).to_string() });
        // svg_data.insert("demo_svg_3".to_string(), SvgData{ svg_string: create_svg(((i * 5) % 500) as f64, 80.).to_string() });
        // svg_data.insert("demo_svg_4".to_string(), SvgData{ svg_string: create_svg(((i * 10) % 500) as f64, 80.).to_string() });
        // svg_data.insert("demo_svg_5".to_string(), SvgData{ svg_string: create_svg(((i * 15) % 500) as f64, 80.).to_string() });

        let request = WaggleData {
            sent_timestamp: 0,
            images: HashMap::new(),
            svg_data,
            graph_data: Default::default(),
            string_data,
        };

        let url = "http://localhost:3000/batch";
        let client = Client::new();
        let res = client
            .post(url)
            .json(&request)
            .send()
            .await.unwrap();
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
}

fn generate_random_string(length: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(length)
        .map(char::from)
        .collect()
}
