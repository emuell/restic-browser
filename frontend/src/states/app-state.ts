import * as mobx from 'mobx';

import { lib } from '../../wailsjs/go/models';

// -------------------------------------------------------------------------------------------------

export class AppState {

  // repository setup
  @mobx.observable
  repoPath: string = "";

  @mobx.observable
  repoPass: string = "";

  @mobx.observable
  repoError: string = "";

  // repository content 
  @mobx.observable
  selectedSnapshotID: string = "";
  
  @mobx.observable
  snapShots: lib.Snapshot[] = [];

  @mobx.action
  setNewRepo(path: string, error: string = "") {
    this.repoPath = path;
    this.repoError = error;
    this.snapShots = [];
    this.selectedSnapshotID = "";
  }
  
  @mobx.action
  setNewSnapshots(snapShots: lib.Snapshot[], error: string = "") {
    this.repoError = error;
    this.snapShots = snapShots; 
    if (this.snapShots.findIndex((s) => s.short_id === this.selectedSnapshotID) === -1) {
      this.selectedSnapshotID = "";
    }
  }

  @mobx.action
  setNewSnapshotId(id: string) {
    if (id && this.snapShots.findIndex((s) => s.id === id) !== -1) {
      this.selectedSnapshotID = id;
    } 
    else {
      this.selectedSnapshotID = "";
    }
  }

  constructor() {
    mobx.makeObservable(this);
  }
}

// -------------------------------------------------------------------------------------------------

export const appState = new AppState();