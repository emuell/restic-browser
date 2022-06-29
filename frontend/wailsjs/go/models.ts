export namespace lib {
	
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

