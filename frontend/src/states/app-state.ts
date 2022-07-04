import * as mobx from 'mobx';

import { lib } from '../../wailsjs/go/models';

// -------------------------------------------------------------------------------------------------

export type RepositoryType = "local" | "sftp" | "rest" | "amazons3" | "backblaze" | "msazure";
 
export const repositoryPrefixes = new Map<RepositoryType, string>([
  ["local", ""],
  ["sftp", "sftp"],
  ["rest", "rest"],
  ["amazons3", "s3"],
  ["backblaze", "b2"],
  ["msazure", "azure"],
]);

export const repositoryCredentials = new Map<RepositoryType, string[]>([
  ["local", []],
  ["sftp", []],
  ["rest", []],
  ["amazons3", ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]],
  ["backblaze", ["B2_ACCOUNT_ID", "B2_ACCOUNT_KEY"]],
  ["msazure", ["AZURE_ACCOUNT_NAME", "AZURE_ACCOUNT_KEY"]],
]);

// -------------------------------------------------------------------------------------------------

export class AppState {

  // repository setup
  @mobx.observable.deep
  repoLocation = {
      type: "local" as RepositoryType, 
      prefix: "", 
      path: "", 
      credentials: [] as { name: string, value: string }[]  
  };

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
  resetLocation() {
    this.repoLocation.path = "";
    this.repoError = "";
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

    // create new credentials and prefix on type changes
    mobx.reaction(
      () => this.repoLocation.type, 
      () => {
        this._setPrefixFromType(); 
        this._initializeCredentials();
      })
  }
  
  @mobx.action
  private _setPrefixFromType() {
    this.repoLocation.prefix = repositoryPrefixes.get(this.repoLocation.type)!;
  }

  @mobx.action
  private _initializeCredentials() {
    const location = appState.repoLocation;
    const reqiredCredentials = repositoryCredentials.get(location.type)!;
    if (location.credentials.map(v => v.name).toString() !== reqiredCredentials.toString()) {
      location.credentials = reqiredCredentials.map((v) => {
        return { name: v, value: "" };
      })
    }
  }
}

// -------------------------------------------------------------------------------------------------

export const appState = new AppState();