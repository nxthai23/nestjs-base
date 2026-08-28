variable "ubuntu_ami_owner" {
  description = "AWS account ID of the Ubuntu AMI owner"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "secrets_manager_arn" {
  description = "ARN of the AWS Secrets Manager secret containing application secrets"
  type        = string
}

variable "env_vars" {
  description = "List of environment variables for NestJS app"
  type = list(object({
    name  = string
    value = string
  }))
}
