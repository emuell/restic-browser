import * as mobx from 'mobx';

// -------------------------------------------------------------------------------------------------

export class AppState {

  @mobx.observable
  repoPath: string = "";

  @mobx.observable
  repoPass: string = "";

  @mobx.observable
  repoError: string = "";

  constructor() {
    mobx.makeObservable(this);
  }
}

// -------------------------------------------------------------------------------------------------

export const appState = new AppState();