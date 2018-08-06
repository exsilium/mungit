
var ko = require('knockout');
var _ = require('lodash');
var async = require('async');
var components = require('ungit-components');
var programEvents = require('ungit-program-events');
const showRemote = 'showRemote';
var octicon = require('octicons');
const showBranch = 'showBranch';
const showTag = 'showTag';

components.register('branches', function(args) {
  return new BranchesViewModel(args.server, args.graph, args.repoPath);
});

function BranchesViewModel(server, graph, repoPath) {
  var self = this;
  this.repoPath = repoPath;
  this.server = server;
  this.branchesAndLocalTags = ko.observableArray();
  this.current = ko.observable();
  this.isShowRemote = ko.observable(localStorage.getItem(showRemote) != 'false');
  this.icon = octicon['git-branch'].toSVG({ "height": 20 });
  this.isShowBranch = ko.observable(localStorage.getItem(showBranch) != 'false');
  this.isShowTag = ko.observable(localStorage.getItem(showTag) != 'false');
  this.graph = graph;
  this.isShowRemote.subscribe((value) => {
    localStorage.setItem(showRemote, value);
    this.updateRefs();
    return value;
  });
  this.isShowBranch.subscribe((value) => {
    localStorage.setItem(showBranch, value);
    this.updateRefs();
    return value;
  });
  this.isShowTag.subscribe((value) => {
    localStorage.setItem(showTag, value);
    this.updateRefs();
    return value;
  });
  this.fetchLabel = ko.computed(function() {
    if (self.current()) {
      return self.current();
    }
  });
  this.updateRefsDebounced = _.debounce(this.updateRefs, 500);
}
BranchesViewModel.prototype.updateNode = function(parentElement) {
  ko.renderTemplate('branches', this, {}, parentElement);
}
BranchesViewModel.prototype.clickFetch = function() { this.updateRefs(); }
BranchesViewModel.prototype.onProgramEvent = function(event) {
  if (event.event === 'working-tree-changed' || event.event === 'request-app-content-refresh' ||
    event.event === 'branch-updated' || event.event === 'git-directory-changed') {
    this.updateRefsDebounced();
  }
}
BranchesViewModel.prototype.checkoutBranch = function(branch) {
  branch.checkout();
}
BranchesViewModel.prototype.updateRefs = function() {
  this.server.getPromise('/branches', { path: this.repoPath() })
    .then((branches) => {
      branches.forEach((b) => { if (b.current) { this.current(b.name); }});
    }).catch((err) => { this.current("~error"); });

  // refreshes tags branches and remote branches
  return this.server.getPromise('/refs', { path: this.repoPath() })
    .then((refs) => {
      const version = Date.now();
      const sorted = refs.map((r) => {
        const ref = this.graph.getRef(r.name.replace('refs/tags', 'tag: refs/tags'));
        ref.node(this.graph.getNode(r.sha1));
        ref.version = version;
        return ref;
      }).sort((a, b) => {
        if (a.current() || b.current()) {
          return a.current() ? -1 : 1;
        } else if (a.isRemoteBranch === b.isRemoteBranch) {
          if (a.name < b.name) {
             return -1;
          } if (a.name > b.name) {
            return 1;
          }
          return 0;
        } else {
          return a.isRemoteBranch ? 1 : -1;
        }
      }).filter((ref) => {
        if (ref.localRefName == 'refs/stash')     return false;
        if (ref.localRefName.endsWith('/HEAD'))   return false;
        if (!this.isShowRemote() && ref.isRemote) return false;
        if (!this.isShowBranch() && ref.isBranch) return false;
        if (!this.isShowTag() && ref.isTag)       return false;
        return true;
      });
      this.branchesAndLocalTags(sorted);
      this.graph.refs().forEach((ref) => {
        // ref was removed from another source
        if (!ref.isRemoteTag && ref.value !== 'HEAD' && (!ref.version || ref.version < version)) {
          ref.remove(true);
        }
      });
    }).catch((e) => this.server.unhandledRejection(e))
}

BranchesViewModel.prototype.branchRemove = function(branch) {
  var self = this;
  var details = `"${branch.refName}"`;
  if (branch.isRemoteBranch) {
    details = `<code style='font-size: 100%'>REMOTE</code> ${details}`;
  }
  components.create('yesnodialog', { title: 'Are you sure?', details: 'Deleting ' + details + ' branch cannot be undone with ungit.'})
    .show()
    .closeThen(function(diag) {
      if (!diag.result()) return;
      var url = '/branches';
      if (branch.isRemote) url = '/remote' + url;
      self.server.delPromise(url, { path: self.graph.repoPath(), remote: branch.isRemote ? branch.remote : null, name: branch.refName })
        .then(function() { programEvents.dispatch({ event: 'working-tree-changed' }); })
        .catch((e) => this.server.unhandledRejection(e));
    });
}
