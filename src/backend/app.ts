import { core } from '@tauri-apps/api';

import { restic } from './restic';

export namespace resticApp {

    export function supportedRepoLocationTypes(): Promise<restic.RepositoryLocationType[]> {
        return core.invoke<restic.RepositoryLocationType[]>("supported_repo_location_types");
    }

    export function defaultRepoLocation(): Promise<restic.Location> {
        return core.invoke<restic.Location>("default_repo_location");
    }

    export function openFileOrUrl(path: string): Promise<void> {
        return core.invoke<void>("open_file_or_url", { path });
    }

    export function verifyResticPath(): Promise<void> {
        return core.invoke<void>("verify_restic_path");
    }

    export function openRepository(location: restic.Location): Promise<void> {
        return core.invoke<void>("open_repository", { location });
    }

    export function getSnapshots(): Promise<Array<restic.Snapshot>> {
        return core.invoke<Array<restic.Snapshot>>("get_snapshots", { location });
    }

    export function getFiles(snapshotId: string, path: string): Promise<Array<restic.File>> {
        return core.invoke<Array<restic.File>>("get_files", { snapshotId, path });
    }

    export function dumpFile(snapshotId: string, file: restic.File): Promise<string> {
        return core.invoke<string>("dump_file", { snapshotId, file });
    }

    export function dumpFileToTemp(snapshotId: string, file: restic.File): Promise<string> {
        return core.invoke<string>("dump_file_to_temp", { snapshotId, file });
    }

    export function restoreFile(snapshotId: string, file: restic.File): Promise<string> {
        return core.invoke<string>("restore_file", { snapshotId, file });
    }

}