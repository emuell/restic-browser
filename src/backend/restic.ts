export namespace restic {

  export class RepositoryLocationType {
    type: string;
    prefix: string;
    displayName: string;
    credentials: string[];

    constructor(source: any = {}) {
      if ('string' === typeof source) source = JSON.parse(source);
      this.type = source["type"];
      this.prefix = source["prefix"];
      this.displayName = source["displayName"];
      this.credentials = this.convertValues(source["credentials"], String);
    }

    convertValues(a: any, classs: any): any {
      if (!a) {
        return a;
      }
      if (a.slice) {
        return (a as any[]).map(elem => this.convertValues(elem, classs));
      } else if ("object" === typeof a) {
        return new classs(a);
      }
      return a;
    }
  }

  export class EnvValue {
    name: string;
    value: string;

    constructor(source: any = {}) {
      if ('string' === typeof source) source = JSON.parse(source);
      this.name = source["name"];
      this.value = source["value"];
    }
  }

  export class Location {
    prefix: string;
    path: string;
    credentials: EnvValue[];
    password: string;
    insecureTls: boolean;
  
    constructor(source: any = {}) {
      if ('string' === typeof source) source = JSON.parse(source);
      this.prefix = source["prefix"];
      this.path = source["path"];
      this.credentials = this.convertValues(source["credentials"], EnvValue);
      this.password = source["password"];
      this.insecureTls = source["insecureTls"];
    }

    convertValues(a: any, classs: any): any {
      if (!a) {
        return a;
      }
      if (a.slice) {
        return (a as any[]).map(elem => this.convertValues(elem, classs));
      } else if ("object" === typeof a) {
        return new classs(a);
      }
      return a;
    }
  }

  export class Snapshot {
    id: string;
    short_id: string;
    time: string;
    paths: string[];
    tags: string[];
    hostname: string;
    username: string;

    constructor(source: any = {}) {
      if ('string' === typeof source) source = JSON.parse(source);
      this.id = source["id"];
      this.short_id = source["short_id"];
      this.time = source["time"];
      this.paths = source["paths"];
      this.tags = source["tags"];
      this.hostname = source["hostname"];
      this.username = source["username"];
    }
  }

  export class File {
    name: string;
    type: string;
    path: string;
    uid?: number;
    gid?: number;
    size?: number;
    mode?: number;
    mtime?: string;
    atime?: string;
    ctime?: string;

    constructor(source: any = {}) {
      if ('string' === typeof source) source = JSON.parse(source);
      this.name = source["name"];
      this.type = source["type"];
      this.path = source["path"];
      this.uid = source["uid"];
      this.gid = source["gid"];
      this.size = source["size"];
      this.mode = source["mode"];
      this.mtime = source["mtime"];
      this.atime = source["atime"];
      this.ctime = source["ctime"];
    }
  }
}

