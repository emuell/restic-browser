import { 
  GridDataProviderCallback, GridDataProviderParams, GridSorterDefinition 
} from "@vaadin/grid";

import { restic } from "../backend/models";

// -------------------------------------------------------------------------------------------------

// sorting helper functions, shamelessly copied from @vaadin-grid/array-data-provider.js

function normalizeEmptyValue(value: any): any {
  if ([undefined, null].includes(value)) {
    return '';
  } else if (isNaN(value)) {
    return value.toString();
  }
  return value;
}

function compare(a: any, b: any): number {
  a = normalizeEmptyValue(a);
  b = normalizeEmptyValue(b);

  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function get(path: string, object: any): any {
  return path.split('.').reduce((obj, property) => obj[property], object);
}
    
// -------------------------------------------------------------------------------------------------

/* 
  Vaadin grid compatible data-provider to sort and cache restic.Files 
*/

export class FileListDataProvider {

  private _files: restic.File[] = [];
  private _sortedFiles: restic.File[] = [];
  private _sortedFilesOrder?: GridSorterDefinition = undefined;

  constructor() {
    // ensure our callback won't loose this context
    this.provider = this.provider.bind(this);
  }

  // get currently sorted files
  get sortedFiles(): restic.File[] {    
    return this._files;
  }

  // get currently unsorted files
  get files(): restic.File[] {
    return this._files;
  }

  // set new files
  set files(files: restic.File[]) {
    this._files = files;
    // prune cache
    this._sortedFiles = [];
    this._sortedFilesOrder = undefined;
  }

  // the actual data-provider callback
  provider(
    params: GridDataProviderParams<restic.File>,
    callback: GridDataProviderCallback<restic.File>
  ) {
    const items = this._sortFiles(params);
    const count = Math.min(items.length, params.pageSize);
    const start = params.page * count;
    const end = start + count;
    if (start !== 0 || end !== items.length) {
      callback(items.slice(start, end), items.length);
    } else {
      callback(items, items.length);
    }
  }

  private _sortFiles(params: GridDataProviderParams<restic.File>): restic.File[] {

    // get sort order (multi sorting not supported ATM)
    let sortOrder: GridSorterDefinition = {
      path: "name",
      direction: "asc"
    };
    if (params.sortOrders && params.sortOrders.length) {
      if (params.sortOrders[0].direction) {
        sortOrder = params.sortOrders[0];
      }
    }

    // check if we need to update our files cache
    if (this._sortedFilesOrder && 
        this._sortedFilesOrder.direction === sortOrder.direction && 
        this._sortedFilesOrder.path === sortOrder.path) {
      return this._sortedFiles;
    }

    // get items from files and apply our customized sorting
    this._sortedFiles = Array.from(this._files);
    this._sortedFiles.sort((a: restic.File, b: restic.File) => {
      // always keep .. item at top
      if (a.type === "dir" && a.name == "..") {
        return -1;
      } else if (b.type === "dir" && b.name == "..") {
        return 1;
      }
      // keep directories at top or bottom when sorting by name
      if (sortOrder.path === "name") {
        if (a.type === "dir" && b.type !== "dir") {
          return (sortOrder.direction === "asc") ? -1 : 1;
        } else if (a.type !== "dir" && b.type === "dir") {
          return (sortOrder.direction === "asc") ? 1 : -1;
        }
        // and do a "natural" sort on names
        const options: Intl.CollatorOptions = { numeric: true, sensitivity: "base" };
        if (sortOrder.direction === 'asc') {
          return a.name.localeCompare(b.name, undefined, options);
        } else { 
          return b.name.localeCompare(a.name, undefined, options);
        }
      } else {
        // apply custom sorting 
        if (sortOrder.direction === 'asc') {
          return compare(get(sortOrder.path, a), get(sortOrder.path, b));
        } else { 
          return compare(get(sortOrder.path, b), get(sortOrder.path, a));
        }
      }
    });
  
    return this._sortedFiles;
  }
}