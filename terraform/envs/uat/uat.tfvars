aws_region          = "ap-southeast-1"
instance_type       = "t3.micro"
ubuntu_ami_owner    = "099720109477" // Canonical
vpc_id              = "vpc-042ca4f408c789bdc"
secrets_manager_arn = "arn:aws:secretsmanager:ap-southeast-1:385424877344:secret:koala-be-secret-Mp5rGV"

env_vars = [
  {
    name  = "SALT_ROUND"
    value = "10"
  },
  {
    name  = "LOCAL"
    value = "LOCAL"
  },
  {
    name  = "APP_PORT"
    value = "8080"
  },
  {
    name  = "NODE_ENV"
    value = "development"
  },
  {
    name  = "JWT_EXPIRATION"
    value = "1d"
  },
  {
    name  = "DB_TYPE"
    value = "mongodb" # mongodb or postgresql
  },
  {
    name  = "MONGO_DB_NAME"
    value = "nestjs-base"
  },
  {
    name  = "REDIS_TTL"
    value = "3600"
  },
  {
    name  = "REDIS_TYPE"
    value = "single"
  }
]
