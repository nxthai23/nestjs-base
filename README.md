## Description

[Nest](https://github.com/nxthai23/nestjs-base) Base nestjs project struct using Repository Pattern

## Installation

```bash
$ npm ci
```

## Running the app

### Step 1:

Setting up your env in env.example file

### Step 2:

Choose command below and run

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Running the app Docker way

### Requirements:

- Docker
- Docker compose

Step 1:

Run the command below:

```bash
$ docker-compose up -d --build
```

## Project Structure

Base on Repository Pattern <br>
Updating...

## Terraform Guide

1. Go to terraform folder with your envs, run

```bash
terraform init
```

2. Run terraform plan to check create infra is right

```bash
terraform plan -var-file="{{env}}.tfvars"
```

3. Run validate and format

```bash
terraform validate
```

```bash
terraform fmt
```

4. Create infra via Terraform

```bash
terraform apply -var-file="{{env}}.tfvars"
```

## Some guide

To use exception filter:

1. add @UseFilter(HttpExceptionFilter)
2. throw err (do NOT return err)

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Thai Nguyen](https://github.com/nxthai23)

## License

Nest is [MIT licensed](LICENSE).
