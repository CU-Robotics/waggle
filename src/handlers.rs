use crate::{RobotData, socket};
use axum::{
    extract::Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Deserialize)]
pub struct FolderRequest {
    folder_path: String,
}

#[derive(Serialize)]
pub struct FileSystemItem {
    filename: String,
    isdir: bool,
}

#[derive(Serialize)]
pub struct FolderResponse {
    item: Vec<FileSystemItem>,
}

pub async fn get_folder_handler(Json(request): Json<FolderRequest>) -> impl IntoResponse {
    let path = expand_path(&request.folder_path).unwrap_or_default();
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => return Json(FolderResponse { item: vec![] }),
    };

    let items: Vec<FileSystemItem> = entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let file_type = entry.file_type().ok()?;
            Some(FileSystemItem {
                filename: entry.file_name().to_string_lossy().into_owned(),
                isdir: file_type.is_dir(),
            })
        })
        .collect();

    Json(FolderResponse { item: items })
}

#[derive(Deserialize)]
pub struct FileRequest {
    file_path: String,
}

pub async fn get_file_handler(Json(request): Json<FileRequest>) -> impl IntoResponse {
    let path = expand_path(&request.file_path).unwrap_or_default();
    match fs::read(path) {
        Ok(data) => Json(data),
        Err(_) => Json(vec![]),
    }
}

#[derive(Deserialize)]
pub struct FilePutRequest {
    file_path: String,
    data: Vec<u8>,
}

pub async fn put_file_handler(Json(request): Json<FilePutRequest>) -> impl IntoResponse {
    let path = expand_path(&request.file_path).unwrap_or_default();
    if let Err(_) = fs::write(path, request.data) {
        return "Error writing file".into_response();
    }
    "OK".into_response()
}

pub async fn batch_handler(Json(data): Json<RobotData>) -> impl IntoResponse {
    if let Err(e) = socket::add_data_to_buffer(data) {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }
    StatusCode::OK.into_response()
}

fn expand_path(path: &str) -> Option<PathBuf> {
    if path.starts_with("~/") {
        let home = home::home_dir()?;
        Some(home.join(&path[2..]))
    } else {
        Some(PathBuf::from(path))
    }
}
