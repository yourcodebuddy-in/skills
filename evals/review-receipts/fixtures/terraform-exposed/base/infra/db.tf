resource "aws_security_group" "db" {
  name   = "prod-db"
  vpc_id = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
}

resource "aws_db_instance" "main" {
  identifier             = "prod"
  engine                 = "postgres"
  instance_class         = "db.r6g.large"
  publicly_accessible    = false
  vpc_security_group_ids = [aws_security_group.db.id]
}
