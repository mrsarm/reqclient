reqclient - Node.js HTTP Client
===============================

`reqclient` uses module`request` to make requests, but adds
`Promise` supports, and many useful features.


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

// Simple GET with Promise handling
client.get("reports/clients")
  .then(function(response) {
    console.log(response);  // REST responses are parsed as JSON objects
  })
  .catch(function(err) {
    console.error(err);
  });

// POST with JSON body and headers
var p = client.post("order", {"client": 1234, "ref_id": "A987"}, {"x-token": "AFF01XX"})
// Do something with the Promise `p` ...

// GET with query (http://baseurl.com/api/orders?state=open&limit=10)
client.get({"uri": "orders", "query": {"state": "open", "limit": 10}})

// DELETE with params (http://baseurl.com/api/orders/1234/A987)
client.delete({
    "uri": "orders/{client}/{id}",
    "params": {"client": "A987", "id": 1234}
}).then(handler).catch(errorHanler);
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
- `encodeQuery` (optional, default true) Encode query parameters
  replacing "unsafe" characters in the URL with the corresponding
  hexadecimal equivalent code (eg. `+` -> `%2B`)
- `cache` (optional, default false) If it's set to `true`,
  adds [cache](#cache) support to GET requests

**[Logging](#logging-with-curl-style) options**:

- `debugRequest` (optional) If it's set to `true`, all requests
  will logged with `logger` object in a `cURL` style.
- `debugResponse` (optional) If it's set to `true`, all responses
  will logged with `logger` object.
- `logger` (optional, by default uses the `console` object)
  The logger used to log requests, responses and errors


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

By default `reqclient` uses the standard `console` object for the
log activity, and only logs error responses. But when the `RequestClient`
object is created, the constructor parameters passed can
override this behavior (see above section).

In case the request activity is logged, the `_debugRequest()` method
will print with a `cURL` syntax format _(awesome!)_. This is really
useful in development phase, when you need to know what it's doing your
application, and you need to reproduce the calls outside the application.

```js
var RequestClient = require("reqclient").RequestClient;
var client = new RequestClient({
        baseUrl: "http://baseurl.com/api/v1.1",
        debugRequest: true, debugResponse: true
    });

client.post("client/orders", {"client": 1234, "ref_id": "A987"}, {"x-token": "AFF01XX"})
/* This will log ...
[Requesting client/orders]-> -X POST http://baseurl.com/api/v1.1/client/orders -d '{"client": 1234, "ref_id": "A987"}' -H '{"x-token": "AFF01XX"}' -H Content-Type:application/json
And when the response is returned ...
[Response   client/orders]<- Status 200 - {"orderId": 1320934} */

```

**NOTE**: The logging chosen can affect performance, and most important,
it might have information security implications for your deployment,
because the logger doesn't filter any sensitive data, like passwords,
tokens, and private information. Don't set `debugRequest`
or `debugResponse` to `true` in production environments.


Cache
-----

By default `reqclient` doesn't cache results. You can activate cache
of GET responses passing to its constructor config the
option `cache: true`. Then, if you add the `ttl` parameter (in seconds)
in a `get()` call, the module will cache the result to return the
same response the next call without accessing to the endpoint
again. If the `RequestClient` object isn't initialized with the
`cache` option, the `ttl` parameter in the request calls will ignored.

```js
var client = new RequestClient({baseUrl:"https://myapp.com/api/v1", cache:true});
// GET to "https://myapp.com/api/v1/orders?state=open&limit=10" and cache for 60 seconds 
client.get({ "uri": "orders", "query": {"state": "open", "limit": 10} }, {}, 60 /* seconds */)
```

This library use the `node-cache` module to create the _in-memory_
cache. If you activate this feature, you need to add this dependency in your
project.

In the example above, the cache will expire in 60 seconds, but you have
to consider that if you make a POST/PUT/PATCH and alter the data
(or another system do), the cache will be inconsistent, because the cache
is not updated automatically.

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
initialized with `json` (the default value), the upload
can be specified in the header POST parameter with the
option `"Content-Type": "multipart/form-data"`.

```js
client.post("profile/upload-photo",
            { "file": fs.createReadStream("mypic.jpg"), "id": 1234 },
            {"Content-Type": "multipart/form-data"} )
  .then(jsonResult => console.log("New photo URL: " + jsonResult.url))
  .catch(err => console.log("Something goes wrong with the upload: " + err));
```

If the logging with cURL style is activated, it will log something
like this:

    [Requesting profile/upload-photo]-> -X POST http://localhost:8080/api/profile/upload-photo -F 'file=@mypic.jpg' -F 'id=1234' -H 'Content-Type:multipart/form-data'
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
