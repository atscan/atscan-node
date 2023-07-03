module.exports = {
    apps: [{
      name: "atscan-http-node",
      script: "index.js",
      args: "",
      interpreter: "deno",
      interpreterArgs:
        "run --unstable --allow-net --allow-read --allow-env --allow-sys",
      watch: true,
    }],
  };
  