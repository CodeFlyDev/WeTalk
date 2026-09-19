// WeTalk 桌面端 Rust 入口
// 前端复用 wetalk-web（devUrl 指向 Vite 开发服务器，生产指向 wetalk-web/dist）
// Phase 4：系统托盘 / 关闭最小化到托盘 / 全局快捷键(Ctrl+Alt+W) / 原生通知桥接 / 系统 Info Command
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

/// 主窗口显示/隐藏切换（托盘左键、全局快捷键共用）
fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let visible = window.is_visible().unwrap_or(false);
        let minimized = window.is_minimized().unwrap_or(false);
        if visible && !minimized {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[derive(serde::Serialize)]
struct SystemInfo {
    os: String,
    arch: String,
    app_version: String,
}

/// 系统信息 Command（Task.md · Tauri 桌面端 Commands 清单）
#[tauri::command]
fn get_system_info(app: AppHandle) -> SystemInfo {
    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        app_version: app.package_info().version.to_string(),
    }
}

#[derive(serde::Deserialize)]
struct NotifyPayload {
    title: String,
    body: String,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_main_window(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![get_system_info])
        .on_window_event(|window, event| {
            // 点关闭 → 隐藏到托盘（IM 常驻模式），托盘菜单/快捷键退出
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            // 全局快捷键 Ctrl+Alt+W：显示/隐藏主窗口
            app.global_shortcut().register("ctrl+alt+w")?;

            // 系统托盘
            let show = MenuItem::with_id(app, "show", "显示 WeTalk", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::with_id("wetalk-tray")
                .icon(app.default_window_icon().expect("missing app icon").clone())
                .tooltip("WeTalk")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // 左键单击 → 切换窗口显隐
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // 前端 → Rust 通知桥接（wetalk-web 通过 withGlobalTauri 的事件 API emit，
            // 不引入任何 Tauri npm 依赖，纯 Web 构建保持零改动）
            let handle = app.handle().clone();
            app.listen("wetalk://notify", move |event| {
                if let Ok(payload) = serde_json::from_str::<NotifyPayload>(event.payload()) {
                    use tauri_plugin_notification::NotificationExt;
                    let _ = handle
                        .notification()
                        .builder()
                        .title(&payload.title)
                        .body(&payload.body)
                        .show();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
