resource "aws_security_group" "db" {
  name   = "prod-db"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "main" {
  identifier             = "prod"
  engine                 = "postgres"
  instance_class         = "db.r6g.large"
  publicly_accessible    = true
  vpc_security_group_ids = [aws_security_group.db.id]
}
