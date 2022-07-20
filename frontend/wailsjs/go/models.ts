export namespace restic {
	
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
	
	    static createFrom(source: any = {}) {
	        return new File(source);
	    }
	
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
	export class EnvValue {
	    name: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new EnvValue(source);
	    }
	
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
	
	    static createFrom(source: any = {}) {
	        return new Location(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.prefix = source["prefix"];
	        this.path = source["path"];
	        this.credentials = this.convertValues(source["credentials"], EnvValue);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
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
	
	    static createFrom(source: any = {}) {
	        return new Snapshot(source);
	    }
	
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

}

