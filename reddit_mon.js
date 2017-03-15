"use strict";

const SAVE_FILENAME = './data/data.json';

const ONE_SECOND = 1000;
const TEN_SECONDS = 10000;
const ONE_MINUTE = 60000;
const TEN_MINUTES = 600000;

const DEFAULT_POLL_TIMER = TEN_MINUTES;
const DEFAULT_RETRY_TIME = ONE_MINUTE;

function main() {
  load();

  poll();

  interval = setInterval(poll, conf.freq || DEFAULT_POLL_TIMER);
}

let conf = require('./config/main.cfg.json');
let fs = require('fs');
let https = require('https');
let lastData = undefined;
let pkg = require('./package.json');
let interval = undefined;
let nodemailer = require('nodemailer');
let transporter = nodemailer.createTransport(conf.transporter);
let uagent = `darwin:${conf.domain}:${pkg.version}`;
let url = require('url');

let mailOptions = {
  'from': '"RedditMon" <reddit.mon@ibespwn.com',
  'to': conf.destinationEmail,
  'subject': conf.emailSubject,
  'html': ''
};

function formatResults(json) {
  return json.reduce((acc, item) => {
    return acc + '<b>' + item.title + '</b><br>' + item.url + '<br><br>';
  }, '');
}

function load() {
  if (fs.existsSync(SAVE_FILENAME)) {
    lastData = require(SAVE_FILENAME);
  }
}

function save(result) {
  fs.writeFile(SAVE_FILENAME, JSON.stringify(getData(result)), (err) => {
    if (err) console.log(`Error writing file ${err}`);
  });
}

function detectNew(oldArray, newArray) {
  if (oldArray === undefined || oldArray === null || oldArray.length === 0) {
    return newArray;
  }

  return newArray.filter((item) => {
    return (oldArray.indexOf(item) === -1);
  });
}

function getSearchResultsByIds(result, ids) {
  return result.data.children.filter((child) => {
    return ids.indexOf(child.data.id) !== -1;
  }).map((child) => {
    return {
      'title': child.data.title,
      'url': child.data.url
    };
  });
}

function getData(result) {
  return result.data.children.map((child) => {
    return child.data.id;
  });
}

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

    if (xrates.used || xrates.remd || xrates.rest) {
      console.log(`X-Ratelimits: ${JSON.stringify(xrates, null, 2)}`);
    }

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

function sendMail(html) {
  mailOptions.html = html;

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }

    console.log('Message %s sent: %s', info.messageId, info.response);
  });
}

function poll() {
  pollAPI((result, err) => {
    if (result) {
      result = remove_fields(JSON.parse(result), ["selftext", "selftext_html"]);

      if (result.error) {
        console.log('Error: ' + JSON.stringify(result));

        setTimeout(poll, DEFAULT_RETRY_TIME);

        return;
      }

      //console.log(JSON.stringify(result, null, 2));
      let newData = getData(result);

      let newIds = detectNew(lastData, newData);

      if (newIds.length > 0) {
        sendMail(formatResults(getSearchResultsByIds(result, newIds)));
      }

      lastData = newData;

      save(result);
    } else {
      console.log("Error: " + err);
    }
  });
}

main();
