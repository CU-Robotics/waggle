use easy_svg::elements::Svg;
use easy_svg::elements::{Circle, Rect, Text};
use easy_svg::types::Color;
use rand::distributions::Alphanumeric;
use rand::Rng;
use reqwest::Client;
use std::collections::HashMap;
use std::time::{Duration, Instant, SystemTime};
use waggle::main::{GraphData, StringData, SvgData, WaggleData};

fn create_svg(cx: f64, cy: f64) -> Svg {
    Svg::new()
        .width(500)
        .height(500)
        .add_child_shape_element(Rect::new().width(500.).height(500.).fill(Color::DarkOliveGreen))
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
    let target_fps = 60;
    let tick_rate = Duration::from_micros(1_000_000 / target_fps);
    let mut i = 0;

    loop {
        i += 1;
        let start = Instant::now();
        let mut string_data = HashMap::<String, StringData>::new();
        string_data.insert("test".to_string(), StringData { value: generate_random_string(5) });

        let mut svg_data = HashMap::<String, SvgData>::new();
        svg_data.insert(
            "demo_svg_1".to_string(),
            SvgData { svg_string: create_svg(((i * 1) % 500) as f64, 80.).to_string() },
        );
        svg_data.insert(
            "demo_svg_2".to_string(),
            SvgData { svg_string: create_svg(((i * 3) % 500) as f64, 80.).to_string() },
        );
        svg_data.insert(
            "demo_svg_3".to_string(),
            SvgData { svg_string: create_svg(((i * 5) % 500) as f64, 80.).to_string() },
        );
        svg_data.insert(
            "demo_svg_4".to_string(),
            SvgData { svg_string: create_svg(((i * 10) % 500) as f64, 80.).to_string() },
        );
        svg_data.insert(
            "demo_svg_5".to_string(),
            SvgData { svg_string: create_svg(((i * 15) % 500) as f64, 80.).to_string() },
        );

        let mut graph_data = HashMap::<String, Vec<GraphData>>::new();
        graph_data.insert(
            "cosine".to_string(),
            vec![GraphData {
                x: SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs_f64(),
                y: f64::cos(i as f64 / 10.),
            }],
        );
        let request = WaggleData {
            sent_timestamp: 0,
            images: HashMap::new(),
            svg_data,
            graph_data,
            string_data,
        };

        let url = "http://localhost:3000/batch";
        let client = Client::new();
        tokio::spawn(async move {
            client.post(url).json(&request).send().await.expect("TODO: panic message");
        });
        let elapsed = start.elapsed();

        if elapsed < tick_rate {
            tokio::time::sleep(tick_rate - elapsed).await;
        } else {
            println!("Missed target fps by {:?}", tick_rate.as_secs_f32() - elapsed.as_secs_f32());
        }
    }
}

fn generate_random_string(length: usize) -> String {
    rand::thread_rng().sample_iter(&Alphanumeric).take(length).map(char::from).collect()
}
