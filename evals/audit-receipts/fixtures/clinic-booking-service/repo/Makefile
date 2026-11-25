.PHONY: test serve worker image

test:
	python3 -m unittest discover -s tests

serve:
	python3 -m clinicbook serve

worker:
	python3 -m clinicbook worker

image:
	docker build --tag clinicbook .
