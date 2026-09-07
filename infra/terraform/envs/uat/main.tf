data "aws_ami" "ubuntu" {
  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  owners = [var.ubuntu_ami_owner]
}

data "aws_subnets" "existed_subnets" {
  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }

  filter {
    name   = "tag:Name"
    values = ["*default*"]
  }
}

data "aws_security_group" "existed_security_groups" {
  filter {
    name   = "group-name"
    values = ["launch-wizard-15"]
  }

  vpc_id = var.vpc_id
}

data "aws_secretsmanager_secret_version" "nestjs_base_secrets" {
  secret_id = var.secrets_manager_arn
}

locals {
  # Decode the JSON secret string if your secret is stored as JSON
  app_credentials = jsondecode(data.aws_secretsmanager_secret_version.nestjs_base_secrets.secret_string)
}

resource "tls_private_key" "nestjs_base_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "nestjs_base_keypair" {
  key_name   = "nestjs-base-keypair"
  public_key = tls_private_key.nestjs_base_key.public_key_openssh
}

# IAM role for EC2 instance to access Secrets Manager
resource "aws_iam_role" "nestjs_base_role" {
  name = "nestjs-base-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy to access the specific secret
resource "aws_iam_role_policy" "nestjs_base_secrets_policy" {
  name = "nestjs-base-secrets-policy"
  role = aws_iam_role.nestjs_base_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.secrets_manager_arn
      }
    ]
  })
}

# Instance profile for the EC2 instance
resource "aws_iam_instance_profile" "nestjs_base_profile" {
  name = "nestjs-base-instance-profile"
  role = aws_iam_role.nestjs_base_role.name
}

resource "aws_instance" "nestjs_base" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type

  subnet_id              = data.aws_subnets.existed_subnets.ids[0]
  vpc_security_group_ids = [data.aws_security_group.existed_security_groups.id]

  associate_public_ip_address = true

  key_name             = aws_key_pair.koala_be_keypair.key_name
  iam_instance_profile = aws_iam_instance_profile.koala_be_profile.name

  user_data = <<-EOT
    #!/bin/bash
    set -xe

    # Log all output for debugging
    exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

    # Update package list
    apt-get update -y
    apt-get install -y jq

    # Install Docker
    apt-get install -y docker.io

    # Start and enable Docker
    systemctl start docker
    systemctl enable docker

    # Add ubuntu user to docker group
    usermod -aG docker ubuntu

    # Install Docker Compose
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | jq -r '.tag_name')
    curl -L "https://github.com/docker/compose/releases/download/$${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose

    # Create app directory
    mkdir -p /home/ubuntu/app

    # Create env file (Terraform loop will render here)
    rm -f /home/ubuntu/app/.env
    cat > /home/ubuntu/app/.env <<-EOF
    %{for env in var.env_vars~}
    ${env.name}=${env.value}
    %{endfor~}
    MONGO_URI=${local.app_credentials.MONGO_URI}
    JWT_SECRET=${local.app_credentials.JWT_SECRET}
    REDIS_HOST=${local.app_credentials.REDIS_HOST}
    EOF

    # Set proper ownership
    chown ubuntu:ubuntu /home/ubuntu/app/.env

    echo "User data script completed successfully at $(date)"
  EOT


  tags = {
    Name = "nestjs-base-uat"
  }
}
