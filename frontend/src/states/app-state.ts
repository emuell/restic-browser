import * as mobx from 'mobx';

import { DefaultRepoLocation, DumpFile, DumpFileToTemp, GetFilesForPath, OpenFileOrUrl, OpenRepo, SelectLocalRepo } 
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
      credentials: [] as { name: string, value: string }[],
      password: "" 
  };

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

    // fetch and open default repository location, if set
    DefaultRepoLocation()
      .then(mobx.action((defaultLocation) => {
        // find matching location type 
        const locationInfo = repositoryLocationInfos.find(v => v.prefix === defaultLocation.prefix);
        if (! locationInfo) {
          console.warn("Unexpected default location prefix: '%s'", defaultLocation.prefix)
          return;
        }
        // apply default repository path and password
        this.repoLocation.type = locationInfo.type;
        this.repoLocation.path = defaultLocation.path;
        this.repoLocation.password = defaultLocation.password;
        this._setLocationPrefixFromType();
        this._setLocationCredentialsFromType();
        // set all required credentials as well, if they are valid
        for (const c of locationInfo.credentials) {
          const defaultValue = defaultLocation.credentials.find(v => v.name === c)
          const locationValue = this.repoLocation.credentials.find(v => v.name === c)
          if (defaultValue && locationValue) {
            locationValue.value = defaultValue.value;
          }
        }
        // try opening the repository, when we have a path set
        if (this.repoLocation.path) {
          this.openRepository();
        }
      }))
      .catch((err) => {
        console.warn("Failed to fetch default repo location: '%s'", err.message || String(err))
      })
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
    OpenRepo(restic.Location.createFrom(this.repoLocation))
      .then(mobx.action((result) => {
        this.repoError = "";
        this.snapShots = result;
        if (result.findIndex((s) => s.short_id === this.selectedSnapshotID) === -1) {
          this.selectedSnapshotID = "";
        }
        this._filesCache.clear();
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
    const selectedSnapshotID = this.selectedSnapshotID;
    if (! selectedSnapshotID) {
      return Promise.reject(new Error("No snapshot selected"));
    }
    // do we got cached files for this snapshot and path?
    const cachedFiles = this._getCachedFiles(selectedSnapshotID, rootPath);
    if (cachedFiles) {
      return Promise.resolve(cachedFiles)
    } 
    // else fetch new ones and cache them
    ++this.isLoadingFiles;
    return GetFilesForPath(this.selectedSnapshotID, rootPath || "/")
      .then((files) => {
        --this.isLoadingFiles;
        this._addCachedFiles(selectedSnapshotID, rootPath, files);
        return files;
      })
      .catch((error) => {
        --this.isLoadingFiles;
        throw error;
      });
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
        removePendingFile();
        return path;
      })
      .catch((err) => {
        removePendingFile();
        throw err;
      });
  }

  // --- private helper functions

  // set a location prefix from the current location type
  @mobx.action
  private _setLocationPrefixFromType(): void {
    const locationInfo = repositoryLocationInfos.find(v => v.type === this.repoLocation.type);
    this.repoLocation.prefix = locationInfo?.prefix || "";
  }

  // set location credentials from the current location type
  @mobx.action
  private _setLocationCredentialsFromType(): void {
    const location = this.repoLocation;
    const locationInfo = repositoryLocationInfos.find(v => v.type === this.repoLocation.type);
    const reqiredCredentials = locationInfo?.credentials || [];
    if (location.credentials.map(v => v.name).toString() !== reqiredCredentials.toString()) {
      location.credentials = reqiredCredentials.map((v) => { return { name: v, value: "" }; })
    }
  }

  // get cached files for the given snapshot and path. 
  // returns undefined when no cached files are present. 
  private _getCachedFiles(snapShotId: string, path: string): restic.File[] | undefined {
    const entry = this._filesCache.get(AppState._cachedFilesKey(snapShotId, path))
    if (entry) {
      return entry.files;
    }
    return undefined;
  }

  // add files for the given snapshot and path to the cache. 
  private _addCachedFiles(snapShotId: string, path: string, files: restic.File[]) {
    const currentTime = Date.now();
    if (this._filesCache.size > AppState.MAX_CACHED_FILE_ENTRIES) {
      // remove oldest cache entry
      let oldestTime = currentTime; 
      let oldestKey = "";
      for (const [key, value] of Array.from(this._filesCache)) {
        if (value.lastAccessTime < oldestTime) {
          oldestTime = value.lastAccessTime
          oldestKey = key
        }
      }
      this._filesCache.delete(oldestKey)
    }
    // add new entry
    this._filesCache.set(AppState._cachedFilesKey(snapShotId, path), { 
      files: files, lastAccessTime: currentTime 
    });
  }

  // maximum size of the files cache
  static readonly MAX_CACHED_FILE_ENTRIES = 50;

  // construct a key for the filesList cache 
  private static _cachedFilesKey(snapShotId: string, path: string): string {
    return snapShotId + ":" + path;
  }

  // file cache for \function fetchFiles 
  private _filesCache = new Map<string, { files: restic.File[], lastAccessTime: number }>();
}

// -------------------------------------------------------------------------------------------------

export const appState = new AppState();
