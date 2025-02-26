use serde::Serialize;
use std::panic;
use tracing::error;

pub fn protect<F>(f: F)
where
    F: FnOnce() + panic::UnwindSafe,
{
    let result = panic::catch_unwind(f);
    if let Err(err) = result {
        error!("Protected from runtime panic: {:?}", err);
    }
}

pub fn pretty_print<T: Serialize>(value: &T) {
    match serde_json::to_string_pretty(value) {
        Ok(s) => println!("{}", s),
        Err(e) => error!("Error serializing: {}", e),
    }
}
