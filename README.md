reqclient - Node.js HTTP Client
===============================

`reqclient` uses module`request` to make requests, but in an
asynchronous way returning `Promise` objects, and adds useful features.

Allows most common HTTP operations: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`.


Usage
-----

The module provides the class `RequestClient`, a wrapper class of the
HTTP client module [request](https://www.npmjs.com/package/request),
but makes requests in an asynchronous way, returning
[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
objects to handle the responses without blocking
the execution, and **removes boilerplate configurations** on each
request: base URL, time out, content type format, default headers,
parameters and query binding in the URL, and error handling.

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

Options
-------

When the `RequestClient` class is instantiated, a base URL
has to be passed as a parameter, or an object with the
following options:

- `baseUrl` The base URL for all the request
- `timeout` (optional) The TTL of the request
- `contentType` (optional, default `json`) Content type, valid
  values: `json`, `form` or `formData`
- `headers` (optional) Object with default values to send as headers.
  Additional headers values can be added in the request
  call, even override these values
- `encodeQuery` (optional, default true) Encode query parameters
  replacing "unsafe" characters in the URL with the corresponding
  hexadecimal equivalent code (eg. `+` -> `%2B`)
- `cache` (optional, default false) If it's set to `true`,
  adds cache support to GET requests
- `debugRequest` (optional) If it's set to `true`, all requests
  will logged with `logger` object in a `cURL` style.
- `debugResponse` (optional) If it's set to `true`, all responses
  will logged with `logger` object.
- `logger` (optional, by default uses the `console` object)
  The logger used to log requests, responses and errors


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
