output "vpc_id" {
  description = "VPC ID"
  value       = alicloud_vpc.wetalk.id
}

output "node_public_ips" {
  description = "ECS 公网 IP 列表"
  value       = [for n in alicloud_instance.nodes : n.public_ip]
}

output "node_private_ips" {
  description = "ECS 内网 IP 列表（K8s/Kafka/ES 互连用）"
  value       = [for n in alicloud_instance.nodes : n.private_ip]
}
