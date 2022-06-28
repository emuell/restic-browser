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

  constructor() {
    mobx.makeObservable(this);
  }
}

// -------------------------------------------------------------------------------------------------

export const appState = new AppState();