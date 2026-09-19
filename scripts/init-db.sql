-- =============================================================
-- WeTalk 业务库初始化（MySQL 容器首启自动执行，幂等）
-- 业务库 wetalk 与应用账号已由环境变量创建：
--   MYSQL_DATABASE / MYSQL_USER / MYSQL_PASSWORD
-- 后续表结构由后端 JPA 自动建表 / Flyway 迁移维护，此处不建表。
-- =============================================================

CREATE DATABASE IF NOT EXISTS wetalk
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
