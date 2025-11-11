import { BaseDirectory, exists, readFile, writeFile } from "@tauri-apps/plugin-fs";
import * as mobx from "mobx";

import { resticApp } from "../backend/app";
import { restic } from "../backend/restic";
import { decodeTextData, encodeTextData } from "../utils/text-encoding";
import type { Location } from "./location";
import { LocationPreset } from "./location-preset";

// -------------------------------------------------------------------------------------------------

/*!
 * Global application state and controller
!*/

class AppState {
  // location presets
  @mobx.observable
  locationPresets: LocationPreset[] = [new LocationPreset()];
  @mobx.observable
  selectedLocationPreset: LocationPreset = this.locationPresets[0];

  // active location shortcut
  @mobx.computed
  get repoLocation(): Location {
    return this.selectedLocationPreset.location;
  }
  // additional repo password, set for locations which have no password saved
  @mobx.observable
  repoPassword: string = "";
  // human readable error string, if any, set after opening the location
  @mobx.observable
  repoError: string = "";

  // snapshots
  @mobx.observable
  snapShots: restic.Snapshot[] = [];
  @mobx.observable
  selectedSnapshotID: string = "";

  // loading status
  @mobx.observable
  isLoadingSnapshots: number = 0;

  @mobx.observable
  isLoadingFiles: number = 0;

  // pending open or dump operations
  @mobx.observable
  pendingFileDumps: { file: restic.File; mode: "open" | "restore" }[] = [];

  // repository location types supported by the backend
  @mobx.observable
  supportedLocationTypes: restic.RepositoryLocationType[] = [];

  // initialize app state
  constructor() {
    mobx.makeObservable(this);

    // initialize from backend and external state
    (async () => {
      // verify restic binary path in backend (this is fatal)
      await resticApp.verifyResticPath();

      // fetch supported location types from backend (this is fatal)
      this.supportedLocationTypes = await resticApp.supportedRepoLocationTypes();

      // fetch default location from env or arguments, and open this location
      try {
        this.repoLocation.setFromResticLocation(await resticApp.defaultRepoLocation());
        if (this.repoLocation.path) {
          this.openRepository();
        }
      } catch (err: any) {
        console.error("Failed to fetch default location: '%s'", err.message || String(err));
      }

      // auto-load location presets from config dir
      try {
        await this._autoLoadPresets();
      } catch (err: any) {
        console.warn("Failed to load location presets file: '%s'", err.message || String(err));
      }
      // auto-save location presets to config dir on changes
      this._autoSavePresets();
    })().catch((err) => {
      console.error("Failed to initialize appState: '%s'", err.message || String(err));
    });
  }

  // select a new location preset
  @mobx.action
  setSelectedLocationPreset(locationPreset: LocationPreset): void {
    console.assert(
      this.locationPresets.includes(locationPreset),
      "Trying to select an invalid location preset",
    );
    this.selectedLocationPreset = locationPreset;
  }

  // add a new location preset from the given location with the given name
  @mobx.action
  addLocationPreset(location: Location, displayName: string, savePasswords: boolean) {
    const newPreset = new LocationPreset();
    newPreset.name = displayName;
    newPreset.location.setFromOtherLocation(location, savePasswords);
    this.locationPresets.push(newPreset);
    this.selectedLocationPreset = newPreset;
  }

  // remove given location preset
  @mobx.action
  removeLocationPreset(index: number) {
    if (index !== 0) {
      const deletingSelected = this.selectedLocationPreset === this.locationPresets[index];
      this.locationPresets.splice(index, 1);
      if (deletingSelected) {
        this.selectedLocationPreset = this.locationPresets[0];
      }
    } else {
      console.error("Trying to delete the first location preset");
    }
  }

  // set new repository location state without opening it
  @mobx.action
  setRepositoryLocation(location: Location): void {
    this.repoLocation.setFromOtherLocation(location);
  }

  // set new repository password, which is used then the location does not contain one (e.g. in presets)
  @mobx.action
  setRepositoryPassword(password: string): void {
    this.repoPassword = password;
  }

  // open the current repository and populate snapshots
  @mobx.action
  openRepository(): void {
    const location = new restic.Location(this.repoLocation);
    if (!location.allowEmptyPassword && !location.password && this.repoPassword) {
      location.password = this.repoPassword;
    }
    ++this.isLoadingSnapshots;
    this.selectedSnapshotID = "";
    this.snapShots = [];
    this.repoError = "";
    resticApp
      .openRepository(location)
      .then(() => resticApp.getSnapshots())
      .then(
        mobx.action((result) => {
          this.repoError = "";
          this.snapShots = result;
          if (!result.find((s) => s.short_id === this.selectedSnapshotID)) {
            if (result.length) {
              // select most recent
              this.selectedSnapshotID = result[result.length - 1].id;
            } else {
              this.selectedSnapshotID = "";
            }
          }
          this._filesCache.clear();
          --this.isLoadingSnapshots;
        }),
      )
      .catch(
        mobx.action((err) => {
          this.repoError = err.message || String(err);
          this.snapShots = [];
          this.selectedSnapshotID = "";
          --this.isLoadingSnapshots;
        }),
      );
  }

  // select a new snapshot
  @mobx.action
  setNewSnapshotId(id: string): void {
    console.assert(
      this.snapShots.find((s) => s.id === id) !== undefined,
      "Trying to select an invalid snapshot",
    );
    this.selectedSnapshotID = id;
  }

  // fetch files at \param rootPath in the selected snapshot
  @mobx.action
  fetchFiles(rootPath: string): Promise<restic.File[]> {
    const selectedSnapshotID = this.selectedSnapshotID;
    if (!selectedSnapshotID) {
      return Promise.reject(new Error("No snapshot selected"));
    }
    // do we got cached files for this snapshot and path?
    const cachedFiles = this._getCachedFiles(selectedSnapshotID, rootPath);
    if (cachedFiles) {
      return Promise.resolve(cachedFiles);
    }
    // else fetch new ones and cache them
    ++this.isLoadingFiles;
    return resticApp
      .getFiles(this.selectedSnapshotID, rootPath || "/")
      .then(
        mobx.action((files) => {
          --this.isLoadingFiles;
          this._addCachedFiles(selectedSnapshotID, rootPath, files);
          return files;
        }),
      )
      .catch(
        mobx.action((error) => {
          --this.isLoadingFiles;
          throw error;
        }),
      );
  }

  // dump specified snapshot file to temp, then open it with the system's default program
  @mobx.action
  async openFile(file: restic.File): Promise<void> {
    this.pendingFileDumps.push({ file, mode: "open" });

    const removePendingFile = mobx.action(() => {
      const index = this.pendingFileDumps.findIndex(
        (item) => item.file.path === file.path && item.mode === "open",
      );
      if (index !== -1) {
        this.pendingFileDumps.splice(index, 1);
      }
    });

    return resticApp
      .dumpFileToTemp(this.selectedSnapshotID, file)
      .then((path) => {
        removePendingFile();
        resticApp.openFileOrUrl(path).catch((err) => {
          throw err;
        });
      })
      .catch((err) => {
        removePendingFile();
        throw err;
      });
  }

  // dump specified snapshot file to a custom target directory
  // files will be restored as they are, folders will be restored as zip files
  @mobx.action
  dumpFile(file: restic.File): Promise<string> {
    this.pendingFileDumps.push({ file, mode: "restore" });

    const removePendingFile = mobx.action(() => {
      const index = this.pendingFileDumps.findIndex(
        (item) => item.file.path === file.path && item.mode === "restore",
      );
      if (index !== -1) {
        this.pendingFileDumps.splice(index, 1);
      }
    });

    return resticApp
      .dumpFile(this.selectedSnapshotID, file)
      .then((path) => {
        removePendingFile();
        return path;
      })
      .catch((err) => {
        removePendingFile();
        throw err;
      });
  }

  // restore specified snapshot file to a custom target directory
  @mobx.action
  restoreFile(file: restic.File): Promise<string> {
    this.pendingFileDumps.push({ file, mode: "restore" });

    const removePendingFile = mobx.action(() => {
      const index = this.pendingFileDumps.findIndex(
        (item) => item.file.path === file.path && item.mode === "restore",
      );
      if (index !== -1) {
        this.pendingFileDumps.splice(index, 1);
      }
    });

    return resticApp
      .restoreFile(this.selectedSnapshotID, file)
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

  // maximum size of the files cache
  static readonly MAX_CACHED_FILE_ENTRIES = 50;

  // file cache for \function fetchFiles
  private _filesCache = new Map<string, { files: restic.File[]; lastAccessTime: number }>();

  // construct a key for the filesList cache
  private static _cachedFilesKey(snapShotId: string, path: string): string {
    const normalizedPath = !path ? "/" : path.replace(/\\/g, "/");
    return `${snapShotId}:${normalizedPath}`;
  }

  // get cached files for the given snapshot and path.
  // returns undefined when no cached files are present.
  private _getCachedFiles(snapShotId: string, path: string): restic.File[] | undefined {
    const entry = this._filesCache.get(AppState._cachedFilesKey(snapShotId, path));
    if (entry) {
      entry.lastAccessTime = Date.now();
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
          oldestTime = value.lastAccessTime;
          oldestKey = key;
        }
      }
      this._filesCache.delete(oldestKey);
    }
    // add new entry
    this._filesCache.set(AppState._cachedFilesKey(snapShotId, path), {
      files: files,
      lastAccessTime: currentTime,
    });
  }

  // load presets from config file
  private async _autoLoadPresets() {
    if (await exists("presets.json", { baseDir: BaseDirectory.AppConfig })) {
      const fileContent = await readFile("presets.json", {
        baseDir: BaseDirectory.AppConfig,
      });
      const textContent = decodeTextData(fileContent);
      const presetsObject = JSON.parse(textContent);
      if (!Array.isArray(presetsObject)) {
        throw "Content is not an array";
      }
      // NB: keep first entry: it is used as new location template
      mobx.runInAction(() =>
        this.locationPresets.push(
          ...presetsObject.map((presetObject) => {
            const newPreset = new LocationPreset();
            newPreset.fromJSON(presetObject);
            return newPreset;
          }),
        ),
      );
    }
  }

  // save presets to config file
  private _autoSavePresets() {
    // auto-save location presets to config dir
    mobx.reaction(
      // skip first entry: it is used as new location template
      () => JSON.stringify(this.locationPresets.slice(1)),
      (contents) => {
        const fileContent = encodeTextData(contents);
        writeFile("presets.json", fileContent, {
          baseDir: BaseDirectory.AppConfig,
        }).catch((err) => {
          console.error("Failed to save location presets: '%s'", err.message || String(err));
        });
      },
      { delay: 500 },
    );
  }
}

// -------------------------------------------------------------------------------------------------

export const appState = new AppState();
