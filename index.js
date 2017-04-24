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

var request = require('request');
var ReadStream = require("fs").ReadStream;

/**
 * Wrapper class of the HTTP client module `request` that makes request
 * in an asynchronous way, returning `Promise` objects to handle the
 * responses without blocking the execution, and removes
 * boilerplate configurations on each request: base URL, time out,
 * content type format and error handling.
 * Also allows log all operations, with `cURL` format.
 */
class RequestClient {

  /**
   * @param config A string with the the base URL, or an object with the following configuration:
   * - baseUrl The base URL for all the request
   * - timeout (optional) The TTL of the request in milliseconds
   * - contentType (optional, default 'json') Content type,
   *               valid values: 'json', 'form' or 'formData'
   * - headers (optional) Object with default values to send as headers.
   *           Additional headers values can be added in the request
   *           call, even override these values
   * - auth (optional) HTTP Authentication options. The object must contain:
   *     - user || username
   *     - pass || password
   *     - sendImmediately (optional)
   *     - bearer (optional)
   * - oauth2 (optional) OAuth 2.0 Authorization options. The object must contain:
   *     - The same options than `config` object, otherwise inherit from `config` these options:
   *       baseUrl, timeout, debugRequest, debugResponse, logger, auth
   *     - contentType (default 'form')
   *     - tokenEndpoint (default 'token' as recommended by the standard)
   *     - grantType (default 'client_credentials' if `oauth2.user` isn't provided, otherwise 'password')
   *     - user (optional) Object with the user authentication for a password grant type authentication. Should contains:
   *         - username
   *         - password
   * - encodeQuery (optional, default true) Encode query parameters
   *               replacing "unsafe" characters in the URL with the corresponding
   *               hexadecimal equivalent code (eg. "+" -> "%2B")
   * - fullResponse (optional, default false)  If it's set to `true`, returns the full response instead
   *                of just the body (returns an object with body, statusCode, headers...)
   * - cache (optional, default false) If it's set to `true`,
   *         adds cache support to GET requests
   * - debugRequest (optional) If it's set to `true`, all requests
   *                will logged with `logger` object in a `cURL` style.
   * - debugResponse (optional) If it's set to `true`, all responses
   *                 will logged with `logger` object
   * - logger (optional, by default uses the `console` object)
   *          The logger used to log requests, responses and errors
   */
  constructor(config) {
    if (typeof(config)!='string') {
      this.baseUrl = config.baseUrl;
      if (this.baseUrl[this.baseUrl.length - 1] != "/") {
        this.baseUrl += "/";
      }
      this.timeout = config.timeout;
      this.contentType = config.contentType || 'json';
      this.debugRequest = config.debugRequest || false;
      this.debugResponse = config.debugResponse || false;
      this.logger = config.logger || console;
      this.headers = config.headers || {};
      this.encodeQuery = config.encodeQuery!=undefined ? config.encodeQuery : true;
      this.fullResponse = config.fullResponse!=undefined ? config.fullResponse : false;
      if (config.cache) {
        this._initCache();
      }

      // HTTP Auth
      if (config.auth) {
        this.auth = config.auth;
      }

      // OAuth2
      if (config.oauth2) {
        this.oauth2 = Object.assign({}, config.oauth2);
        this.oauth2.tokenEndpoint = config.oauth2.tokenEndpoint ? config.oauth2.tokenEndpoint : "token";
        if (config.oauth2.grantType) {
          this.oauth2.grantType = config.oauth2.grantType;
        }
        if (config.oauth2.user) { // This object should have "username" and "password" fields
          this.oauth2.user = config.oauth2.user;
          if (!this.oauth2.grantType) this.oauth2.grantType = "password";
        } else if (!this.oauth2.grantType) {
          this.oauth2.grantType = "client_credentials";
        }

        var oauth2Config = {};
        oauth2Config.baseUrl = this.oauth2.baseUrl ? this.oauth2.baseUrl : this.baseUrl;
        oauth2Config.contentType = this.oauth2.contentType ? this.oauth2.contentType : "form";
        oauth2Config.debugRequest = this.oauth2.debugRequest!=undefined ? this.oauth2.debugRequest : this.debugRequest;
        oauth2Config.debugResponse = this.oauth2.debugResponse!=undefined ? this.oauth2.debugResponse : this.debugResponse;
        oauth2Config.logger = this.oauth2.logger ? this.oauth2.logger : this.logger;
        oauth2Config.auth = this.oauth2.auth ? this.oauth2.auth : this.auth;
        oauth2Config.timeout = this.oauth2.timeout ? this.oauth2.timeout : this.timeout;
        this.oauth2._client = new RequestClient(oauth2Config);
      }
    } else {
      this.baseUrl = config;
    }
  }

  request(method, uri, data, options) {
    if (this.cache && method=='GET' && options && options.cacheTtl!=undefined) {
      var self = this;
      return new Promise((resolve, reject) => {
        var parsedUri = self._parseUri(uri, options);
        self.cache.get(parsedUri, (err, value) => {
          if (!err) {
            if (value!=undefined) {
              self._debugCacheResponse(uri, value);
              resolve(value);
            } else {
              // Do the request and save the result in the cache before returns (anyway returns in async way the promise)
              resolve(self._doRequest(method, uri, undefined, options).then(result => {
                if (typeof(options.cacheTtl)=='number') {
                  self.cache.set(parsedUri, result, options.cacheTtl, (err, success) => {
                      if (err || !success)
                        self.logger.error('Error saving "%s" in cache. %s', parsedUri, err)
                    });
                }
                return result;
              }));
            }
          } else {
            reject(err);
          }
        });
      });
    } else {
      return this._doRequest(method, uri, data, options);
    }
  }
  get(uri, options) {
    return this.request('GET', uri, undefined, options);
  }
  post(uri, data, options) {
    return this.request('POST', uri, data, options);
  }
  patch(uri, data, options) {
    return this.request('PATCH', uri, data, options);
  }
  put(uri, data, options) {
    return this.request('PUT', uri, data, options);
  }
  delete(uri, options) {
    return this.request('DELETE', uri, undefined, options);
  }

  // Delete element from local cache. The uri is the Id of the
  // response cached, and can be an string or an object like the
  // `get()` calls.
  deleteFromCache(uri) {
    if (this.cache) {
      var parsedUri = this._parseUri(uri);
      var self = this;
      this.cache.del(parsedUri, (err, count) => {
        if(err) {
          self.logger.error('Error deleting cache element "%s". %s', parsedUri, err);
        }
      });
    } else {
      // Nothing happens ...
    }
  }

  _isTokenExpired(ignoreExpiration) {
    if (ignoreExpiration==true) return true;
    return !this.tokenData.expires_in!=undefined && new Date() > this.tokenData._exp;
  }

  _prepareOAuth2Token(ignoreExpiration) {
    // TODO: Add support to pass client_id/client_secret as body argument instead
    //       of a HTTP Authentication header
    var self = this;
    if (!self.tokenData || (self._isTokenExpired(ignoreExpiration) && !self.tokenData.refresh_token)) {
      // There is no token yet, or the token expired and there is no refresh_token
      return self.oauth2._client.post(
              self.oauth2.tokenEndpoint,
              Object.assign({"grant_type": self.oauth2.grantType}, self.oauth2.user)
        )
        .then(tokenData => self._processToken(tokenData));
    }
    else if (self._isTokenExpired(ignoreExpiration) && self.tokenData.refresh_token) {
      // The token expired and there is a refresh_token
      return self.oauth2._client.post(
              self.oauth2.tokenEndpoint,
              {"grant_type": "refresh_token", "refresh_token": self.tokenData.refresh_token})
        .then(tokenData => self._processToken(tokenData));
    }
    // Return the valid token
    return Promise.resolve({ "bearer": self.tokenData.access_token} );
  }

  _processToken(tokenData) {
    if (typeof(tokenData) == 'string') {
      tokenData = JSON.parse(tokenData);
    }
    if (tokenData.token_type && tokenData.token_type.toLowerCase()!="bearer") {
      throw new Error('Unknown token type "' + tokenData.token_type + '"');
    }
    this.tokenData = tokenData;
    if (this.tokenData.expires_in) {
      this.tokenData._exp = new Date(new Date().getTime() + (this.tokenData.expires_in * 1000));
    }
    return { "bearer": this.tokenData.access_token };
  }

  _doRequest(method, uri, data, options) {
    var self = this;
    return self._prepareReqOptions(method, uri, data, options).then((reqOptions) => {
      return new Promise((resolve, reject) => {
        self._debugRequest(reqOptions, uri);
        request(reqOptions, (error, httpResponse, body) => {
          self._handleResponse(error, httpResponse, body,
                               method, uri, data, reqOptions,
                               resolve, reject);
        });
      });
    });
  }

  _handleResponse(error, httpResponse, body,      // Response
                  method, uri, data, reqOptions,  // Input given
                  resolve, reject,                // Resolvers
                  ignoreAuthError)                // Ignore 'WWW-Authenticate' header ¿?
  {
    var self = this;
    if (error) {
      return self._handleError(error, uri, reqOptions, reject); // Fatal client or server error (unreachable server, time out...)
    }
    self._debugResponse(uri, httpResponse.statusCode, body);
    if (httpResponse.statusCode < 400) {
      return resolve(self._prepareResponseBody(body, httpResponse, reqOptions));      // Successful request
    }
    if (httpResponse.statusCode==401 && self.oauth2
                      && httpResponse.headers["www-authenticate"]
                      && httpResponse.headers["www-authenticate"].toLowerCase().indexOf("bearer")==0) {

      if (ignoreAuthError) {
        return reject(self._prepareResponseBody(body, httpResponse, reqOptions));
      }
      return resolve(
        self._prepareOAuth2Token(true)
          .then(token => {
            reqOptions.auth = token;
            self._debugRequest(reqOptions, uri);
            request(reqOptions, (error, httpResponse, body) => {
              self._handleResponse(error, httpResponse, body,
                                   method, uri, data, reqOptions,
                                   resolve, reject, true);
            });
          })
      );
    }
    return reject(self._prepareResponseBody(body, httpResponse, reqOptions));     // The server response has status error, due mostly by a wrong client request
  }

  // If the response body is a JSON -> parse it to return as a JSON object.
  _prepareResponseBody(body, httpResponse, reqOptions) {
    if (reqOptions.fullResponse) {
      return httpResponse;
    } else {
      try {
        if (typeof body == "string" &&
          ( this.contentType == 'json' ||
          (httpResponse && httpResponse.headers['content-type'].indexOf("application/json") >= 0) )) {
          body = JSON.parse(body);
        }
      } catch (err) {
      }
      return body;
    }
  }

  // Prepare the request [options](https://www.npmjs.com/package/request#requestoptions-callback)
  _prepareReqOptions(method, uri, data, options) {
    var self = this;
    return new Promise(resolve => {
      var reqOptions = {};
      reqOptions.method = method;
      var parsedUri = self._parseUri(uri, options);
      if (parsedUri.indexOf("http://") == 0 || parsedUri.indexOf("https://") == 0) {
        reqOptions["url"] = parsedUri;
      } else {
        reqOptions["url"] = self.baseUrl + parsedUri;
      }
      if ((options && options.headers) || self.headers) {
        if (options && options.headers) {
          reqOptions["headers"] = Object.assign({}, self.headers, options.headers);
        } else {
          reqOptions["headers"] = Object.assign({}, self.headers);
        }
      }
      if (data!=undefined) {
        if ("headers" in reqOptions && reqOptions["headers"]["Content-Type"] == "multipart/form-data") {
          reqOptions["formData"] = data;
        }
        else if ("headers" in reqOptions && reqOptions["headers"]["Content-Type"] == "application/x-www-form-urlencoded") {
          reqOptions["form"] = data;
        } else {
          reqOptions[self.contentType] = data;
        }
      }
      if (options && options.timeout) {
        reqOptions["timeout"] = options.timeout
      } else if (self.timeout) {
        reqOptions["timeout"] = self.timeout
      }
      if (options && options.auth) {
        reqOptions["auth"] = options.auth
      } else if (self.auth) {
        reqOptions["auth"] = self.auth;
      }
      if (options && options.fullResponse!=undefined) {
        reqOptions["fullResponse"] = options.fullResponse;
      } else {
        reqOptions["fullResponse"] = self.fullResponse;
      }
      resolve(reqOptions);
    }).then(reqOptions => {
      if (self.oauth2) {
        return self._prepareOAuth2Token().then(auth => {
          reqOptions.auth = auth;
          return reqOptions;
        });
      } else {
        return reqOptions;
      }
    });
  }

  // If the `uri` is an object like `{ "uri": "users/{id}", "params": {"id": 1234}, "query": {"summarize": true, "info": "sales"} }`,
  // parse it as a full URI string: "users/1234?summarize=true&info=sales"
  _parseUri(uri, options) {
    var uriOpt = uri;
    if (typeof(uri)=='object') {
      uriOpt = Object.assign({}, uri);
      var query = [];
      if ("query" in uri && uri["query"]) {
        var encodeQuery = options!=undefined && options.encodeQuery!=undefined ? options.encodeQuery : this.encodeQuery;
        for (var k in uri["query"]) {
          var values = uri["query"][k] instanceof Array ? uri["query"][k] : [uri["query"][k]];
          for (var value of values) {
            if (encodeQuery && typeof(value) == 'string') {
              value = encodeURIComponent(value);
            }
            query.push(k + "=" + value);
          }
        }
      }
      if ("params" in uri && uri["params"]) {
        for (var k in uri["params"]) {
          uriOpt["uri"] = uriOpt["uri"].replace("{"+k+"}", uri["params"][k]);
        }
      }
      uriOpt = uriOpt["uri"];
      if (query.length>0) uriOpt += "?" + query.join("&");
    }
    return uriOpt;
  }

  // Debug request in cURL format
  _debugRequest(options, uri) {
    if (this.debugRequest) {
      var curl = options.url;
      if (curl.indexOf('&')>0 || curl.indexOf(' ')>0) {
        curl = '"' + curl + '"';
      }
      if (options.method != 'GET') {
        curl = '-X ' + options.method + ' ' + curl;
      }
      if (options.auth) {
        if (options.auth.user || options.auth.username) {
          curl += " -u ${CLIENT_ID}:${CLIENT_SECRET}";
        } else if (options.auth.bearer) {
          curl += ' -H "Authorization: Bearer ${ACCESS_TOKEN}"';
        }
      }
      if (options[this.contentType] || options["formData"] || options["form"]) {
        var data = options[this.contentType] || options["formData"] || options["form"];
        if (options["formData"] || options["form"]) {
          var quote = "'";
          for (k in data) {
            var v = data[k];
            if (v == null || v == undefined) {
              v = "";
            } else if (v instanceof ReadStream) {
              quote = '"';
              v = "@" + v.path;
            } else if (typeof(v) != 'string') {
              v = v.toString();
            } else if (["password","client_secret","access_token","refresh_token"].indexOf(k)>=0) {
              quote = '"';
              v = "${" + k.toUpperCase() + "}"; // hide sensitive data
            }
            curl += options["formData"] ? " -F " : " -d ";
            curl += quote + k + "=" + v + quote;
          }
        } else {
          if (typeof(data) != 'string' && this.contentType == "json") {
            data = JSON.stringify(data);
          }
          curl += " -d '" + data + "'";
        }
      }
      for (var k in options["headers"]) {
        curl += " -H '" + k + ":" + options["headers"][k] + "'";
      }
      if ((!options["headers"] || !options["headers"]["Content-Type"])
            && this.contentType=="json" && options.method != 'GET' && options.method != 'DELETE'
            && data!=undefined && data!=null) {
        curl += ' -H Content-Type:application/json'
      }
      if (options.timeout) {
        curl += ' --connect-timeout ' + (options.timeout / 1000.0); // ms to sec
      }
      if (typeof(uri)!='string') {
        uri = uri["uri"];
      }
      this.logger.info("[Requesting %s]-> %s", uri, curl);
    }
  }

  // Debug response status and body
  _debugResponse(uri, status, body) {
    if (this.debugResponse) {
      if (body==undefined) {
        body = "";
      } else if (typeof(body)!='string') {
        body = JSON.stringify(body);
      }
      if (status<400) {
        this.logger.info("[Response   %s]<- Status %s - %s", typeof(uri) == 'string' ? uri : uri['uri'], status, body);
      } else {
        this.logger.error("[Response   %s]<- Status %s - %s", typeof(uri) == 'string' ? uri : uri['uri'], status, body);
      }
    }
  }

  // Debug response cache
  _debugCacheResponse(uri, body) {
    if (this.debugResponse) {
      this.logger.info("[Response   %s]<- Returning from cache", typeof(uri) == 'string' ? uri : uri['uri']);
    }
  }

  // Handle the unexpected errors
  _handleError(error, uri, options, reject) {
    if (['ETIMEDOUT','ECONNREFUSED','ENOTFOUND'].indexOf(error.code)>=0) {
      if (typeof(uri)!='string') {
        uri = uri["uri"];
      }
      this.logger.error("[Error      %s]<- Doing %s to %s. %s", uri, options.method, options.url, error);
      reject(new ConnectionError("Connection error", error));
    } else {
      reject(error);
    }
  }

  // Creates the `_cache` object that manage the cache
  // that stores the GET response
  _initCache() {
    var NodeCache = require("node-cache");
    this.cache = new NodeCache();
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
