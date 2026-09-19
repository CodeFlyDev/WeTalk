# =============================================================================
# WeTalk Terraform 云上基础设施脚手架（Phase 8 · 选型阿里云 alicloud provider）
# 形态：VPC + 安全组 + N 台 ECS（对应 Task.md · 多服务器部署节点规划，可在实例上自建 K8s/K3s）
# 用法：
#   cd wetalk-infra/terraform
#   cp terraform.tfvars.example terraform.tfvars   # 填写 region / key_name 等
#   terraform init && terraform plan && terraform apply
# =============================================================================
terraform {
  required_version = ">= 1.6"

  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = "~> 1.235"
    }
  }
}

provider "alicloud" {
  region = var.region
}
