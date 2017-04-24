reqclient - Node.js HTTP Client
===============================

`reqclient` uses module`request` to make requests, but adds
`Promise` supports, and many useful features, like `curl` logging
and **OAuth2** integration.


Usage
-----

The module provides the class `RequestClient`, a wrapper class of the
HTTP client module [request](https://www.npmjs.com/package/request),
but makes requests returning
[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
objects to handle the responses without blocking
the execution, and **removes boilerplate configurations** on each
request: base URL, time out, content type format, default headers,
parameters and query formatting in the URL, authentication,
and error handling.

Also support **in-memory cache** of GET responses, and allows to
**log all operations** in `cURL` syntax style.

```js
var RequestClient = require("reqclient").RequestClient;

var client = new RequestClient("http://baseurl.com/api/");

// Simple GET with Promise handling to http://baseurl.com/api/reports/clients
client.get("reports/clients")
  .then(function(response) {
    console.log(response);  // REST responses are parsed as JSON objects
  })
  .catch(function(err) {
    console.error(err);
  });

// POST with JSON body and headers
var p = client.post("order", {"client": 1234, "ref_id": "A987"}, {headers: {"x-token": "AFF01XX"}})
// Do something with the Promise `p` ...

// GET with query (http://baseurl.com/api/orders?state=open&limit=10)
client.get({"uri": "orders", "query": {"state": "open", "limit": 10}})

// DELETE with params (http://baseurl.com/api/orders/1234/A987)
client.delete({
    "uri": "orders/{client}/{id}",
    "params": {"client": "A987", "id": 1234}
}).then(handler).catch(errorHandler);
```

Allows most common HTTP operations: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`.


Options
-------

When the `RequestClient` class is instantiated, a base URL
has to be passed as a parameter, or an object with the
following options:

- `baseUrl` The base URL for all the request
- `timeout` (optional) The TTL of the request in milliseconds
- `contentType` (optional, default `json`) Content type, valid
  values: `json`, `form` or `formData`
- `headers` (optional) Object with default values to send as headers.
  Additional headers values can be added in the request
  call, even override these values
- `auth` (optional) [HTTP Authentication](#http-authentication) options.
  The object must contain:
    - user || username
    - pass || password
    - sendImmediately (optional)
    - bearer (optional)
- `oauth2` (optional) [OAuth 2 Authorization](#oauth-2-authorization) options.
  The object must contain:
    - The same options than `config` object, otherwise inherit
      from `config` these options: `baseUrl`, `timeout`, `debugRequest`,
      `debugResponse`, `logger`, `auth`
    - `contentType` (default `form`)
    - `tokenEndpoint` (default `token` as recommended by the standard)
    - `grantType` (default `client_credentials` if `oauth2.user` isn't
      provided, otherwise `password`) The `grant_type` parameter provider
      to the endpoint to specify the authentication type
    - `user` (optional) Object with the user authentication information
      for a password grant type authentication. Should contains:
        - username
        - password
- `encodeQuery` (optional, default true) Encode query parameters
  replacing "unsafe" characters in the URL with the corresponding
  hexadecimal equivalent code (eg. `+` -> `%2B`)
- `fullResponse` (optional, default false)  If it's set to `true`,
  returns the full response instead
  of just the body (returns an object with body, statusCode, headers...)
- `cache` (optional, default false) If it's set to `true`,
  adds [cache](#cache) support to GET requests

**[Logging](#logging-with-curl-style) options**:

- `debugRequest` (optional) If it's set to `true`, all requests
  will logged with the `logger` object in a `cURL` style
- `debugResponse` (optional) If it's set to `true`, all responses
  will logged with the `logger` object
- `logger` (optional, by default uses the `console` object)
  The logger used to log requests, responses and errors

The options `timeout`, `headers`, `auth`, `encodeQuery` and `fullResponse`
can be overridden when you make a call passing in an object in the
last argument:

Get the full response instead of just the body, and set timeout to 5 seconds:

```js
client.put({uri:"stats/{id}", params: {id: 555}}, {val:1,type:2}, {fullResponse: true, timeout: 5000})
.then(httpResponse => {
  if (httpResponse.statusCode == 201) {
    // Registry created, do something with httpResponse.body ...
  } else if (httpResponse.statusCode == 200) {
    // Registry updated, do something with httpResponse.body ...
  } else {
    // Do something
  }
});
```

Add an extra-header (or override a default one from the constructor object):

```js
client.post("users", {"name":"Mika"}, {headers: {"x-token": "fake_token"}})
```


URL formatting
--------------

`reqclient` supports format the given URI on each call concatenating
with the `baseUrl` provided in the constructor + query binding
with a given object. This is useful mostly
for two reasons: avoid **boilerplate formatting** and **URL injection**
attacks when the URL parameters comes from a user form.

In the first parameter of any call you can specify a simple URI string
like this: `reports/sales`, and in the example if the `baseUrl`
has the value `https://api.erp.example.com/v1`, then the final
URL will be https://api.erp.example.com/v1/reports/sales.

But if you want to provide some URL parameters to the previous example,
and the data comes from a user form, the user can inject more
parameters than the allowed by the system if you do a simple
string concatenation. With `reqclient` module, you can format
the URL from an object containing the URL and the parameters, it's
more secure, easy, and `reqclient` also takes care of encode all
characters of the parameters to generate a valid URL.

Supposing your parameters are in an object at `req.query`:

```js
var client = new RequestClient("https://api.erp.example.com/v1");
client.get({
  "uri": "reports/sales",
  "query": {
    "location": req.query.location, //-> = "Buenos Aires"
    "limit": req.query.limit,       //-> = "20"
    "index": 0
  }
}).then(resp => { /* Do something with the response... */ });
// GET to https://api.erp.example.com/v1/reports/sales?location=Buenos%20Aires&limit=20&index=0
```

In **REST services** is also useful to provide _resource parameters_ in
the URI, like the ID of a client or an order number. This kind of URI are
represented like this: `/path/{resourceId}/to/{anotherResourceId}`, and
have the same issues: repetitive parsing and are exposed to URL injection.

For the previous example, supposing you want just the sales of a given
client and for a given "status":

```js
client.get({
  "uri": "reports/{clientId}/sales/{status}",
  "query": {
    "location": req.query.location, //-> = "Güemes"
    "limit": req.query.limit,       //-> = "20"
    "index": 0
  },
  "params": {
    "clientId": clientObj.id,       //-> "1234"
    "status": "done"
  }
}).then(resp => { /* ... */ }).catch(err => /* Oh my God... */);
// GET to https://api.erp.example.com/v1/reports/1234/sales/done?location=G%C3%BCemes&limit=20&index=0
```

Note that in both cases the _"location"_ parameter have blank spaces or
diacritics characters than in the final URL they were encoded. You can
avoid the URL parameter encoding passing to the `RequestClient` config
option the value `encodeQuery: false` (default to true).

When you make a call with a string, or an URI object containing
the URI string, if the string starts with "http://" or "https://", then
the concatenation with the `baseUrl` is avoided.


Logging with cURL style
-----------------------

By default `reqclient` uses the global `console` object to log
the activity, and only logs error responses by default.
But when the `RequestClient` object is created, you can configure
it to log all the requests made, and/or the responses.

If you set `debugRequest: true` in the constructor, all requests
will logged with a `cURL` syntax format _(awesome!)_. This is really
useful in development phase, when you need to know what it's doing your
application, and you need to reproduce the calls outside the application.

And with `debugResponse: true` all the responses will logged, both
the HTTP status and the HTTP body.

```js
var RequestClient = require("reqclient").RequestClient;
var client = new RequestClient({
        baseUrl: "http://baseurl.com/api/v1.1",
        debugRequest: true, debugResponse: true
    });

client.post("client/orders", {"client": 1234, "ref_id": "A987"}, {headers: {"x-token": "AFF01XX"}});
```

This will log:

    [Requesting client/orders]-> -X POST http://baseurl.com/api/v1.1/client/orders -d '{"client": 1234, "ref_id": "A987"}' -H '{"x-token": "AFF01XX"}' -H Content-Type:application/json

And when the response is returned ...

    [Response   client/orders]<- Status 200 - {"orderId": 1320934}

To use other logger instead of the `console` object, you need to
pass the logger object to the constructor in the `logger` option.

For example, if you want to use [Winston](https://www.npmjs.com/package/winston)
to log both to the console and to a local file:

```js
let RequestClient = require('reqclient').RequestClient;
let winston       = require('winston');

winston.add(winston.transports.File, { filename: 'app.log' });

let client = new RequestClient({
  baseUrl: "http://httpbin.org"
  ,debugRequest:true, debugResponse:true
  ,logger: winston
  ,timeout: 10000
});

client.get(uri, options);  // The response will output to
                           // the console and the app.log file
```

*Winston* has many options, and integrations like
[winston-cloudwatch](https://www.npmjs.com/package/winston-cloudwatch) to
log to the *AWS CloudWatch Logs* platform.

**NOTE**: The logging chosen can affect performance, and most important,
it might have information security implications for your deployment,
because the logger doesn't filter any sensitive data, like passwords,
tokens, and private information. **Don't** set `debugRequest`
or `debugResponse` to `true` in production environments.

Cache
-----

By default `reqclient` doesn't cache results. You can activate cache
of GET responses passing to its constructor config the
option `cache: true`. Then, if you add the `{cacheTtl: SECONDS}` option
in a `get()` call, the module will cache the result to return the
same response the next call without accessing to the endpoint
again. If the `RequestClient` object isn't initialized with the
`cache` option, the `cacheTtl` option in the request calls will ignored.

```js
var client = new RequestClient({baseUrl:"https://myapp.com/api/v1", cache:true});
// GET to "https://myapp.com/api/v1/orders?state=open&limit=10" and cache for 60 seconds 
client.get({ "uri": "orders", "query": {"state": "open", "limit": 10} }, {cacheTtl: 60})
```

**NOTE**: In subsequence calls the response will be read from the cache only if
the `cacheTtl` option is present in the request.

This library use the `node-cache` module to create the _in-memory_
cache. If you activate this feature, you need to add this dependency in your
project.

In the example above, the cache will expire in 60 seconds, but you have
to consider that if you make a POST/PUT/PATCH and alter the data
(or another system do), the cache will be inconsistent, because the cache
is not updated automatically (see bellow how to clean the cache).

Also take in consideration that the cache is saved in a key value store,
and the key is the `uri` object passed to the GET call, so, if you make
request passing parameters through header parameters instead of URI
parameters, the cache system will be inconsistent with the real result.

### Clear the cache manually

if you need to clear the cache manually, you can call `deleteFromCache()`
method, passing the URI as a key of the response to delete.
The URI could be a string or an object in the same format as
in the `get()` calls.

```js
// Delete the response cached in the example of the previous section
client.deleteFromCache({ "uri": "orders", "query": {"state": "open", "limit": 10} })
// This will delete the same value cached, but the URI is passed as a string
client.deleteFromCache("orders?state=open&limit=10")
```


Upload files
------------

To upload files, the `RequestClient` class has to be
initialized with `contentType: "formData"`. If it was
initialized with `json` (the default value), in the upload call
can be specified in the header POST parameter with the
option `"Content-Type": "multipart/form-data"`.

```js
client.post("profile/upload-photo",
            { "file": fs.createReadStream("mypic.jpg"), "id": 1234 },
            { "headers": {"Content-Type": "multipart/form-data"} } )
  .then(jsonResult => console.log("New photo URL: " + jsonResult.url))
  .catch(err => console.log("Something goes wrong with the upload: " + err));
```

If the logging with cURL style is activated, it will log something
like this:

    [Requesting profile/upload-photo]-> -X POST http://localhost:8080/api/profile/upload-photo -F "file=@mypic.jpg" -F "id=1234" -H 'Content-Type:multipart/form-data'
    [Response   profile/upload-photo]<- Status 200 - {"url":"http://localhost:8080/api/profile/43535342535/mypic.jpg","success":true}
    New photo URL: http://localhost:8080/api/profile/43535342535/mypic.jpg


HTTP Authentication
-------------------

`reqclient` inherit the HTTP Authentication mechanism from the
[request module](https://www.npmjs.com/package/request#http-authentication).

The configuration is passed as an option parameter called `auth` in
the constructor, and should be an object containing the values:

- user || username
- pass || password
- sendImmediately (optional)
- bearer (optional)

```js
var client = new RequestClient({
  baseUrl:"http://localhost:5000",
  auth: {user: "admin", pass: "secret"}
});

client.get("orders").then(...)...
```

`sendImmediately`: defaults to true, causes a basic or bearer
authentication header to be sent. If sendImmediately is false, then
request will retry with a proper authentication header after receiving
a 401 response from the server (which must contain a `WWW-Authenticate`
header indicating the required authentication method).

Bearer authentication is supported, and is activated when the `bearer`
value is available. The value may be either a String or a Function
returning a String. Using a function to supply the bearer token is
particularly useful if used in conjunction with defaults to allow a
single function to supply the last known token at the time of sending
a request, or to compute one on the fly.


OAuth 2 Authorization
---------------------

There are many ways to login against an OAuth 2.0 server, this library
implements some mechanisms.

The options for the constructor object to configure OAuth2 are set in
the object `oauth2`, and because the server where you will authenticate
could be the same server you will consume endpoints or not, this objects
can receive the same global options than the constructor: `baseUrl`,
`timeout`, `auth`, `debugRequest`, ... If these options aren't provided,
they will taken from the global options.

When you configure the OAuth2 options, `reqclient` will try to login
with the OAuth2 endpoint before consume any endpoint to get the **access
token**, and if a **refresh token** is provided, it will manage the
refreshing of the access token automatically for you, or refresh it
using the same grant type method used first.

Also if for some reason your token was invalidated before the expiration
time, but an appropriate `WWW-Authenticate` header is provided in a
response (as it's specified by the standard), `reqclient` will try
authenticate one more time automatically.


### `client_credentials` grant type

```js
var client = new RequestClient({
  baseUrl: "http://localhost:8080/myapi" ,debugRequest:true
  ,oauth2: {
    auth: {
      user: 'client123'         // The username, also called "client_id"
      ,pass: 'thePass123'       // The password, also called "client_secret"
    }
  }
});

client.get("home-reports")      // First will try to login with OAuth2, then /home-reports 
.then(client.get("messages"));  // Will reuse the previous token obtained
```

The code above will log this:

    [Requesting token]-> -X POST http://localhost:8080/myapi/token -u ${CLIENT_ID}:${CLIENT_SECRET} -d 'grant_type=client_credentials'
    [Requesting home-reports]-> http://localhost:8080/myapi/home-reports -H "Authorization: Bearer ${ACCESS_TOKEN}"
    [Requesting messages]-> http://localhost:8080/myapi/messages -H "Authorization: Bearer ${ACCESS_TOKEN}"

As you can see, the first operation was get the token against an
endpoint `/token`, then the call to `/home-reports` was made
with the "bearer" token obtained in the first call, and finally
a new call to `/messages` was made also using the same token.

The default endpoint `/token` can be changed in the `oauth2.tokenEndpoint`
config object, and also the `baseUrl` used only for the OAuth2 calls:

```js
  ...
  ,oauth2: {
    baseUrl: 'https://api.example.com/oauth2'
    ,tokenEndpoint: 'login'
    ,auth: {user: 'client123', pass: 'thePass123'}
  } // OAuth against POST https://api.example.com/oauth2/login -u client123:thePass123 ...
  ...
```

#### Twitter example

Here is an example of how to consume the Twitter API to get the trending
topics, without the need to call explicitly the OAuth2
endpoint (`reqcient` do it for you ;-D):

```js
var twitterClient = new RequestClient({
  baseUrl: "https://api.twitter.com/1.1"
  ,debugRequest:true, debugResponse:true  // Just to log the requests, do not leave this in PROD
  ,timeout: 5000
  ,oauth2: {
    baseUrl: "https://api.twitter.com/oauth2",
    auth: {user: 'CusumerKeyXXXXX', pass: 'ConsumerSecretYYYYYYY'}
  }
});
twitterClient.get({uri: "trends/place.json", query: {id: 1}});
```

This will [log](#logging-with-curl-style) something like this:

    [Requesting token]-> -X POST https://api.twitter.com/oauth2/token -u ${CLIENT_ID}:${CLIENT_SECRET} -d 'grant_type=client_credentials' --connect-timeout 5
    [Response   token]<- Status 200 - {"token_type":"bearer","access_token":"AAAAAAAAAAAAAAAAAAAAAJVbxgAAAAAATO7NfeOihdbfg634hd8fhd35gftfhfTtovgdgFxghO561FfdggT5c0EkLng4yBEwght3bfDGf47hbSk3"}
    [Requesting trends/place.json]-> https://api.twitter.com/1.1/trends/place.json?id=1 -H "Authorization: Bearer ${ACCESS_TOKEN}" --connect-timeout 5
    [Response   trends/place.json]<- Status 200 - [{"trends":[{"name":"#CiberAtaque","url":"http:\/\/twitter.com\/search?q=%23CiberAtaque","promoted_content":null,"query":"%23CiberAtaque","tweet_volume":19537},{"name":"DDoS","url":"http:\/\/twitter.com\/search?q=DDoS","promoted_content":null,"query":"DDoS","tweet_volume":241579},{"name":"#MafiaSdvConfessoQue","url":"http:\/\/twitter.com\/search?q=%23MafiaSdvConfessoQue","promoted_content":null,"query":"%23MafiaSdvConfessoQue","tweet_volume":null},{"name":"#WhatImGoodAt","url":"http:\/\/twitter.com\/search?q=%23WhatImGoodAt","promoted_content":null,"query":"%23WhatImGoodAt","tweet_volume":null},{"name":"#tvoh","url":"http:\/\/twitter.com\/search?q=%23tvoh","promoted_content":null,"query":"%23tvoh","tweet_volume":null},{"name":"#BlackMirror","url":"http:\/\/twitter.com\/search?q=%23BlackMirror","promoted_content":null,"query":"%23BlackMirror","tweet_volume":14395},{"name":"#MiCuerpoPide","url":"http:\/\/twitter.com\/search?q=%23MiCuerpoPide","promoted_content":null,"query":"%23MiCuerpoPide","tweet_volume":null},{"name":"#QueHacerSiSeCaeTwitter","url":"http:\/\/twitter.com\/search?q=%23QueHacerSiSeCaeTwitter","promoted_content":null,"query":"%23QueHacerSiSeCaeTwitter","tweet_volume":null},{"name":"#GrahamNorton","url":"http:\/\/twitter.com\/search?q=%23GrahamNorton","promoted_content":null,"query":"%23GrahamNorton","tweet_volume":null}],"as_of":"2016-10-21T22:25:06Z","created_at":"2016-10-21T22:19:40Z","locations":[{"name":"Worldwide","woeid":1}]}]



### `password` grant type

To authenticate against an OAuth 2 server with a _username/password + client_id/client_secret_,
the credentials must be set the in a `user` object inside the `oauth2` object with the
username and password:

```js
var client = new RequestClient({
  baseUrl: "http://localhost:8080/myapi" ,debugRequest:true
  ,oauth2: {
    auth: {
      user: 'client123'             // client_id
      ,pass: 'thePass123'           // client_secret
    }
    ,user: {
      username: "myname@mail.com"   // The user of a "real" user
      ,password: "password1234"
    }
  }
});
```

This will log in _cURL_ format something like this:

    [Requesting token]-> -X POST http://localhost:8080/myapi/token -u ${CLIENT_ID}:${CLIENT_SECRET} -d 'grant_type=password' -d 'username=myname@mail.com' -d "password=${PASSWORD}"


Requirements
------------

- Node.js 4.4+ (supports Javascript classes).
- `request` module.
- `node-cache` if the cache features are used.


About
-----

**Source code**: https://github.com/mrsarm/reqclient

**Author**: Mariano Ruiz <mrsarm@gmail.com>

2016  |  Apache-2.0
