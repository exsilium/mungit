
var ko = require('knockout');
var _ = require('lodash');
var async = require('async');
var components = require('ungit-components');
var programEvents = require('ungit-program-events');
var octicon = require('octicons');

components.register('branches', function(args) {
  return new BranchesViewModel(args.server, args.repoPath);
});

function BranchesViewModel(server, repoPath) {
  var self = this;
  this.repoPath = repoPath;
  this.server = server;
  this.branches = ko.observableArray();
  this.current = ko.observable();
  this.icon = octicon['git-branch'].toSVG({ "height": 20 });
  this.fetchLabel = ko.computed(function() {
    if (self.current()) {
      return self.current();
    }
  });
  this.updateBranches();
}
BranchesViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('branches', this, {}, parentElement);
}
BranchesViewModel.prototype.clickFetch = function() { this.updateBranches(); }
BranchesViewModel.prototype.onProgramEvent = function(event) {
  if (event.event === 'working-tree-changed' || event.event == 'request-app-content-refresh' || event.event == 'branch-updated') {
    this.updateBranches();
  }
}
BranchesViewModel.prototype.checkoutBranch = function(branch) {
  var self = this;
  this.server.postPromise('/checkout', { path: this.repoPath(), name: branch.name })
    .then(function() { self.current(branch.name); });
}
BranchesViewModel.prototype.updateBranches = function() {
  var self = this;

  this.server.getPromise('/branches', { path: this.repoPath() })
    .then(function(branches) {
      const sorted = branches.filter((b) => b.name.indexOf('->') === -1)
        .map((b) => {
          if (b.current) self.current(b.name);
          b.displayName = b.name.replace('remotes/', '<span class="octicon octicon-broadcast"></span> ');
          return b;
        }).sort((a, b) => {
          const isARemote = a.name.indexOf('remotes/')
          const isBRemote = b.name.indexOf('remotes/')
          if (isARemote === isBRemote) {
            if (a.name < b.name)
               return -1;
            if (a.name > b.name)
              return 1;
            return 0;
          } else {
            return isARemote ? -1 : 1;
          }
          return 0;
        });
      self.branches(sorted);
    }).catch(function(err) { self.current("~error"); });
}

BranchesViewModel.prototype.branchRemove = function(branch) {
  var self = this;
  components.create('yesnodialog', { title: 'Are you sure?', details: 'Deleting ' + branch.name + ' branch cannot be undone with ungit.'})
    .show()
    .closeThen(function(diag) {
      if (!diag.result()) return;
      self.server.delPromise('/branches', { name: branch.name, path: self.repoPath() })
        .then(function() { programEvents.dispatch({ event: 'working-tree-changed' }); });
    });
}
