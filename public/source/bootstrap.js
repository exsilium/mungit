/*
 * Import the Bootstrap components individually.
 *
 * Bootstrap 5 removed the jQuery plugins, so importing these no longer defines
 * $.fn.dropdown / $.fn.modal / $.fn.tooltip. Importing dropdown and modal still
 * registers their data-api handlers, so `data-bs-toggle="dropdown"` keeps
 * working declaratively. Tooltips are opt-in and are initialised in main.js;
 * modals are driven imperatively from components/app/app.js.
 */

module.exports = {
  Dropdown: require('bootstrap/js/dist/dropdown'),
  Modal: require('bootstrap/js/dist/modal'),
  Tooltip: require('bootstrap/js/dist/tooltip'),
};
