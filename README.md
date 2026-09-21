# WeTalk

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Java](https://img.shields.io/badge/java-21-orange.svg)](https://adoptium.net/)
[![Spring Boot](https://img.shields.io/badge/spring--boot-3.4-brightgreen.svg)](https://spring.io/)
[![React](https://img.shields.io/badge/react-18-blue.svg)](https://react.dev/)
[![Tauri](https://img.shields.io/badge/tauri-2-black.svg)](https://tauri.app/)

> 一个现代化的即时通讯平台 —— 聊天、音视频、AI 助手，三端同步。

---

## 📌 当前状态

项目处于 **活跃开发中**，后端核心模块（消息、认证、红包、AI）已基本实现，前端主要页面已完成，桌面端骨架已搭建。架构和 API 可能随开发进度调整。

---

## ✨ 核心功能

| 分类 | 功能 |
|------|------|
| 💬 **基础聊天** | 单聊/群聊、文字/图片/文件/语音/视频消息、好友管理、会话列表、已读回执 |
| 📞 **音视频** | 一对一音视频通话、多人会议、屏幕共享、屏幕远程协助 |
| 🤖 **AI 能力** | AI 智能助手、语音转文字、聊天摘要、多语言翻译气泡 |
| 🎮 **社交娱乐** | 红包/虚拟币、在线语音房间、朋友圈/动态、聊天成就、频道社区 |
| 🔒 **安全** | 阅后即焚、端到端加密、临时会话 |
| 🔍 **协作** | 多人白板、消息搜索、收藏标签、待办消息、定时发送 |

## 🧩 客户端

| 端 | 技术 | 说明 |
|----|------|------|
| **Web** | React 18 + Vite | 浏览器访问 |
| **PC 桌面** | Tauri 2 + Rust + React | Windows / macOS / Linux 可安装程序 |
| **移动** | React Native（可选） | iOS / Android |

三端共享 React UI 组件层和 TypeScript API SDK。

## 🛠 技术栈

### 后端

- **Java 21** + **Spring Boot 3.4** + **Spring Cloud**
- **Spring WebSocket + STOMP** 实时通信
- **gRPC** 服务间高性能调用
- **Keycloak** OAuth2 / OIDC 统一认证
- **Spring AI + Ollama** 本地 AI 集成

### 数据层

- **MySQL 8** — 用户、关系、群组、钱包（结构化数据）
- **MongoDB 7** — 消息历史（时间序列）
- **Redis 7** — 在线状态、未读计数、分布式锁
- **Elasticsearch 8** — 消息全文检索
- **MinIO** — 图片/文件/音视频对象存储

### 消息与事件

- **Kafka** — 异步消息、离线投递、事件总线
- **RocketMQ** — 事务消息（红包、虚拟币）

### 音视频

- **WebRTC + coturn** — 一对一通话、屏幕共享
- **Mediasoup SFU** — 多人会议、语音房间

### 前端

- **React 18 + TypeScript 5 + Vite 5**
- **TailwindCSS 3 + shadcn/ui**
- **Zustand + TanStack Query**

### DevOps + 云原生

- **Docker + Kubernetes + Helm**
- **GitHub Actions CI/CD**
- **Prometheus + Grafana + SkyWalking** 可观测性三件套
- **Istio** 服务网格
- **Terraform** IaC

## 🏗 架构概览

模块化单体起步 → 按需拆分为微服务。

```
客户端 (Web / Tauri / RN)
        │  WebSocket / gRPC / HTTPS
        ▼
  ┌─────────────┐
  │   Nginx /   │
  │   Gateway   │
  └──────┬──────┘
         ▼
  ┌────────────────────────────────────┐
  │     Spring Boot 业务层              │
  │  auth / user / friend / group      │
  │  message / file / voip / wallet    │
  │  ai / social / gateway              │
  └──────┬──────┬──────┬──────┬──────┬─┘
         ▼      ▼      ▼      ▼      ▼
       MySQL  MongoDB  Redis  ES   Kafka
```

- **在线消息**：WebSocket 直接推送 + MongoDB 持久化
- **离线消息**：Kafka 投递 + Redis 未读标记 + 上线批量拉取
- **媒体附件**：HTTP 上传 MinIO（presigned URL），WebSocket 仅传引用

## 📦 项目结构

```
WeTalk/
├── wetalk-server/      # 后端（Maven 多模块：auth/user/friend/group/message/file/voip/...）
├── wetalk-web/         # Web 前端（React + Vite + Tailwind）
├── wetalk-desktop/     # Tauri PC 客户端（Rust + React）
├── wetalk-mobile/      # React Native 移动端（可选）
├── wetalk-infra/       # 基础设施（Dockerfile / K8s / Helm / Terraform / 监控配置）
├── scripts/            # 开发脚本
├── docker-compose.yml  # 本地开发环境一键拉起
└── .github/workflows/  # CI/CD
```

## 🚀 快速开始

### 环境要求

| 工具 | 版本 |
|------|------|
| JDK | 21+ |
| Node.js | 20 LTS+ |
| Rust | 1.80+（仅桌面端） |
| Docker Desktop | 最新 |

### 1. 启动基础设施

```bash
docker-compose up -d
# MySQL + MongoDB + Redis + Elasticsearch + MinIO + Kafka + Keycloak
```

### 2. 启动后端

```bash
cd wetalk-server
./mvnw spring-boot:run      # Windows: .\mvnw.cmd spring-boot:run
```

### 3. 启动 Web 前端

```bash
cd wetalk-web
npm install
npm run dev
# 访问 http://localhost:5173
```

### 4. 启动 PC 桌面端（可选）

```bash
cd wetalk-desktop
npm install
npm run tauri dev
```

### 5. 构建可安装桌面程序

```bash
npm run tauri build
# Windows: .msi / .exe
# macOS:    .dmg
# Linux:    .AppImage / .deb
```

### 部署上线

| 形态 | 适用场景 | 说明 |
|------|----------|------|
| **单服务器** | POC / 内测 / 小团队 | docker-compose 一键编排全部组件（中间件 + 后端 + Nginx），单机 All-in-One |
| **多服务器集群** | 生产环境 | 接入层 / 业务层 / 数据层分离，中间件全部集群化，K8s + Helm 编排，支持 HPA 弹性扩缩容 |

完整操作步骤（环境准备、环境变量、构建启动、Nginx/WebSocket 配置、K8s 发布、验证清单、端口清单）见 → [Task.md · 系统服务部署](./Task.md#系统服务部署)

## 📖 详细规划

内部技术规划、详细功能清单、消息协议、数据模型、开发路线图见 → [Task.md](./Task.md)

## 🤝 贡献

欢迎 Issue / PR。项目处于活跃开发中，架构和 API 可能随时调整。

## 📄 License

[MIT](./LICENSE)
