# =============================================================================
# WeTalk 云上资源：VPC + vSwitch + 安全组（80/443 对外，22 限源）+ ECS × node_count
# 镜像 Ubuntu 22.04；实例上按 Task.md · 多服务器部署 部署 K8s/K3s + docker compose
# =============================================================================

data "alicloud_zones" "default" {
  available_resource_creation = "VSwitch"
}

resource "alicloud_vpc" "wetalk" {
  vpc_name   = var.name
  cidr_block = var.vpc_cidr
}

resource "alicloud_vswitch" "wetalk" {
  vpc_id       = alicloud_vpc.wetalk.id
  zone_id      = data.alicloud_zones.default.zones[0].id
  vswitch_name = var.name
  cidr_block   = cidrsubnet(var.vpc_cidr, 8, 1)
}

resource "alicloud_security_group" "wetalk" {
  name   = var.name
  vpc_id = alicloud_vpc.wetalk.id
}

# HTTP/HTTPS 对外
resource "alicloud_security_group_rule" "http_https" {
  for_each          = toset(["80", "443"])
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "${each.value}/${each.value}"
  priority          = 1
  security_group_id = alicloud_security_group.wetalk.id
  cidr_ip           = "0.0.0.0/0"
}

# SSH 限源放行
resource "alicloud_security_group_rule" "ssh" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "22/22"
  priority          = 1
  security_group_id = alicloud_security_group.wetalk.id
  cidr_ip           = var.allow_ssh_cidr
}

# WebRTC TURN 中继段（coturn：3478/5349 + UDP 49160-49200）
resource "alicloud_security_group_rule" "turn_udp" {
  type              = "ingress"
  ip_protocol       = "udp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "49160/49200"
  priority          = 1
  security_group_id = alicloud_security_group.wetalk.id
  cidr_ip           = "0.0.0.0/0"
}

resource "alicloud_instance" "nodes" {
  count                      = var.node_count
  instance_name              = "${var.name}-node-${count.index + 1}"
  instance_type              = var.instance_type
  vswitch_id                 = alicloud_vswitch.wetalk.id
  security_groups            = [alicloud_security_group.wetalk.id]
  key_name                   = var.key_name
  image_id                   = "ubuntu_22_04_x64_20G_alibase_20240627.vhd"
  internet_max_bandwidth_out = 5
  system_disk_category       = "cloud_ssd"
  system_disk_size           = 60
}
