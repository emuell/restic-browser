import * as mobx from 'mobx';

import { DumpFile, DumpFileToTemp, GetFilesForPath, OpenFileOrUrl, OpenRepo, SelectLocalRepo } 
  from '../../wailsjs/go/lib/ResticBrowserApp';

import { restic } from '../../wailsjs/go/models';

// -------------------------------------------------------------------------------------------------

export type RepositoryType = "local" | "sftp" | "rest" | "rclone" | "amazons3" | "backblaze" | "msazure";

export interface RepositoryLocationInfo {
  type: RepositoryType;
  prefix: string;
  displayName: string;
  credentials: string[];
}

export const repositoryLocationInfos: RepositoryLocationInfo[] = [
  { type: "local", prefix: "", displayName: "Local Path", credentials: [] },
  { type: "sftp", prefix: "sftp", displayName: "SFTP", credentials: [] },
  { type: "rest", prefix: "rest", displayName: "REST Server", credentials: [] },
  { type: "rclone", prefix: "rclone", displayName: "RCLONE", credentials: [] },
  { type: "amazons3", prefix: "s3", displayName: "Amazon S3", credentials: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"] },
  { type: "backblaze", prefix: "b2", displayName: "Backblaze B2", credentials: ["B2_ACCOUNT_ID", "B2_ACCOUNT_KEY"] },
  { type: "msazure", prefix: "azure", displayName: "Azure Blob Storage", credentials: ["AZURE_ACCOUNT_NAME", "AZURE_ACCOUNT_KEY"] },
];

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
  snapShots: restic.Snapshot[] = [];
  
  // loading status 
  @mobx.observable
  isLoadingSnapshots: number = 0;

  @mobx.observable
  isLoadingFiles: number = 0;

  // pending open or dump operations
  @mobx.observable
  pendingFileDumps: { file: restic.File, mode: "open" | "restore" }[] = [];

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
    this.repoError = "";
    OpenRepo(restic.Location.createFrom(this.repoLocation), this.repoPass)
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
  fetchFiles(rootPath: string): Promise<restic.File[]> {
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
  async openFile(file: restic.File): Promise<void> {
    
    this.pendingFileDumps.push({file, mode: "open"});
    
    const removePendingFile = mobx.action(() => {
      const index = this.pendingFileDumps.findIndex(
        item => item.file.path === file.path && item.mode === "open");
      if (index !== -1) {
        this.pendingFileDumps.splice(index, 1);
      }
    });

    return DumpFileToTemp(this.selectedSnapshotID, file)
      .then((path) => { 
        if (path instanceof Error) {
          throw path;
        }
        removePendingFile();
        OpenFileOrUrl(path)
          .catch(err => {
            throw err;
          })
      })
      .catch((err) => {
        removePendingFile();
        throw err;
      });
  }

  // dump specified snapshot file to a custom target directory
  @mobx.action
  dumpFile(file: restic.File): Promise<string> {
    
    this.pendingFileDumps.push({file, mode: "restore"});
    
    const removePendingFile = mobx.action(() => {
      const index = this.pendingFileDumps.findIndex(
        item => item.file.path === file.path && item.mode === "restore");
      if (index !== -1) {
        this.pendingFileDumps.splice(index, 1);
      }
    });
    
    return DumpFile(this.selectedSnapshotID, file)
      .then((path) => { 
        if (path instanceof Error) {
          throw path;
        }
        removePendingFile();
        return path;
      })
      .catch((err) => {
        removePendingFile();
        throw err;
      });
  }

  @mobx.action
  private _setLocationPrefixFromType(): void {
    const locationInfo = repositoryLocationInfos.find(v => v.type === this.repoLocation.type);
    this.repoLocation.prefix = locationInfo?.prefix || "";
  }

  @mobx.action
  private _setLocationCredentialsFromType(): void {
    const location = this.repoLocation;
    const locationInfo = repositoryLocationInfos.find(v => v.type === this.repoLocation.type);
    const reqiredCredentials = locationInfo?.credentials || [];
    if (location.credentials.map(v => v.name).toString() !== reqiredCredentials.toString()) {
      location.credentials = reqiredCredentials.map((v) => { return { name: v, value: "" }; })
    }
  }
}

// -------------------------------------------------------------------------------------------------

export const appState = new AppState();
