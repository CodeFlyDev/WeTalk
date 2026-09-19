# =============================================================================
# WeTalk Terraform 变量定义（阿里云）
# =============================================================================

variable "region" {
  description = "地域（如 cn-hangzhou）"
  type        = string
}

variable "name" {
  description = "资源名前缀"
  type        = string
  default     = "wetalk"
}

variable "vpc_cidr" {
  description = "VPC 网段"
  type        = string
  default     = "192.168.0.0/16"
}

variable "instance_type" {
  description = "ECS 规格（业务节点建议 8C16G：ecs.c7.2xlarge；小规模可降）"
  type        = string
  default     = "ecs.c7.xlarge"
}

variable "node_count" {
  description = "ECS 数量（多服务器形态参考：app×2 + db + mq + oss + obs）"
  type        = number
  default     = 3
}

variable "key_name" {
  description = "SSH 密钥对名称（控制台预创建）"
  type        = string
}

variable "allow_ssh_cidr" {
  description = "SSH 放行网段（不要填 0.0.0.0/0）"
  type        = string
  default     = "0.0.0.0/0"
}
