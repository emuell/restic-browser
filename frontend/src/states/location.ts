import * as mobx from 'mobx';

import { restic } from '../../wailsjs/go/models';

// -------------------------------------------------------------------------------------------------

export type RepositoryType = "local" | "sftp" | "rest" | "rclone" | "amazons3" | "backblaze" | "msazure";

export interface LocationInfo {
  type: RepositoryType;
  prefix: string;
  displayName: string;
  credentials: string[];
}

export const locationInfos: LocationInfo[] = [
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
 * Describes and manages an observable restic repository location 
 */

export class Location {

  @mobx.observable
  type: RepositoryType = "local";

  @mobx.observable
  prefix: string = "";

  @mobx.observable
  path: string = "";

  @mobx.observable
  credentials: { name: string, value: string }[] = [];

  @mobx.observable
  password: string = "";

  constructor() {
    mobx.makeObservable(this);

    // auto-update credentials and prefix on type changes
    mobx.reaction(
      () => this.type,
      () => {
        this._setPrefixFromType();
        this._setCredentialsFromType();
      }
    );
  }

  // reset all location properties 
  @mobx.action
  reset(): void {
    this.type = "local";
    this.prefix = "";
    this.path = "";
    this.credentials = [];
    this.password = "";
  }

  // set location properties from a restic.Location
  @mobx.action
  setFromLocation(location: restic.Location): void {
    // find matching location type 
    const locationInfo = locationInfos.find(v => v.prefix === location.prefix);
    if (! locationInfo) {
      console.warn("Unexpected/unsupported location prefix: '%s'", location.prefix)
      return;
    }
    // apply repository path and password
    this.type = locationInfo.type;
    this.path = location.path;
    this.password = location.password;
    this._setPrefixFromType();
    this._setCredentialsFromType();
    // set all required credentials as well, if they are valid
    for (const c of locationInfo.credentials) {
      const defaultValue = location.credentials.find(v => v.name === c)
      const locationValue = this.credentials.find(v => v.name === c)
      if (defaultValue && locationValue) {
        locationValue.value = defaultValue.value;
      }
    }
  }

  // set prefix from the current location type
  @mobx.action
  private _setPrefixFromType(): void {
    const locationInfo = locationInfos.find(v => v.type === this.type);
    this.prefix = locationInfo?.prefix || "";
  }

  // set credentials from the current location type
  @mobx.action
  private _setCredentialsFromType(): void {
    const locationInfo = locationInfos.find(v => v.type === this.type);
    const reqiredCredentials = locationInfo?.credentials || [];
    if (this.credentials.map(v => v.name).toString() !== reqiredCredentials.toString()) {
      this.credentials = reqiredCredentials.map((v) => { return { name: v, value: "" }; })
    }
  }
};
