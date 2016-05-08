reqclient - Node.js HTTP Client
===============================

`reqclient` uses module`request` to make requests, but in an
asynchronous way returning `Promise` objects, and adds useful functions.

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
base URL, time out, content type format and error handling.

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


About
-----

Source code of this project: https://github.com/mrsarm/reqclient

Author: Mariano Ruiz <mrsarm@gmail.com>

2016  |  Apache-2.0
