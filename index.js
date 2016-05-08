// Copyright 2016 Mariano Ruiz <mrsarm@gmail.com>
//
//    Licensed under the Apache License, Version 2.0 (the "License");
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
//
//        http://www.apache.org/licenses/LICENSE-2.0
//
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an "AS IS" BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.

'use strict';

"use strict";

var request = require('request');

/**
 * Wrapper class of the HTTP client module `request` that makes request
 * in an asynchronous way, returning `Promise` objects to handle the
 * responses without blocking the execution, and removes
 * boilerplate configurations on each request: base URL, time out,
 * content type format and error handling.
 */
class RequestClient {

  /**
   *
   * @param baseUrl The base URL for all the request
   * @param defaultTimeout (optional) The TTL of the request
   * @param contentType (optional, default `json`) Content type,
   *        valid values: `json`, `form` or `formData`
   * @param logger (optional, by default uses the `console` object)
   *        The logger used to debug requests and log errors
     */
  constructor(baseUrl, defaultTimeout, contentType, logger) {
    this.baseUrl = baseUrl;
    if (baseUrl[baseUrl.length-1]!="/") {
      this.baseUrl += "/";
    }
    this.defaultTimeout = defaultTimeout;
    this.contentType = contentType || 'json';
    this.logger = logger || console;
  }
  request(method, uri, data, headers) {
    var self = this;
    return new Promise(function(fulfill, reject) {
      var options = self._prepareOptions(uri, headers, data);
      options.method = method;
      request(options, function(error, httpResponse, body) {
        if (httpResponse!=undefined && httpResponse.statusCode < 400) {
          fulfill(self._prepareResponseBody(body), httpResponse);   // Successful request
        } else if (error) {
          self._handleError(error, options["url"], method, reject); // Fatal client or server error (unreachable server, time out...)
        } else {
          reject(self._prepareResponseBody(body));                  // The server response has status error, due mostly by a wrong client request
        }
      });
    });
  }
  get(uri, headers) {
    return this.request('GET', uri, undefined, headers);
  }
  post(uri, data, headers) {
    return this.request('POST', uri, data, headers);
  }
  patch(uri, data, headers) {
    return this.request('PATCH', uri, data, headers);
  }
  put(uri, data, headers) {
    return this.request('PUT', uri, data, headers);
  }
  delete(uri, headers) {
    return this.request('DELETE', uri, data, headers);
  }

  // If the response body is a JSON -> parse it to return as a JSON object.
  _prepareResponseBody(body) {
    try {
      if (typeof body == "string" && this.contentType == 'json') body = JSON.parse(body);
    } catch (err) {}
    return body;
  }

  // Prepare the request [options](https://www.npmjs.com/package/request#requestoptions-callback)
  _prepareOptions(uri, headers, data) {
    if (typeof uri == 'object') {
      var query = [];
      if ("query" in uri && uri["query"]) {
        for (var k in uri["query"]) {
          query.push(k + "=" + uri["query"][k]);
        }
      }
      if ("params" in uri && uri["params"]) {
        for (var k in uri["params"]) {
          uri["uri"] = uri["uri"].replace("{"+k+"}", uri["params"][k]);
        }
      }
      uri = uri["uri"];
      if (query.length>0) uri += "?" + query.join("&");
    }
    var options = {url: this.baseUrl + uri};
    if (headers!=undefined) {
      options["headers"] = headers;
    }
    if (data!=undefined) {
      options[this.contentType] = data;
    }
    if (this.defaultTimeout!=undefined) {
      options["timeout"] = this.defaultTimeout
    }
    return options;
  }

  // Handle the unexpected errors
  _handleError(error, url, action, reject) {
    if (['ETIMEDOUT','ECONNREFUSED','ENOTFOUND'].indexOf(error.code)>=0) {
      this.logger.error("Error doing %s to %s. %s", action, url, error);
      reject(new ConnectionError("Connection error", error));
    } else {
      reject(error);
    }
  }
}

function ConnectionError(message, cause) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  if (cause) {
    this.cause = cause;
  }
};

require('util').inherits(ConnectionError, Error);

module.exports = {
  RequestClient: RequestClient,
  ConnectionError: ConnectionError
};
