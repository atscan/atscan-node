.PHONY: all

all: test

test:
	deno run --unstable --allow-net --allow-read --allow-env --allow-sys index.js