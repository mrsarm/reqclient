reqclient CHANGELOG
===================

2.3.0
-----

* Added `fullResponse` option to return the full response instead
  of just the body.

2.2.0
-----

* Fixed array parameters in "query" object parsed as
  unique param in URIs.

2.1.0
-----

* Use to output logs `logger.info()` instead of `logger.log()`
  to be compliant with external loggers.

2.0.2
-----

* Fixed OAuth2 login with unauthorized error response with JSON
  format are propagated as a string message error.
* Fixed OAuth2 token expiration check where there is no
  expiration defined.

2.0.1
-----

* Fixed quote character used when system environment variables are
  used in _cURL_ logging.

2.0.0
-----

* Added HTTP Authentication support.
* Added OAuth2 Authentication support.
* Added full URL parameter support on each call.
* If `debugResponse` is activated and a response has
  HTTP Status >= 400 it will log with `error` severity.
* Added an optional parameter `options` to all public method
  to override the default options.

### Backward incompatible changes

* `_prepareOptions()` method now builds the request options in
  async mode returning a `Promise`, useful to add options obtained
  from external resources without blocking the execution, like an
  access token from an OAuth server.
* The new `options` parameter replace the `cacheTtl` parameter
  in the `get()` method. Now this parameter is a optional property
  inside the `options` parameter (eg. `{cacheTtl: 60, ...}`).


1.2.2
-----

* Fixed mutable header issue.


1.2.1
-----

* Fixed formData debug with `null` values.


1.2.0
-----

* Improvements in `form` and `formData` submits, useful
  to send files.
* Use `encodeURIComponent()` to encode query parameters.


1.1.1
-----

* Fixed query parameter binding issue.
* Minor fix in README.


1.1.0
-----

* Added config option `encodeQuery` to encode "unsafe" characters
  in the URL query parameters.
* Fixed cURL debug output to not add content-type header
  if it's a GET or DELETE request (no body present).


1.0.0
-----

* Added cache support.
* Added default headers configuration.
* Refactor how config options is passed to
  the constructor class.
* Improvements in README docs.


0.1.1
-----

* Fixed "DELETE" method.
* Fixed README docs


0.1.0
-----

Initial source code.
