output "ec2_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.nestjs_base.public_ip
}

output "ec2_public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = aws_instance.nestjs_base.public_dns
}

output "ec2_private_key" {
  description = "Private key for the EC2 instance"
  value       = tls_private_key.nestjs_base_key.private_key_pem
  sensitive   = true
}

output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.nestjs_base.id
}

output "security_group_id" {
  description = "ID of the security group"
  value       = data.aws_security_group.existed_security_groups.id
}

// output subnet id here
output "subnet_id" {
  description = "ID of the subnet"
  value       = data.aws_subnets.existed_subnets.ids[0]
}
