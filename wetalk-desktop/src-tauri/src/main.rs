// WeTalk 桌面端 Rust 入口
// 前端复用 wetalk-web（devUrl 指向 Vite 开发服务器，生产指向 wetalk-web/dist）
// Phase 4 扩展：托盘 / 全局快捷键 / 自动更新 / 原生下载等 Commands
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
