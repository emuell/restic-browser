import * as mobx from 'mobx';

import { DumpFile, DumpFileToTemp, GetFilesForPath, OpenFileOrUrl, OpenRepo, SelectLocalRepo } 
  from '../../wailsjs/go/lib/ResticBrowserApp';

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

/*!
 * Global application state and controller
!*/

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
  
  // loading status 
  @mobx.observable
  isLoadingSnapshots: number = 0;

  @mobx.observable
  isLoadingFiles: number = 0;

  // initialize app state
  constructor() {
    mobx.makeObservable(this);

    // auto-update credentials and prefix on location type changes
    mobx.reaction(
      () => this.repoLocation.type, 
      () => {
        this._setLocationPrefixFromType(); 
        this._setLocationCredentialsFromType();
      }
    );
  }

  // reset location, error and snapshots
  @mobx.action
  resetLocation(): void {
    this.repoLocation.path = "";
    this.repoError = "";
    this.snapShots = [];
    this.selectedSnapshotID = "";
  }

  // open a directory dialog to select a new local repository
  // throws, when the selected path does not look like a restic repository
  @mobx.action
  browseLocalRepositoryPath(): Promise<void> {
    return SelectLocalRepo()
      .then(mobx.action((directory) => {
        if (directory instanceof Error) {
          throw directory; 
        }
        if (directory) {
          appState.repoLocation.path = directory;
        }
      }))
  }

  // open a new repository and populate snapshots
  @mobx.action
  openRepository(): void {
    ++this.isLoadingSnapshots; 
    OpenRepo(lib.Location.createFrom(this.repoLocation), this.repoPass)
      .then(mobx.action((result) => {
        if (result instanceof Error) {
          throw result;
        } 
        this.repoError = "";
        this.snapShots = result;
        if (result.findIndex((s) => s.short_id === this.selectedSnapshotID) === -1) {
          this.selectedSnapshotID = "";
        }
        --this.isLoadingSnapshots; 
      }))
      .catch(mobx.action((err) => {
        this.repoError = err.message || String(err);
        this.snapShots = [];
        this.selectedSnapshotID = "";
        --this.isLoadingSnapshots; 
      }));
  }
  
  // select a new snapshot
  @mobx.action
  setNewSnapshotId(id: string): void {
    if (id && this.snapShots.findIndex((s) => s.id === id) !== -1) {
      this.selectedSnapshotID = id;
    } 
    else {
      this.selectedSnapshotID = "";
    }
  }

  // fetch files at \param rootPath in the selected snapshot
  @mobx.action
  fetchFiles(rootPath: string): Promise<lib.File[]> {
    if (! this.selectedSnapshotID) {
      return Promise.reject(new Error("No snapshot selected"));
    }
    ++this.isLoadingFiles;
    return GetFilesForPath(this.selectedSnapshotID, rootPath || "/")
      .then((files) => {
        if (files instanceof Error) {
          throw files;
        }
        --this.isLoadingFiles;
        return files;
      })
      .catch((error) => {
        --this.isLoadingFiles;
        throw error;
      })
  }

  // dump specified snapshot file to temp, then open it with the system's default program
  @mobx.action
  async openFile(file: lib.File): Promise<void> {
    return DumpFileToTemp(this.selectedSnapshotID, file)
      .then((path) => { 
        if (path instanceof Error) {
          throw path;
        }
        OpenFileOrUrl(path)
          .catch(_err => {
            // ignore
          })
      });
  }

  // dump specified snapshot file to a custom target directory
  @mobx.action
  dumpFile(file: lib.File): Promise<string> {
    return DumpFile(this.selectedSnapshotID, file)
      .then((path) => { 
        if (path instanceof Error) {
          throw path;
        }
        return path;
      });
  }

  @mobx.action
  private _setLocationPrefixFromType(): void {
    this.repoLocation.prefix = repositoryPrefixes.get(this.repoLocation.type)!;
  }

  @mobx.action
  private _setLocationCredentialsFromType(): void {
    const location = this.repoLocation;
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
