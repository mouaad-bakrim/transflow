.PHONY: up down migrate test backend-test frontend-test
up:
	docker compose up --build
down:
	docker compose down
migrate:
	docker compose run --rm backend python manage.py migrate
test: backend-test frontend-test
backend-test:
	docker compose run --rm backend pytest
frontend-test:
	docker compose run --rm frontend npm test

