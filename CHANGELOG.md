reqclient CHANGELOG
===================


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
