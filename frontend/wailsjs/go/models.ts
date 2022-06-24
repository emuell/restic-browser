export namespace lib {
	
	export class VuetifyTreeNode {
	    name: string;
	    type: string;
	    id: string;
	    children: VuetifyTreeNode[];
	
	    static createFrom(source: any = {}) {
	        return new VuetifyTreeNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.id = source["id"];
	        this.children = this.convertValues(source["children"], VuetifyTreeNode);
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
	    // Go type: time.Time
	    time: any;
	    tree: string;
	    paths: string[];
	    hostname: string;
	    username: string;
	    uid: number;
	    gid: number;
	
	    static createFrom(source: any = {}) {
	        return new Snapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.short_id = source["short_id"];
	        this.time = this.convertValues(source["time"], null);
	        this.tree = source["tree"];
	        this.paths = source["paths"];
	        this.hostname = source["hostname"];
	        this.username = source["username"];
	        this.uid = source["uid"];
	        this.gid = source["gid"];
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

