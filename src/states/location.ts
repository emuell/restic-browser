import * as mobx from 'mobx';

import { restic } from '../backend/restic';
import { appState } from './app-state';

// -------------------------------------------------------------------------------------------------

/*!
 * Describes and manages an observable restic repository location 
 */

export class Location {

  @mobx.observable
  type: string = "local";

  @mobx.observable
  prefix: string = "";

  @mobx.observable
  path: string = "";

  @mobx.observable
  credentials: { name: string, value: string }[] = [];

  @mobx.observable
  password: string = "";

  @mobx.observable
  insecureTls: boolean = false;

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

  // get repository path with possibly cloaked password string in REST or SFTP paths.
  // should only used for display purposes, as this malforms the path.
  get clokedPath(): string {
    let repositoryName = this.path;
    if (repositoryName != "") {
      try {
        const urlPattern = /^(?<protocol>.+:\/\/)?(?:(?<username>[^:@]+)(?::(?<password>[^@]+))?@)?(?<host>[^\/]+)(?::(?<port>\d+))?(?<path>.*)$/;
        const matches = urlPattern.exec(repositoryName);
        if (matches && matches.groups) {
          const { protocol = '', username = '', password = '', host = '', port = '', path = '' } = matches.groups;
          if (username && password) {
            repositoryName = `${protocol || ''}${username}:***@${host}${port ? `:${port}` : ''}${path}`;
          }
        }
      } catch (error) {
        // silently ignore regex errors here
      }
    }
    return repositoryName;
  }

  // reset all location properties 
  @mobx.action
  reset(): void {
    this.type = "local";
    this.prefix = "";
    this.path = "";
    this.credentials = [];
    this.password = "";
    this.insecureTls = false;
  }

  // set location properties from some other Location
  @mobx.action
  setFromOtherLocation(other: Location): void {
    this.type = other.type;
    this.prefix = other.prefix;
    this.path = other.path;
    this.credentials = Array.from(other.credentials);
    this.password = other.password;
    this.insecureTls = other.insecureTls;
  }

  // set location properties from a restic.Location
  @mobx.action
  setFromResticLocation(location: restic.Location): void {
    // find matching location type 
    const locationInfo = appState.supportedLocationTypes.find(v => v.prefix === location.prefix);
    if (! locationInfo) {
      console.warn("Unexpected/unsupported location prefix: '%s'", location.prefix)
      return;
    }
    // apply repository path and password
    this.type = locationInfo.type;
    this.path = location.path;
    this.password = location.password;
    this.insecureTls = location.insecureTls;
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
    const locationInfo = appState.supportedLocationTypes.find(v => v.type === this.type);
    this.prefix = locationInfo?.prefix || "";
  }

  // set credentials from the current location type
  @mobx.action
  private _setCredentialsFromType(): void {
    const locationInfo = appState.supportedLocationTypes.find(v => v.type === this.type);
    const reqiredCredentials = locationInfo?.credentials || [];
    if (this.credentials.map(v => v.name).toString() !== reqiredCredentials.toString()) {
      this.credentials = reqiredCredentials.map((v) => { return { name: v, value: "" }; })
    }
  }
};
