"use strict";

function main() {
  pollAPI((rslt, err) => {
    if (rslt) {
      rslt = remove_fields(JSON.parse(rslt), ["selftext", "selftext_html"]);

      console.log(JSON.stringify(rslt, null, 2));
    } else {
      console.log("Error: " + err);
    }
  });
}

let conf = require('./config/main.cfg.json');
let https = require('https');
let pkg = require('./package.json');
let url = require('url');

let uagent = `darwin:${conf.domain}:${pkg.version}`;

function pollAPI(callback) {
  let apiUrl = url.parse(conf.url);

  let options = {
    'protocol': apiUrl.protocol,
    'hostname': apiUrl.hostname,
    'port': apiUrl.port,
    'path': apiUrl.path,
    'query': apiUrl.query,
    'method': 'GET',
    'User-Agent': uagent
  };

  https.get(options, (response) => {
    let rawData = '';

    let xrates = {
      'used': response.headers['X-Ratelimit-Used'],
      'remd': response.headers['X-Ratelimit-Remaining'],
      'rest': response.headers['X-Ratelimit-Reset']
    };

    console.log(`X-Ratelimits: ${JSON.stringify(xrates, null, 2)}`);

    response.on('data', (chunk) => {
      rawData += chunk;
    });

    response.on('end', () => {
      callback(rawData, null);
    }).on('error', (e) => {
      callback(null, e);
    });
  });
}

function remove_fields(root, fields = [], depth = 0) {
  if (root !== null && root !== undefined && (Array.isArray(root) || typeof root === "object")) {
    Object.keys(root).forEach((key) => {
      fields.forEach((field) => {
        if (key === "selftext") {
          console.log(`${key} === ${field}`);
        }
        if (key === field) {
          root[key] = '';
        }
      });

      if (Array.isArray(root) || typeof root === "object") {
        root[key] = remove_fields(root[key], fields, depth+1);
      }
    });
  }

  return root;
}

main();
