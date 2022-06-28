export namespace lib {
	
	export class Snapshot {
	    id: string;
	    short_id: string;
	    time: string;
	    paths: string[];
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
	    // Go type: time.Time
	    mtime?: any;
	    // Go type: time.Time
	    atime?: any;
	    // Go type: time.Time
	    ctime?: any;
	    struct_type?: string;
	    children?: {[key: string]: File};
	
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
	        this.mtime = this.convertValues(source["mtime"], null);
	        this.atime = this.convertValues(source["atime"], null);
	        this.ctime = this.convertValues(source["ctime"], null);
	        this.struct_type = source["struct_type"];
	        this.children = source["children"];
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

}

