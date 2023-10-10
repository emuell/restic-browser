import { invoke } from '@tauri-apps/api';
import { restic } from './models';

export function DefaultRepoLocation(): Promise<restic.Location> {
    return invoke<restic.Location>("default_repo_location");
}

export function SelectLocalRepo(): Promise<string> {
    return invoke<string>("select_local_repo");
}

export function SelectAndReadPasswordFromFile(): Promise<string> {
    return invoke<string>("read_password_from_file");
}

export function OpenFileOrUrl(arg1: string): Promise<void> {
    return invoke<void>("open_file_or_url", { arg1 });
}

export function OpenRepo(arg1: restic.Location): Promise<Array<restic.Snapshot>> {
    return invoke<Array<restic.Snapshot>>("open_repo", { arg1 });
}

export function GetFilesForPath(arg1: string, arg2: string): Promise<Array<restic.File>> {
    return invoke<Array<restic.File>>("get_file_for_path", { arg1, arg2 });
}

export function DumpFile(arg1: string, arg2: any): Promise<string> {
    return invoke<string>("dump_file", { arg1, arg2 });
}

export function DumpFileToTemp(arg1: string, arg2: any): Promise<string> {
    return invoke<string>("dump_file_to_temp", { arg1, arg2 });
}

export function RestoreFile(arg1: string, arg2: any): Promise<string> {
    return invoke<string>("restore_file", { arg1, arg2 });
}
