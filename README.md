reqclient - Node.js HTTP Client
===============================

`reqclient` uses module`request` to make requests, but in an
asynchronous way returning `Promise` objects, and adds useful features.

Allows most common HTTP operations: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`.
This module is in _development_ phase.


Usage
-----

The module provides the class `RequestClient`, a wrapper class of the
HTTP client module [request](https://www.npmjs.com/package/request),
but makes requests in an asynchronous way, returning
[Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
objects to handle the responses without blocking
the execution, and removes boilerplate configurations on each request:
base URL, time out, content type format and error handling. Also allows
to log all operations in `cURL` syntax style.

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
- `debugRequest` (optional) if it's set to `true`, all requests
  will logged with `logger` object in a `cURL` style.
- `debugResponse` (optional) if it's set to `true`, all responses
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
will print with a `cURL` syntax format _(awesome!)_.

```js
var RequestClient = require("reqclient").RequestClient;
var client = new RequestClient({
        baseUrl: "http://baseurl.com/api/v1.1",
        debugRequest: true,
        debugResponse: true
    });

client.post("client/orders", {"client": 1234, "ref_id": "A987"}, {"x-token": "AFF01XX"})
/* This will log ...
[Requesting client/orders]-> -X POST http://baseurl.com/api/v1.1/client/orders -d '{"client": 1234, "ref_id": "A987"}' -H '{"x-token": "AFF01XX"}' -H Content-Type:application/json
And when the response is returned ...
[Response   client/orders]<- Status 200 - {"orderId": 1320934}

```

**NOTE**: The logging chosen can affect performance, and most important, it might have information security implications for your deployment, because the logger doesn't filter any sensitive data, like passwords,
tokens, and private information. Don't set `debugRequest` or `debugResponse` to `true` in
production environments. 


About
-----

**Source code**: https://github.com/mrsarm/reqclient

**Author**: Mariano Ruiz <mrsarm@gmail.com>

2016  |  Apache-2.0
