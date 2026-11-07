CC ?= cc
CFLAGS ?= -std=c11 -Wall -Wextra -O0 -g

test:
	mkdir -p build
	$(CC) $(CFLAGS) src/strutil.c src/list.c src/test_main.c -o build/test
	./build/test

.PHONY: test
